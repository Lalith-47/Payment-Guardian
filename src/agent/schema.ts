import { z } from "zod";

export const AgentProposalSchema = z.object({
  action: z.enum(["retry", "offer", "refund", "escalate", "none", "invoice"]),
  amount: z.number().nullish(),
  currency: z.string().nullish(),
  message: z.string().min(1, "Message must not be empty"),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1, "Reasoning must not be empty"),
});

export type AgentProposal = z.infer<typeof AgentProposalSchema>;

export interface AgentContextSnapshot {
  eventId: string;
  eventType: string;
  source: string;
  orderId?: string | null;
  invoiceId?: string | null;
  amount?: number | null;
  currency?: string | null;
  retryCount?: number;
  declineReason?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  customerNote?: string | null;
  customerHistory?: string | null; // Verified past history from DB only; null if none exists
}

export type AgentContext = AgentContextSnapshot;

export interface GroundingValidation {
  isGrounded: boolean;
  flaggedPhrases: string[];
  reason?: string;
}

export type AgentResult =
  | {
      status: "SUCCESS";
      proposal: AgentProposal;
      modelUsed: string;
      attempts: number;
      contextSnapshot: AgentContextSnapshot;
      groundingValidation: GroundingValidation;
    }
  | {
      status: "WAITING_FOR_AI";
      proposal: null;
      error: string;
      contextSnapshot: AgentContextSnapshot;
    };

