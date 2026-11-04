import { env } from "@/config/env";
import { redis } from "@/lib/redis";
import { createChildLogger } from "@/lib/logger";
import {
  incrementLlmUsage,
  isLlmBudgetAvailable,
  markDailyBudgetExhausted,
  checkClientRateLimit,
} from "@/lib/llm-budget";
import { AgentContext, AgentProposal, AgentProposalSchema, AgentResult } from "./schema";
import { SYSTEM_PROMPT, buildAgentPrompt, buildRepairPrompt } from "./prompts";

const log = createChildLogger("agent-client");

export interface CallResult {
  content: string;
  retryAfterSeconds?: number;
}

export type ModelCallerFn = (
  model: string,
  messages: Array<{ role: string; content: string }>
) => Promise<CallResult>;

export function isDailyQuotaError(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase();
  return (
    lower.includes("free-models-per-day") ||
    lower.includes("openrouter_free_tier_daily") ||
    lower.includes("daily limit") ||
    lower.includes("daily quota") ||
    lower.includes("credits to unlock")
  );
}

/**
 * Default OpenAI-compatible HTTP model caller
 */
export async function defaultOpenRouterCaller(
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<CallResult> {
  const apiKey = env.OPENROUTER_API_KEY;
  const baseUrl = env.OPENROUTER_BASE_URL.replace(/\/+$/, "");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://revenueguardian.local",
      "X-Title": "Revenue Guardian",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
    const errText = await res.text();
    log.warn({ status: res.status, model, retryAfter, err: errText }, "LLM provider call failed");
    const error = new Error(`LLM call failed (${res.status}): ${errText}`) as Error & {
      retryAfterSeconds?: number;
      status?: number;
      bodyText?: string;
    };
    error.retryAfterSeconds = retryAfter;
    error.status = res.status;
    error.bodyText = errText;
    throw error;
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content || "";
  return { content };
}

export class AgentService {
  private readonly caller: ModelCallerFn;

  constructor(caller: ModelCallerFn = defaultOpenRouterCaller) {
    this.caller = caller;
  }

  public async evaluateEvent(context: AgentContext): Promise<AgentResult> {
    const cacheKey = `rg:llm_cache:${context.eventId}`;

    // 1. Check Redis cache by event ID (prevents re-calling model on retry)
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        log.info({ eventId: context.eventId }, "Agent returning cached proposal for event");
        const parsed = JSON.parse(cached);
        return {
          status: "SUCCESS",
          proposal: parsed.proposal,
          modelUsed: parsed.modelUsed || "cache",
          attempts: 0,
        };
      }
    } catch (err) {
      log.warn({ err }, "Redis cache lookup failed; proceeding with model call");
    }

    // 2. Check Daily LLM Budget
    const budgetAvailable = await isLlmBudgetAvailable();
    if (!budgetAvailable) {
      log.warn({ eventId: context.eventId }, "Daily LLM budget exhausted. Transitioning to WAITING_FOR_AI");
      return {
        status: "WAITING_FOR_AI",
        proposal: null,
        error: "Daily LLM budget exhausted. Action held in WAITING_FOR_AI state.",
      };
    }

    // 3. Assemble model chain: primary + fallbacks
    const modelsToTry = [env.MODEL_PRIMARY, ...env.MODEL_FALLBACKS].filter(Boolean);
    const userPrompt = buildAgentPrompt(context);
    let totalAttempts = 0;

    for (const model of modelsToTry) {
      log.info({ model, eventId: context.eventId }, "Attempting agent proposal with model");

      // Max 2 attempts per model with backoff
      for (let modelAttempt = 1; modelAttempt <= 2; modelAttempt++) {
        // Enforce client-side rate limit (15 req/min)
        const rateLimit = await checkClientRateLimit(15);
        if (!rateLimit.allowed) {
          log.warn({ retryAfterMs: rateLimit.retryAfterMs }, "Rate limit (15 RPM) exceeded, waiting...");
          await new Promise((r) => setTimeout(r, Math.min(rateLimit.retryAfterMs, 4000)));
        }

        totalAttempts++;
        try {
          const { allowed } = await incrementLlmUsage();
          if (!allowed) {
            return {
              status: "WAITING_FOR_AI",
              proposal: null,
              error: "Daily LLM budget exceeded during execution",
            };
          }

          const messages = [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ];

          let callResult = await this.caller(model, messages);
          let candidate = this.extractAndValidateJson(callResult.content);

          // One JSON repair retry if parsing failed
          if (!candidate.success) {
            log.warn({ model, error: candidate.error }, "JSON parsing failed; attempting one repair call");
            const repairMessages = [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
              { role: "assistant", content: callResult.content },
              { role: "user", content: buildRepairPrompt(callResult.content, candidate.error) },
            ];

            callResult = await this.caller(model, repairMessages);
            candidate = this.extractAndValidateJson(callResult.content);
          }

          if (candidate.success && candidate.proposal) {
            log.info({ model, eventId: context.eventId }, "Agent successfully generated valid proposal");

            // Cache proposal in Redis (24 hour TTL)
            try {
              await redis.set(
                cacheKey,
                JSON.stringify({ proposal: candidate.proposal, modelUsed: model }),
                "EX",
                60 * 60 * 24
              );
            } catch (err) {
              log.warn({ err }, "Failed to cache proposal in Redis");
            }

            return {
              status: "SUCCESS",
              proposal: candidate.proposal,
              modelUsed: model,
              attempts: totalAttempts,
            };
          }
        } catch (err: unknown) {
          const errorObj = err as {
            retryAfterSeconds?: number;
            message?: string;
            bodyText?: string;
            status?: number;
          };
          const errDetail = `${errorObj.message || ""} ${errorObj.bodyText || ""}`;
          log.warn(
            { model, attempt: modelAttempt, status: errorObj.status, err: errorObj.message },
            "Model call encountered an error"
          );

          // 1. CLASSIFY 429: Account-wide daily cap reached (free-models-per-day)
          if (errorObj.status === 429 && isDailyQuotaError(errDetail)) {
            log.error(
              { model, err: errorObj.message },
              "CRITICAL: OpenRouter free-models-per-day cap reached. Halting fallback cascade immediately."
            );
            await markDailyBudgetExhausted("OpenRouter free-models-per-day cap reached");
            return {
              status: "WAITING_FOR_AI",
              proposal: null,
              error: "OpenRouter daily free-tier cap reached. Event transitioned to WAITING_FOR_AI.",
            };
          }

          // 2. CLASSIFY 429: Per-minute rate limit -> backoff with jitter
          if (errorObj.status === 429) {
            const retryDelay = errorObj.retryAfterSeconds
              ? errorObj.retryAfterSeconds * 1000
              : Math.pow(2, modelAttempt) * 1000 + Math.random() * 500;
            log.info({ retryDelay }, "Per-minute rate limit hit; backing off with jitter");
            await new Promise((r) => setTimeout(r, Math.min(retryDelay, 5000)));
            continue;
          }

          // Generic backoff + jitter for transient network / 5xx errors
          const backoffMs = Math.pow(2, modelAttempt) * 300 + Math.random() * 200;
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }
    }

    // 4. All models exhausted -> fail-safe WAITING_FOR_AI
    log.error({ eventId: context.eventId, models: modelsToTry }, "All LLM models failed. Event set to WAITING_FOR_AI");
    return {
      status: "WAITING_FOR_AI",
      proposal: null,
      error: "All LLM models and fallback providers failed or timed out",
    };
  }

  private extractAndValidateJson(
    content: string
  ): { success: boolean; proposal?: AgentProposal; error: string } {
    try {
      let cleaned = content.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();
      }

      const parsed = JSON.parse(cleaned);
      const validated = AgentProposalSchema.safeParse(parsed);

      if (validated.success) {
        return { success: true, proposal: validated.data, error: "" };
      } else {
        const issues = validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
        return { success: false, error: issues };
      }
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}

export const agentService = new AgentService();
