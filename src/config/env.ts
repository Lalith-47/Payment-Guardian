import dotenv from "dotenv";
import { z } from "zod";

// Ensure .env is loaded
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),

  // Database & Redis
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid postgres URL"),
  REDIS_URL: z.string().url("REDIS_URL must be a valid redis URL"),

  // PayPal Sandbox Only
  PAYPAL_CLIENT_ID: z.string().min(1, "PAYPAL_CLIENT_ID is required"),
  PAYPAL_CLIENT_SECRET: z.string().min(1, "PAYPAL_CLIENT_SECRET is required"),
  PAYPAL_BASE_URL: z
    .string()
    .url("PAYPAL_BASE_URL must be a valid URL")
    .refine(
      (val) => {
        try {
          const url = new URL(val);
          return url.hostname.endsWith("sandbox.paypal.com");
        } catch {
          return false;
        }
      },
      {
        message: "PAYPAL_BASE_URL must strictly target sandbox (e.g. https://api-m.sandbox.paypal.com)",
      }
    ),
  PAYPAL_BUSINESS_EMAIL: z.string().email().optional(),
  PAYPAL_WEBHOOK_ID: z.string().optional(),
  PAYPAL_WEBHOOK_TOLERANCE_SECONDS: z.coerce.number().default(300),

  // Negative Testing Control
  SANDBOX_NEGATIVE_TESTING: z
    .enum(["true", "false"])
    .default("false")
    .transform((val) => val === "true"),

  // LLM Layer
  OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY is required"),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  MODEL_PRIMARY: z.string().min(1, "MODEL_PRIMARY is required"),
  MODEL_FALLBACKS: z
    .string()
    .default("")
    .transform((val) =>
      val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  LLM_BASE_URL_2: z.string().url().optional(),
  LLM_API_KEY_2: z.string().optional(),
  LLM_PROVIDER_DAILY_CAP: z.coerce.number().default(100),
  LLM_DAILY_BUDGET: z.coerce.number().default(100),

  // Auth (better-auth single owner)
  BETTER_AUTH_SECRET: z.string().min(16, "BETTER_AUTH_SECRET must be at least 16 chars"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  OWNER_EMAIL: z.string().email("OWNER_EMAIL must be a valid email"),
  OWNER_PASSWORD: z.string().min(8, "OWNER_PASSWORD must be at least 8 chars"),
}).refine(
  (data) => data.LLM_DAILY_BUDGET <= data.LLM_PROVIDER_DAILY_CAP,
  {
    message: "LLM_DAILY_BUDGET must not exceed LLM_PROVIDER_DAILY_CAP",
    path: ["LLM_DAILY_BUDGET"],
  }
);

export { envSchema };
export type EnvConfig = z.infer<typeof envSchema>;

function loadAndValidateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`FATAL: Environment validation failed at boot:\n${errorDetails}`);
    process.exit(1);
  }

  // Double-check sandbox hostname guard
  const paypalUrl = new URL(result.data.PAYPAL_BASE_URL);
  if (!paypalUrl.hostname.includes("sandbox")) {
    console.error(`FATAL: Non-sandbox PAYPAL_BASE_URL (${paypalUrl.hostname}) detected. Halting.`);
    process.exit(1);
  }

  return result.data;
}

export const env = loadAndValidateEnv();

