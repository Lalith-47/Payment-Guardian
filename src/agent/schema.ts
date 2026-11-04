import { z } from "zod";

export const AgentProposalSchema = z.object({
  action: z.enum(["retry", "offer", "refund", "escalate", "none"]),
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  message: z.string().min(1, "Message must not be empty"),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1, "Reasoning must not be empty"),
});

export type AgentProposal = z.infer<typeof AgentProposalSchema>;

export interface AgentContext {
  eventId: string;
  eventType: string;
  source: string;
  orderId?: string;
  invoiceId?: string;
  amount?: number;
  currency?: string;
  declineReason?: string;
  customerNote?: string;
  customerEmail?: string;
}

export type AgentResult =
  | {
      status: "SUCCESS";
      proposal: AgentProposal;
      modelUsed: string;
      attempts: number;
    }
  | {
      status: "WAITING_FOR_AI";
      proposal: null;
      error: string;
    };

