import { AgentProposal } from "@/agent/schema";
import { Policy } from "@/db/queries/policies";

export type PolicyDecision = "AUTO" | "NEEDS_APPROVAL" | "BLOCKED";

export interface PolicyEvaluationResult {
  decision: PolicyDecision;
  reason: string;
  ruleTriggered: string;
}

export interface PolicyContext {
  currentRetryCount?: number;
  originalAmount?: number;
  originalCurrency?: string;
  eventSource?: string;
}

/**
 * Pure TypeScript Policy Engine (Zero I/O, deterministic, fail-closed).
 */
export function evaluatePolicy(
  policy: Pick<
    Policy,
    | "currency"
    | "confidenceThreshold"
    | "autoRefundMaxAmount"
    | "autoRetryMaxAttempts"
    | "offerAlternativeMaxDiscountPct"
    | "requireApprovalForActions"
    | "isActive"
  >,
  proposal: AgentProposal | null | undefined,
  context: PolicyContext = {}
): PolicyEvaluationResult {
  // Fail closed rule 1: Missing or invalid proposal
  if (!proposal) {
    return {
      decision: "NEEDS_APPROVAL",
      reason: "Missing or null agent proposal.",
      ruleTriggered: "MISSING_PROPOSAL",
    };
  }

  // Fail closed rule 2: Inactive policy
  if (policy.isActive === false) {
    return {
      decision: "NEEDS_APPROVAL",
      reason: "Store policy is currently inactive.",
      ruleTriggered: "POLICY_INACTIVE",
    };
  }

  const confidenceThreshold = parseFloat(policy.confidenceThreshold?.toString() || "0.80");
  const autoRefundMax = parseFloat(policy.autoRefundMaxAmount?.toString() || "25.00");
  const maxRetries = policy.autoRetryMaxAttempts ?? 2;
  const maxDiscountPct = policy.offerAlternativeMaxDiscountPct ?? 10;
  const requireApprovalList = Array.isArray(policy.requireApprovalForActions)
    ? (policy.requireApprovalForActions as string[])
    : [];

  // Fail closed rule 3: Low confidence below threshold
  if (proposal.confidence < confidenceThreshold) {
    return {
      decision: "NEEDS_APPROVAL",
      reason: `Confidence ${proposal.confidence.toFixed(2)} is below threshold ${confidenceThreshold.toFixed(2)}.`,
      ruleTriggered: "CONFIDENCE_BELOW_THRESHOLD",
    };
  }

  // Fail closed rule 4: Currency mismatch when currency is specified
  if (proposal.currency && proposal.currency.toUpperCase() !== policy.currency.toUpperCase()) {
    return {
      decision: "NEEDS_APPROVAL",
      reason: `Currency mismatch: proposal currency (${proposal.currency}) does not match policy currency (${policy.currency}).`,
      ruleTriggered: "CURRENCY_MISMATCH",
    };
  }

  // Rule 5: Explicit action requires approval per policy configuration
  if (requireApprovalList.includes(proposal.action)) {
    return {
      decision: "NEEDS_APPROVAL",
      reason: `Action '${proposal.action}' is explicitly configured to require human approval.`,
      ruleTriggered: "ACTION_REQUIRES_APPROVAL",
    };
  }

  // Action-specific rule evaluation
  switch (proposal.action) {
    case "none":
      return {
        decision: "AUTO",
        reason: "No money or mutating action proposed.",
        ruleTriggered: "SAFE_NOOP",
      };

    case "escalate":
      return {
        decision: "NEEDS_APPROVAL",
        reason: "Escalation requested by agent for manual owner review.",
        ruleTriggered: "ESCALATION_MANUAL_REVIEW",
      };

    case "retry": {
      const currentRetries = context.currentRetryCount ?? 0;
      if (currentRetries >= maxRetries) {
        return {
          decision: "BLOCKED",
          reason: `Max retry attempts reached (${currentRetries}/${maxRetries}). Further automated retries blocked.`,
          ruleTriggered: "MAX_RETRIES_EXCEEDED",
        };
      }
      return {
        decision: "AUTO",
        reason: `Retry count (${currentRetries}/${maxRetries}) is within policy limits and confidence meets threshold.`,
        ruleTriggered: "AUTO_RETRY_ALLOWED",
      };
    }

    case "refund": {
      if (proposal.amount == null || isNaN(proposal.amount) || proposal.amount <= 0) {
        return {
          decision: "NEEDS_APPROVAL",
          reason: "Refund proposed without a valid positive amount.",
          ruleTriggered: "INVALID_REFUND_AMOUNT",
        };
      }

      if (proposal.amount > autoRefundMax) {
        return {
          decision: "NEEDS_APPROVAL",
          reason: `Proposed refund amount ($${proposal.amount.toFixed(2)}) exceeds auto-refund limit ($${autoRefundMax.toFixed(2)}).`,
          ruleTriggered: "AMOUNT_EXCEEDS_AUTO_REFUND_LIMIT",
        };
      }

      return {
        decision: "AUTO",
        reason: `Refund amount ($${proposal.amount.toFixed(2)}) is within auto-refund limit ($${autoRefundMax.toFixed(2)}).`,
        ruleTriggered: "AUTO_REFUND_APPROVED",
      };
    }

    case "offer": {
      if (proposal.amount != null && context.originalAmount != null && context.originalAmount > 0) {
        const discountAmount = context.originalAmount - proposal.amount;
        const discountPct = (discountAmount / context.originalAmount) * 100;
        if (discountPct > maxDiscountPct) {
          return {
            decision: "NEEDS_APPROVAL",
            reason: `Proposed discount (${discountPct.toFixed(1)}%) exceeds maximum allowable discount (${maxDiscountPct}%).`,
            ruleTriggered: "DISCOUNT_EXCEEDS_LIMIT",
          };
        }
      }

      return {
        decision: "AUTO",
        reason: "Offer terms are within policy discount thresholds.",
        ruleTriggered: "AUTO_OFFER_APPROVED",
      };
    }

    default:
      return {
        decision: "NEEDS_APPROVAL",
        reason: `Unrecognized action: ${(proposal as { action?: string }).action}.`,
        ruleTriggered: "UNRECOGNIZED_ACTION",
      };
  }
}

