import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers['paypal-auth-assertion']",
      "password",
      "client_secret",
      "PAYPAL_CLIENT_SECRET",
      "OPENROUTER_API_KEY",
      "LLM_API_KEY_2",
      "BETTER_AUTH_SECRET",
      "token",
      "access_token",
      "refresh_token",
      "*.password",
      "*.secret",
      "*.apiKey",
      "*.key",
    ],
    censor: "[REDACTED]",
  },
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid,hostname",
          translateTime: "SYS:standard",
        },
      }
    : undefined,
});

export function createChildLogger(moduleName: string, meta?: Record<string, unknown>) {
  return logger.child({ module: moduleName, ...meta });
}
