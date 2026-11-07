import { env } from "@/config/env";
import { redis } from "@/lib/redis";
import { createChildLogger } from "@/lib/logger";
import { db, schema } from "@/db";
import {
  incrementLlmUsage,
  isLlmBudgetAvailable,
  markDailyBudgetExhausted,
  checkClientRateLimit,
  isRealProvider,
} from "@/lib/llm-budget";
import {
  AgentContext,
  AgentContextSnapshot,
  AgentProposal,
  AgentProposalSchema,
  AgentResult,
  GroundingValidation,
} from "./schema";
import { SYSTEM_PROMPT, buildAgentPrompt, buildRepairPrompt } from "./prompts";

const log = createChildLogger("agent-client");

export function validateGrounding(
  reasoning: string,
  context: AgentContext
): GroundingValidation {
  const flaggedPhrases: string[] = [];

  // Check 1: External policy / threshold / limit / rule claims (model has no policy context)
  const forbiddenPolicyPatterns = [
    /\bper\s+([a-z-]+\s+)?policy\b/i,
    /\bwithin\s+([a-z-]+\s+)?limits?\b/i,
    /\bunder\s+([a-z-]+\s+)?limits?\b/i,
    /\bexceeds?\s+([a-z-]+\s+)?limits?\b/i,
    /\bthresholds?\b/i,
    /\ballowed\b/i,
    /\bpolicy\s+(allows?|permits?|requires?|mandates?)\b/i,
    /\bpolicy\s+rules?\b/i,
  ];

  const flaggedPolicy: string[] = [];
  for (const pattern of forbiddenPolicyPatterns) {
    const match = reasoning.match(pattern);
    if (match) {
      flaggedPolicy.push(match[0]);
    }
  }

  // Check 2: Customer history claims without DB context
  const flaggedHistory: string[] = [];
  const hasCustomerHistory = Boolean(
    context.customerHistory &&
      context.customerHistory.trim().length > 0 &&
      !context.customerHistory.toLowerCase().includes("null")
  );

  if (!hasCustomerHistory) {
    const forbiddenHistoryPatterns = [
      /\bestablished (client|customer|account)\b/i,
      /\bloyal (client|customer)\b/i,
      /\brepeat (client|customer|buyer)\b/i,
      /\bfrequent (client|customer|buyer)\b/i,
      /\bprevious (transactions?|orders?|payments?|purchases?)\b/i,
      /\bpast (transactions?|orders?|payments?|purchases?|history)\b/i,
      /\bprior (transactions?|orders?|payments?|purchases?|history)\b/i,
      /\bhistory of (payments?|on-time|successful)\b/i,
      /\blong-standing (client|customer)\b/i,
      /\bgood (standing|history|track record)\b/i,
      /\bexisting (client|customer) with (good )?history\b/i,
      /\btrusted (client|customer)\b/i,
    ];

    for (const pattern of forbiddenHistoryPatterns) {
      const match = reasoning.match(pattern);
      if (match) {
        flaggedHistory.push(match[0]);
      }
    }
  }

  const allFlagged = [...flaggedPolicy, ...flaggedHistory];
  if (allFlagged.length > 0) {
    let reason = "";
    if (flaggedHistory.length > 0 && flaggedPolicy.length > 0) {
      reason = `Reasoning claims customer history (${flaggedHistory.join(", ")}) and policy thresholds/limits (${flaggedPolicy.join(", ")}) not in context`;
    } else if (flaggedHistory.length > 0) {
      reason = `Reasoning claims customer history (${flaggedHistory.join(", ")}) that was not provided in the DB context object`;
    } else {
      reason = `Reasoning claims policy thresholds or limits (${flaggedPolicy.join(", ")}) not provided in context`;
    }
    return {
      isGrounded: false,
      flaggedPhrases: allFlagged,
      reason,
    };
  }

  return { isGrounded: true, flaggedPhrases: [] };
}

export interface CallResult {
  content: string;
  retryAfterSeconds?: number;
}

export interface CallerOptions {
  caller?: string;
  eventId?: string;
  attempt?: number;
}

export type ModelCallerFn = (
  model: string,
  messages: Array<{ role: string; content: string }>,
  options?: CallerOptions
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
  messages: Array<{ role: string; content: string }>,
  options?: CallerOptions
): Promise<CallResult> {
  const apiKey = env.OPENROUTER_API_KEY;
  const baseUrl = (process.env.LLM_BASE_URL || env.LLM_BASE_URL || env.OPENROUTER_BASE_URL).replace(/\/+$/, "");
  const caller = options?.caller || "agent";
  const eventId = options?.eventId || null;
  const attempt = options?.attempt || 1;

  const isReal = isRealProvider();
  const startTime = Date.now();

  // Increment usage for EVERY outbound HTTP request (retries, repair attempts, fallbacks included)
  if (isReal) {
    try {
      await incrementLlmUsage("real");
    } catch (err) {
      log.error({ err }, "Failed to increment real LLM usage counter");
    }
  } else {
    try {
      await incrementLlmUsage("test");
    } catch (err) {
      log.error({ err }, "Failed to increment test LLM usage counter");
    }
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
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
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = (err as Error).message;
    try {
      await db.insert(schema.llmRequests).values({
        caller,
        model,
        eventId,
        httpStatus: null,
        attempt,
        latencyMs,
        errorMessage: errorMsg,
      });
    } catch (dbErr) {
      log.error({ dbErr }, "Failed to record outbound LLM request in db");
    }
    throw err;
  }

  const latencyMs = Date.now() - startTime;

  if (!res.ok) {
    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
    const errText = await res.text();

    try {
      await db.insert(schema.llmRequests).values({
        caller,
        model,
        eventId,
        httpStatus: res.status,
        attempt,
        latencyMs,
        errorMessage: errText.slice(0, 1000),
      });
    } catch (dbErr) {
      log.error({ dbErr }, "Failed to record outbound LLM request in db");
    }

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

  try {
    await db.insert(schema.llmRequests).values({
      caller,
      model,
      eventId,
      httpStatus: res.status,
      attempt,
      latencyMs,
      errorMessage: null,
    });
  } catch (dbErr) {
    log.error({ dbErr }, "Failed to record outbound LLM request in db");
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
          contextSnapshot: parsed.contextSnapshot || context,
          groundingValidation: parsed.groundingValidation || { isGrounded: true, flaggedPhrases: [] },
        };
      }
    } catch (err) {
      log.warn({ err }, "Redis cache lookup failed; proceeding with model call");
    }

    // Determine accounting scope: only genuine calls using default caller to real provider touch 'real' namespace
    const isReal = this.caller === defaultOpenRouterCaller && isRealProvider();
    const scope: "real" | "test" = isReal ? "real" : "test";

    // 2. Check Daily LLM Budget
    const budgetAvailable = await isLlmBudgetAvailable(scope);
    if (!budgetAvailable) {
      log.warn({ eventId: context.eventId, scope }, "Daily LLM budget exhausted. Transitioning to WAITING_FOR_AI");
      return {
        status: "WAITING_FOR_AI",
        proposal: null,
        error: "Daily LLM budget exhausted. Action held in WAITING_FOR_AI state.",
        contextSnapshot: context,
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
          const budgetAvailableNow = await isLlmBudgetAvailable(scope);
          if (!budgetAvailableNow) {
            return {
              status: "WAITING_FOR_AI",
              proposal: null,
              error: "Daily LLM budget exceeded during execution",
              contextSnapshot: context,
            };
          }

          const messages = [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ];

          let callResult = await this.caller(model, messages, {
            caller: "worker",
            eventId: context.eventId,
            attempt: totalAttempts,
          });
          let candidate = this.extractAndValidateJson(callResult.content);

          // One JSON repair retry if parsing failed
          if (!candidate.success) {
            log.warn({ model, error: candidate.error }, "JSON parsing failed; attempting one repair call");
            totalAttempts++;
            const repairMessages = [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
              { role: "assistant", content: callResult.content },
              { role: "user", content: buildRepairPrompt(callResult.content, candidate.error) },
            ];

            callResult = await this.caller(model, repairMessages, {
              caller: "worker_repair",
              eventId: context.eventId,
              attempt: totalAttempts,
            });
            candidate = this.extractAndValidateJson(callResult.content);
          }

          if (candidate.success && candidate.proposal) {
            log.info({ model, eventId: context.eventId }, "Agent successfully generated valid proposal");

            // Validate Grounding: verify reasoning doesn't claim customer history when none provided in context
            const grounding = validateGrounding(candidate.proposal.reasoning, context);
            if (!grounding.isGrounded) {
              log.warn(
                { eventId: context.eventId, flaggedPhrases: grounding.flaggedPhrases },
                "Grounding violation: reasoning claimed customer history without DB context. Downgrading confidence to force NEEDS_APPROVAL."
              );
              // Mark low confidence (< threshold 0.80) to force policy engine to evaluate NEEDS_APPROVAL
              candidate.proposal.confidence = Math.min(candidate.proposal.confidence, 0.40);
              candidate.proposal.reasoning = `[UNGROUNDED CLAIM: ${grounding.reason}] ${candidate.proposal.reasoning}`;
            }

            // Cache proposal in Redis (24 hour TTL)
            try {
              await redis.set(
                cacheKey,
                JSON.stringify({
                  proposal: candidate.proposal,
                  modelUsed: model,
                  contextSnapshot: context,
                  groundingValidation: grounding,
                }),
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
              contextSnapshot: context,
              groundingValidation: grounding,
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
              contextSnapshot: context,
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
      contextSnapshot: context,
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
