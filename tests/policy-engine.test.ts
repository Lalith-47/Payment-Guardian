import { describe, it, expect } from "vitest";
import { evaluatePolicy } from "@/policy/engine";
import { AgentProposal } from "@/agent/schema";

describe("Policy Engine - Pure TypeScript & Boundaries (Deliverable 6)", () => {
  const basePolicy = {
    currency: "USD",
    confidenceThreshold: "0.80",
    autoRefundMaxAmount: "25.00",
    autoRetryMaxAttempts: 2,
    offerAlternativeMaxDiscountPct: 10,
    requireApprovalForActions: ["escalate"],
    isActive: true,
  };

  describe("Fail-Closed Rules & Boundary Thresholds", () => {
    it("1. Missing proposal fails closed to NEEDS_APPROVAL", () => {
      const res = evaluatePolicy(basePolicy, null);
      expect(res.decision).toBe("NEEDS_APPROVAL");
      expect(res.ruleTriggered).toBe("MISSING_PROPOSAL");
    });

    it("2. Inactive policy fails closed to NEEDS_APPROVAL", () => {
      const res = evaluatePolicy(
        { ...basePolicy, isActive: false },
        {
          action: "retry",
          amount: null,
          currency: "USD",
          message: "test",
          confidence: 0.95,
          reasoning: "test",
        }
      );
      expect(res.decision).toBe("NEEDS_APPROVAL");
      expect(res.ruleTriggered).toBe("POLICY_INACTIVE");
    });

    it("3. Confidence boundary: 0.79 (below) -> NEEDS_APPROVAL", () => {
      const proposal: AgentProposal = {
        action: "retry",
        amount: null,
        currency: "USD",
        message: "Retry payment",
        confidence: 0.79,
        reasoning: "Moderate confidence",
      };
      const res = evaluatePolicy(basePolicy, proposal);
      expect(res.decision).toBe("NEEDS_APPROVAL");
      expect(res.ruleTriggered).toBe("CONFIDENCE_BELOW_THRESHOLD");
    });

    it("4. Confidence boundary: 0.80 (exact threshold) -> AUTO", () => {
      const proposal: AgentProposal = {
        action: "retry",
        amount: null,
        currency: "USD",
        message: "Retry payment",
        confidence: 0.8,
        reasoning: "Threshold met",
      };
      const res = evaluatePolicy(basePolicy, proposal);
      expect(res.decision).toBe("AUTO");
      expect(res.ruleTriggered).toBe("AUTO_RETRY_ALLOWED");
    });

    it("5. Confidence boundary: 0.81 (above) -> AUTO", () => {
      const proposal: AgentProposal = {
        action: "retry",
        amount: null,
        currency: "USD",
        message: "Retry payment",
        confidence: 0.81,
        reasoning: "High confidence",
      };
      const res = evaluatePolicy(basePolicy, proposal);
      expect(res.decision).toBe("AUTO");
    });

    it("6. Currency mismatch fails closed to NEEDS_APPROVAL", () => {
      const proposal: AgentProposal = {
        action: "refund",
        amount: 10.0,
        currency: "EUR", // Policy is USD
        message: "Refund €10",
        confidence: 0.95,
        reasoning: "Valid refund but foreign currency",
      };
      const res = evaluatePolicy(basePolicy, proposal);
      expect(res.decision).toBe("NEEDS_APPROVAL");
      expect(res.ruleTriggered).toBe("CURRENCY_MISMATCH");
    });
  });

  describe("Refund Actions & Financial Boundaries", () => {
    it("7. Refund amount boundary: $24.99 (below limit) -> AUTO", () => {
      const proposal: AgentProposal = {
        action: "refund",
        amount: 24.99,
        currency: "USD",
        message: "Refund $24.99",
        confidence: 0.9,
        reasoning: "Small dispute refund",
      };
      const res = evaluatePolicy(basePolicy, proposal);
      expect(res.decision).toBe("AUTO");
      expect(res.ruleTriggered).toBe("AUTO_REFUND_APPROVED");
    });

    it("8. Refund amount boundary: $25.00 (exact limit) -> AUTO", () => {
      const proposal: AgentProposal = {
        action: "refund",
        amount: 25.0,
        currency: "USD",
        message: "Refund $25.00",
        confidence: 0.9,
        reasoning: "Exact threshold refund",
      };
      const res = evaluatePolicy(basePolicy, proposal);
      expect(res.decision).toBe("AUTO");
      expect(res.ruleTriggered).toBe("AUTO_REFUND_APPROVED");
    });

    it("9. Refund amount boundary: $25.01 (over limit) -> NEEDS_APPROVAL", () => {
      const proposal: AgentProposal = {
        action: "refund",
        amount: 25.01,
        currency: "USD",
        message: "Refund $25.01",
        confidence: 0.9,
        reasoning: "Exceeds auto-refund limit by 1 cent",
      };
      const res = evaluatePolicy(basePolicy, proposal);
      expect(res.decision).toBe("NEEDS_APPROVAL");
      expect(res.ruleTriggered).toBe("AMOUNT_EXCEEDS_AUTO_REFUND_LIMIT");
    });

    it("10. Refund with null/zero/negative amount -> NEEDS_APPROVAL", () => {
      const nullAmount: AgentProposal = {
        action: "refund",
        amount: null,
        currency: "USD",
        message: "Refund",
        confidence: 0.9,
        reasoning: "Missing amount",
      };
      expect(evaluatePolicy(basePolicy, nullAmount).decision).toBe("NEEDS_APPROVAL");

      const zeroAmount: AgentProposal = {
        action: "refund",
        amount: 0,
        currency: "USD",
        message: "Refund 0",
        confidence: 0.9,
        reasoning: "Zero amount",
      };
      expect(evaluatePolicy(basePolicy, zeroAmount).decision).toBe("NEEDS_APPROVAL");
    });
  });

  describe("Retry & Retry Limits", () => {
    it("11. Retry attempt 0/2 -> AUTO", () => {
      const proposal: AgentProposal = {
        action: "retry",
        amount: null,
        currency: "USD",
        message: "Retry",
        confidence: 0.9,
        reasoning: "First attempt",
      };
      const res = evaluatePolicy(basePolicy, proposal, { currentRetryCount: 0 });
      expect(res.decision).toBe("AUTO");
    });

    it("12. Retry attempt 1/2 -> AUTO", () => {
      const proposal: AgentProposal = {
        action: "retry",
        amount: null,
        currency: "USD",
        message: "Retry",
        confidence: 0.9,
        reasoning: "Second attempt",
      };
      const res = evaluatePolicy(basePolicy, proposal, { currentRetryCount: 1 });
      expect(res.decision).toBe("AUTO");
    });

    it("13. Retry attempt 2/2 (exhausted limit) -> BLOCKED", () => {
      const proposal: AgentProposal = {
        action: "retry",
        amount: null,
        currency: "USD",
        message: "Retry",
        confidence: 0.9,
        reasoning: "Third attempt",
      };
      const res = evaluatePolicy(basePolicy, proposal, { currentRetryCount: 2 });
      expect(res.decision).toBe("BLOCKED");
      expect(res.ruleTriggered).toBe("MAX_RETRIES_EXCEEDED");
    });
  });

  describe("Offers & Discounts", () => {
    it("14. Offer discount <= 10% ($10 off $100) -> AUTO", () => {
      const proposal: AgentProposal = {
        action: "offer",
        amount: 90.0,
        currency: "USD",
        message: "10% off",
        confidence: 0.9,
        reasoning: "Within discount limit",
      };
      const res = evaluatePolicy(basePolicy, proposal, { originalAmount: 100 });
      expect(res.decision).toBe("AUTO");
      expect(res.ruleTriggered).toBe("AUTO_OFFER_APPROVED");
    });

    it("15. Offer discount > 10% ($15 off $100) -> NEEDS_APPROVAL", () => {
      const proposal: AgentProposal = {
        action: "offer",
        amount: 85.0,
        currency: "USD",
        message: "15% off",
        confidence: 0.9,
        reasoning: "Exceeds discount limit",
      };
      const res = evaluatePolicy(basePolicy, proposal, { originalAmount: 100 });
      expect(res.decision).toBe("NEEDS_APPROVAL");
      expect(res.ruleTriggered).toBe("DISCOUNT_EXCEEDS_LIMIT");
    });
  });

  describe("Escalate & Policy Action Overrides", () => {
    it("16. Escalate proposal -> NEEDS_APPROVAL", () => {
      const proposal: AgentProposal = {
        action: "escalate",
        amount: null,
        currency: null,
        message: "Flagging for owner review",
        confidence: 0.95,
        reasoning: "Suspicious pattern",
      };
      const res = evaluatePolicy(basePolicy, proposal);
      expect(res.decision).toBe("NEEDS_APPROVAL");
    });

    it("17. Policy with requireApprovalForActions = ['refund'] overrides under-limit refund", () => {
      const strictPolicy = {
        ...basePolicy,
        requireApprovalForActions: ["refund", "escalate"],
      };
      const proposal: AgentProposal = {
        action: "refund",
        amount: 5.0,
        currency: "USD",
        message: "Small refund",
        confidence: 0.99,
        reasoning: "Clear overcharge",
      };
      const res = evaluatePolicy(strictPolicy, proposal);
      expect(res.decision).toBe("NEEDS_APPROVAL");
      expect(res.ruleTriggered).toBe("ACTION_REQUIRES_APPROVAL");
    });
  });
});

