import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "@/db";
import { env } from "@/config/env";

const origins: string[] = [];

if (env.APP_URL) {
  origins.push(env.APP_URL);
}
if (env.BETTER_AUTH_URL) {
  origins.push(env.BETTER_AUTH_URL);
}

if (env.NODE_ENV !== "production") {
  origins.push("http://localhost:3000", "http://127.0.0.1:3000");
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.APP_URL || env.BETTER_AUTH_URL,
  trustedOrigins: Array.from(new Set(origins)),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "mock-google-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "mock-google-client-secret",
      enabled: true,
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID || "mock-microsoft-client-id",
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "mock-microsoft-client-secret",
      enabled: true,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const designated = (env.OWNER_EMAIL || "owner@revenueguardian.local").toLowerCase().trim();
          if (user.email.toLowerCase().trim() !== designated) {
            throw new Error(`Single-owner invariant: only ${designated} is authorized to sign in.`);
          }
          return { data: user };
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
});

