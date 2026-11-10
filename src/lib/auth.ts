import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "@/db";
import { env } from "@/config/env";

const trustedOrigins: string[] = [
  "https://payment.lalithdev.tech",
  "https://lalithdev.tech",
  "https://witty-pebble-03bad9f10.4.azurestaticapps.net",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

if (env.APP_URL) {
  trustedOrigins.push(env.APP_URL);
}
if (env.BETTER_AUTH_URL) {
  trustedOrigins.push(env.BETTER_AUTH_URL);
}
if (process.env.NEXT_PUBLIC_APP_URL) {
  trustedOrigins.push(process.env.NEXT_PUBLIC_APP_URL);
}

const baseURL = env.BETTER_AUTH_URL || env.APP_URL || "https://payment.lalithdev.tech";

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
  baseURL,
  trustedOrigins: Array.from(new Set(trustedOrigins)),
  emailAndPassword: {
    enabled: true,
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "microsoft"],
    },
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
          const allowedEmails = new Set([
            designated,
            "owner@revenueguardian.local",
            "dev.lalithkumar@gmail.com",
            ...(process.env.ALLOWED_OWNER_EMAILS
              ? process.env.ALLOWED_OWNER_EMAILS.split(",").map((e) => e.trim().toLowerCase())
              : []),
            ...(process.env.OAUTH_OWNER_EMAIL
              ? [process.env.OAUTH_OWNER_EMAIL.trim().toLowerCase()]
              : []),
          ]);

          const userEmail = (user.email || "").toLowerCase().trim();
          if (!allowedEmails.has(userEmail) && !userEmail.endsWith("@lalithdev.tech")) {
            throw new Error(
              `Single-owner invariant violated: Only designated store owner accounts are authorized to sign in. ` +
                `Your Google/Microsoft account email (${user.email}) does not match authorized owner identities. ` +
                `Update OWNER_EMAIL or ALLOWED_OWNER_EMAILS in .env to authorize this email.`
            );
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

