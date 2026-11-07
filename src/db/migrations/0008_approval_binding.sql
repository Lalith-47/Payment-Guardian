ALTER TABLE "approvals" ADD COLUMN IF NOT EXISTS "payload_hash" text NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "approvals" ADD COLUMN IF NOT EXISTS "token_hash" text;

UPDATE "approvals"
SET "token_hash" = encode(sha256("token"::bytea), 'hex'),
    "payload_hash" = 'LEGACY'
WHERE "token_hash" IS NULL AND "token" IS NOT NULL;

-- Fallback for any rows without token: generate deterministic token_hash from id
UPDATE "approvals"
SET "token_hash" = encode(sha256("id"::bytea), 'hex')
WHERE "token_hash" IS NULL;

ALTER TABLE "approvals" ALTER COLUMN "token_hash" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "approvals_token_hash_unique" ON "approvals" ("token_hash");

-- Store only token_hash: make token nullable and clear plaintext tokens
ALTER TABLE "approvals" ALTER COLUMN "token" DROP NOT NULL;
ALTER TABLE "approvals" DROP CONSTRAINT IF EXISTS "approvals_token_unique";
UPDATE "approvals" SET "token" = NULL;
