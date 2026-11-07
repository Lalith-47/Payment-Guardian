import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { env } from "@/config/env";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("seed-owner");

export async function seedOwner() {
  const existingUsers = await db.select().from(user);
  if (existingUsers.length > 0) {
    log.info({ count: existingUsers.length }, "Owner user already exists in database; skipping seed");
    return;
  }

  log.info({ email: env.OWNER_EMAIL }, "Seeding initial store owner from environment credentials");
  try {
    await auth.api.signUpEmail({
      body: {
        email: env.OWNER_EMAIL,
        password: env.OWNER_PASSWORD,
        name: "Store Owner",
      },
    });
    log.info("Store owner successfully created in database from environment credentials");
  } catch (err) {
    log.error({ err }, "Failed to seed owner user");
    throw err;
  }
}

if (process.argv[1]?.endsWith("seed-owner.ts") || process.argv[1]?.endsWith("seed-owner.js")) {
  seedOwner()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
