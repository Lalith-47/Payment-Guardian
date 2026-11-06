import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  serial,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ==========================================
// 1. better-auth Single-Owner Auth Tables
// ==========================================
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ==========================================
// 2. Policies Table
// ==========================================
export const policies = pgTable("policies", {
  id: text("id").primaryKey(), // e.g. 'pol_default'
  name: text("name").notNull(),
  description: text("description"),
  currency: text("currency").notNull().default("USD"),
  autoRetryMaxAttempts: integer("auto_retry_max_attempts").notNull().default(2),
  autoRetryMinIntervalHours: integer("auto_retry_min_interval_hours").notNull().default(4),
  autoRefundMaxAmount: numeric("auto_refund_max_amount", { precision: 10, scale: 2 }).notNull().default("25.00"),
  offerAlternativeMaxDiscountPct: integer("offer_alternative_max_discount_pct").notNull().default(10),
  confidenceThreshold: numeric("confidence_threshold", { precision: 3, scale: 2 }).notNull().default("0.80"),
  requireApprovalForActions: jsonb("require_approval_for_actions").notNull().default(["escalate"]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ==========================================
// 3. Events Table
// ==========================================
export const events = pgTable("events", {
  id: text("id").primaryKey(), // e.g. 'evt_...'
  type: text("type").notNull(), // 'payment.capture_declined', 'CHECKOUT.ORDER.APPROVED', etc.
  source: text("source").notNull(), // 'paypal_capture_route', 'paypal_webhook', 'polling_reconciler', 'sandbox_negative_testing'
  externalId: text("external_id"), // PayPal order ID / capture ID / invoice ID
  status: text("status").notNull().default("RECEIVED"), // RECEIVED, RULE_FILTERED, PROPOSED, POLICY_EVALUATED, WAITING_FOR_APPROVAL, WAITING_FOR_AI, EXECUTED, COMPLETED, REJECTED, FAILED
  payload: jsonb("payload").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ==========================================
// 4. Proposals (Agent LLM output)
// ==========================================
export const proposals = pgTable("proposals", {
  id: text("id").primaryKey(), // 'prop_...'
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // 'retry' | 'offer' | 'refund' | 'escalate' | 'none'
  amount: numeric("amount", { precision: 10, scale: 2 }),
  currency: text("currency"),
  message: text("message").notNull(),
  confidence: numeric("confidence", { precision: 3, scale: 2 }).notNull(),
  reasoning: text("reasoning").notNull(),
  modelUsed: text("model_used").notNull(),
  attempts: integer("attempts").notNull().default(1),
  contextSnapshot: jsonb("context_snapshot"), // Structured context snapshot stored with each proposal
  rawResponse: jsonb("raw_response"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ==========================================
// 5. Actions (Executed PayPal Calls)
// ==========================================
export const actions = pgTable("actions", {
  id: text("id").primaryKey(), // 'act_...'
  eventId: text("event_id").references(() => events.id),
  proposalId: text("proposal_id").references(() => proposals.id),
  approvalId: text("approval_id"),
  actionType: text("action_type").notNull(), // 'capture_retry', 'offer_sent', 'refund_issued', 'escalated', 'none'
  idempotencyKey: text("idempotency_key").notNull().unique(), // PayPal-Request-Id
  paypalEndpoint: text("paypal_endpoint").notNull(),
  paypalMethod: text("paypal_method").notNull(),
  requestSummary: jsonb("request_summary").notNull(),
  responseSummary: jsonb("response_summary"),
  status: text("status").notNull(), // 'PENDING' | 'SUCCESS' | 'FAILED' | 'DEAD_LETTER'
  statusCode: integer("status_code"),
  errorMessage: text("error_message"),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
});

// ==========================================
// 6. Approvals (Single-use expiring tokens)
// ==========================================
export const approvals = pgTable("approvals", {
  id: text("id").primaryKey(), // 'appr_...'
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  proposalId: text("proposal_id")
    .notNull()
    .references(() => proposals.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("PENDING"), // 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedBy: text("decided_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ==========================================
// 7. Audit Log (Append-only)
// ==========================================
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  source: text("source").notNull(), // 'paypal_capture_route', 'webhook', 'policy_engine', 'executor', 'owner_action', 'sandbox_negative_testing'
  eventType: text("event_type").notNull(),
  eventId: text("event_id"),
  actor: text("actor").notNull(), // 'system', 'policy_engine', 'agent', 'owner', 'sandbox_test'
  action: text("action").notNull(),
  details: jsonb("details").notNull(),
  metadata: jsonb("metadata"),
});

// ==========================================
// 8. Webhook Deliveries
// ==========================================
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: serial("id").primaryKey(),
    transmissionId: text("transmission_id").notNull(),
    eventId: text("event_id").notNull(), // PayPal event ID
    eventType: text("event_type").notNull(),
    summary: text("summary"),
    resourceType: text("resource_type"),
    rawBody: text("raw_body").notNull(),
    headers: jsonb("headers").notNull(),
    signatureStatus: text("signature_status").notNull(), // 'VALID', 'INVALID', 'TAMPERED', 'STALE_TIMESTAMP', 'BAD_CERT_HOST'
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("uniq_webhook_transmission_event").on(table.transmissionId, table.eventId),
  ]
);

// ==========================================
// 9. PayPal Orders
// ==========================================
export const paypalOrders = pgTable("paypal_orders", {
  id: text("id").primaryKey(), // PayPal Order ID
  status: text("status").notNull(), // 'CREATED', 'SAVED', 'APPROVED', 'VOIDED', 'COMPLETED', 'PAYER_ACTION_REQUIRED'
  intent: text("intent").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  approvalLink: text("approval_link"),
  payerEmail: text("payer_email"),
  rawPayload: jsonb("raw_payload").notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ==========================================
// 10. PayPal Invoices
// ==========================================
export const paypalInvoices = pgTable("paypal_invoices", {
  id: text("id").primaryKey(), // PayPal Invoice ID
  status: text("status").notNull(), // 'DRAFT', 'SENT', 'SCHEDULED', 'PAID', 'MARKED_AS_PAID', 'CANCELLED', 'REFUNDED', 'PARTIALLY_PAID', 'PAYMENT_PENDING'
  invoiceNumber: text("invoice_number"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  payerViewUrl: text("payer_view_url"),
  rawPayload: jsonb("raw_payload").notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
