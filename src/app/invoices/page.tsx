"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { AgGridReact } from "ag-grid-react";
import { ColDef, RowClickedEvent } from "ag-grid-community";
import {
  Receipt,
  RefreshCw,
  Plus,
  Sparkles,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldAlert,
  X,
  FileText,
  User,
  Mail,
  Calendar,
  Send,
  ArrowRight,
  ChevronDown,
} from "lucide-react";

interface InvoiceItem {
  id: string;
  status: string;
  invoiceNumber: string | null;
  amount: string;
  currency: string;
  recipientEmail: string;
  customerName: string | null;
  dueDays: number | null;
  items: Array<{ description: string; quantity: number; unitPrice: number }> | null;
  note: string | null;
  draftMessage: string | null;
  confirmationSource: string | null;
  payerViewUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InvoiceDetail {
  invoice: InvoiceItem;
  timeline: Array<{
    id: number;
    timestamp: string;
    actor: string;
    action: string;
    details: Record<string, unknown>;
  }>;
}

interface ExtractedFormData {
  customerName: string;
  customerEmail: string;
  amount: number | "";
  currency: string;
  dueDays: number;
  note: string;
  lineItemDescription: string;
}

function InvoicesContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("id");

  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(initialId);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Create Invoice Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [extractionReasoning, setExtractionReasoning] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{
    type: "success" | "warning" | "error";
    text: string;
    approvalId?: string;
  } | null>(null);

  const [formData, setFormData] = useState<ExtractedFormData>({
    customerName: "",
    customerEmail: "",
    amount: "",
    currency: "USD",
    dueDays: 15,
    note: "",
    lineItemDescription: "",
  });

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/invoices");
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
      }
    } catch {
      // Keep existing
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (id: string) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`/api/invoices/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDetail(data);
      }
    } catch {
      // Keep existing
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    if (selectedInvoiceId) {
      fetchDetail(selectedInvoiceId);
    } else {
      setDetail(null);
    }
  }, [selectedInvoiceId]);

  const handleExtract = async () => {
    if (!promptText.trim()) return;
    setExtracting(true);
    setActionNotice(null);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText.trim(),
          extractOnly: true,
        }),
      });

      const data = await res.json();
      if (data.extracted) {
        setFormData({
          customerName: data.extracted.customerName || "",
          customerEmail: data.extracted.customerEmail || "",
          amount: data.extracted.amount ?? "",
          currency: data.extracted.currency || "USD",
          dueDays: data.extracted.dueDays || 15,
          note: data.extracted.note || "",
          lineItemDescription: data.extracted.lineItems?.[0]?.description || data.extracted.note || "",
        });
        setMissingFields(data.missingFields || []);
        setExtractionReasoning(data.extracted.reasoning || null);
        if (data.missingFields && data.missingFields.length > 0) {
          setActionNotice({
            type: "warning",
            text: `AI extracted partial fields. Missing: ${data.missingFields.join(", ")}. Please complete below.`,
          });
        }
      } else if (data.error) {
        setActionNotice({ type: "error", text: data.error });
      }
    } catch (err) {
      setActionNotice({ type: "error", text: (err as Error).message });
    } finally {
      setExtracting(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setActionNotice(null);

    try {
      const payload = {
        customerName: formData.customerName.trim(),
        customerEmail: formData.customerEmail.trim(),
        amount: typeof formData.amount === "number" ? formData.amount : parseFloat(formData.amount as string) || 0,
        currency: formData.currency,
        dueDays: formData.dueDays,
        note: formData.note.trim() || undefined,
        lineItems: formData.lineItemDescription
          ? [
              {
                description: formData.lineItemDescription.trim(),
                quantity: 1,
                unitPrice: typeof formData.amount === "number" ? formData.amount : parseFloat(formData.amount as string) || 0,
              },
            ]
          : undefined,
      };

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok && res.status !== 202) {
        throw new Error(data.error || "Failed to process invoice request");
      }

      if (data.decision === "AUTO") {
        setActionNotice({
          type: "success",
          text: `Invoice #${data.invoiceNumber || data.invoiceId} automatically created and dispatched via Executor!`,
        });
        await fetchInvoices();
        if (data.invoiceId) {
          setSelectedInvoiceId(data.invoiceId);
        }
        setIsModalOpen(false);
      } else if (data.decision === "NEEDS_APPROVAL") {
        setActionNotice({
          type: "warning",
          text: `Invoice exceeds auto-send limits (${data.ruleTriggered}). Approval request dispatched to Approvals Inbox!`,
          approvalId: data.approvalId,
        });
        await fetchInvoices();
        setIsModalOpen(false);
      }
    } catch (err) {
      setActionNotice({ type: "error", text: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const columnDefs = useMemo<ColDef<InvoiceItem>[]>(
    () => [
      {
        headerName: "Invoice #",
        field: "invoiceNumber",
        width: 140,
        cellRenderer: (params: { value: string | null; data?: InvoiceItem }) => (
          <span className="font-mono text-accent font-medium">
            {params.value || params.data?.id.slice(0, 12) || "—"}
          </span>
        ),
      },
      {
        headerName: "Recipient",
        field: "customerName",
        width: 160,
        cellRenderer: (params: { value: string | null; data?: InvoiceItem }) => (
          <div className="flex flex-col justify-center h-full">
            <span className="text-board-type font-medium">{params.value || "Customer"}</span>
            <span className="text-[11px] text-muted truncate">{params.data?.recipientEmail}</span>
          </div>
        ),
      },
      {
        headerName: "Amount",
        width: 120,
        valueGetter: (params) =>
          params.data ? `${params.data.currency} ${parseFloat(params.data.amount).toFixed(2)}` : "—",
        cellRenderer: (params: { value: string }) => (
          <span className="font-mono text-board-type font-semibold">{params.value}</span>
        ),
      },
      {
        headerName: "Status",
        field: "status",
        width: 180,
        cellRenderer: (params: { value: string; data?: InvoiceItem }) => {
          const val = params.value || "DRAFT";
          if (val === "PAID_CONFIRMED_BY_POLLING") {
            return (
              <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold bg-success/15 text-success border border-success/30">
                PAID (Polling Confirmed)
              </span>
            );
          }
          if (val === "PAID") {
            return (
              <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold bg-success/15 text-success border border-success/30">
                PAID (Webhook)
              </span>
            );
          }
          if (val === "SENT") {
            return (
              <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold bg-info/15 text-info border border-info/30">
                SENT
              </span>
            );
          }
          if (val === "CANCELLED") {
            return (
              <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold bg-error/15 text-error border border-error/30">
                CANCELLED
              </span>
            );
          }
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold bg-ink text-board-type border border-rule-2">
              {val}
            </span>
          );
        },
      },
      {
        headerName: "Confirmation Source",
        field: "confirmationSource",
        width: 160,
        cellRenderer: (params: { value: string | null }) => (
          <span className="text-muted font-mono text-[11px]">{params.value || "executor"}</span>
        ),
      },
      {
        headerName: "Due Window",
        field: "dueDays",
        width: 120,
        valueFormatter: (params) => (params.value ? `${params.value} days` : "15 days"),
      },
      {
        headerName: "Created",
        field: "createdAt",
        width: 170,
        valueFormatter: (params) => (params.value ? new Date(params.value).toLocaleString() : "—"),
      },
    ],
    []
  );

  const onRowClicked = (e: RowClickedEvent<InvoiceItem>) => {
    if (e.data?.id) {
      setSelectedInvoiceId(e.data.id);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header and Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-board-type flex items-center gap-2">
              <Receipt className="h-5 w-5 text-accent" />
              <span>PayPal Invoicing Grid</span>
            </h1>
            <p className="mt-1 text-xs text-muted">
              Audited invoice issuance with AI extraction, guardrail policy enforcement, and honest state synchronization.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setIsModalOpen(true);
                setActionNotice(null);
                setMissingFields([]);
              }}
              className="inline-flex items-center space-x-1.5 rounded-input bg-accent px-3.5 py-2 text-xs font-semibold text-accent-ink hover:opacity-90 active:opacity-100 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-accent"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Invoice with AI</span>
            </button>
            <button
              onClick={fetchInvoices}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 rounded-input border border-rule-2 bg-ink/60 px-3 py-2 text-xs font-semibold text-board-type hover:bg-ink transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-accent"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "motion-safe:animate-spin" : ""}`} />
              <span>Refresh Invoices</span>
            </button>
          </div>
        </div>

        {/* Global Action Banner */}
        {actionNotice && (
          <div
            className={`rounded-input p-3.5 text-xs flex items-center justify-between border ${
              actionNotice.type === "success"
                ? "bg-success/15 border-success/30 text-success"
                : actionNotice.type === "warning"
                ? "bg-warning/15 border-warning/30 text-warning"
                : "bg-error/15 border-error/30 text-error"
            }`}
          >
            <div className="flex items-center space-x-2">
              {actionNotice.type === "success" ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-success" />
              ) : actionNotice.type === "warning" ? (
                <ShieldAlert className="h-4 w-4 shrink-0 text-warning" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-error" />
              )}
              <span>{actionNotice.text}</span>
            </div>
            {actionNotice.approvalId && (
              <Link
                href={`/approvals`}
                className="inline-flex items-center space-x-1 text-xs font-semibold underline text-warning hover:opacity-80"
              >
                <span>Go to Approvals</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        )}

        {/* Main Grid & Side Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Invoices AG Grid */}
          <div className={selectedInvoiceId ? "lg:col-span-7" : "lg:col-span-12"}>
            <div className="rounded-card border border-rule-2 bg-ink-2 p-4 shadow-card space-y-3">
              <div className="flex items-center justify-between text-xs text-muted pb-2 border-b border-rule-2">
                <span>{invoices.length} Invoices Tracked</span>
                <span>Click an invoice to inspect audit trail and state timeline</span>
              </div>
              <div className="ag-theme-quartz-dark w-full h-[520px] rounded-input overflow-hidden">
                <AgGridReact<InvoiceItem>
                  rowData={invoices}
                  columnDefs={columnDefs}
                  rowSelection={"single"}
                  onRowClicked={onRowClicked}
                  pagination={true}
                  paginationPageSize={15}
                  animateRows={false}
                />
              </div>
            </div>
          </div>

          {/* Side Detail Panel */}
          {selectedInvoiceId && (
            <div className="lg:col-span-5 rounded-card border border-rule-2 bg-ink-2 p-5 shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-rule-2 pb-3">
                <div className="flex items-center space-x-2">
                  <Receipt className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold text-board-type">Invoice Audit Detail</h2>
                </div>
                <button
                  onClick={() => setSelectedInvoiceId(null)}
                  className="text-muted hover:text-board-type p-1 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-accent rounded-input"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {loadingDetail ? (
                <div className="p-8 text-center text-xs text-muted">Loading invoice timeline…</div>
              ) : !detail ? (
                <div className="p-8 text-center text-xs text-muted">Invoice details not found.</div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 text-xs">
                  {/* Summary Card */}
                  <div className="rounded-input border border-rule-2 bg-ink/40 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-accent font-semibold">{detail.invoice.id}</span>
                      <span className="rounded-input bg-ink px-2 py-0.5 text-[11px] font-medium text-board-type">
                        {detail.invoice.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                      <div>
                        <span className="text-muted block">Recipient:</span>
                        <span className="text-board-type font-medium">{detail.invoice.customerName || "Customer"}</span>
                      </div>
                      <div>
                        <span className="text-muted block">Email:</span>
                        <span className="text-board-type font-mono">{detail.invoice.recipientEmail}</span>
                      </div>
                      <div>
                        <span className="text-muted block">Total Amount:</span>
                        <span className="text-board-type font-semibold font-mono">
                          {detail.invoice.currency} {parseFloat(detail.invoice.amount).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted block">Confirmation Source:</span>
                        <span className="text-board-type font-mono">{detail.invoice.confirmationSource || "executor"}</span>
                      </div>
                    </div>

                    {detail.invoice.payerViewUrl && (
                      <div className="pt-2">
                        <a
                          href={detail.invoice.payerViewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1.5 text-accent hover:underline text-[11px]"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Open PayPal Sandbox Payment View</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Customer-Facing Text Stored as Draft Only */}
                  <div className="rounded-input border border-rule-2 bg-ink/50 p-3 space-y-1.5">
                    <span className="text-[11px] font-semibold text-muted block">
                      Customer-facing message (draft only)
                    </span>
                    <p className="text-board-type italic bg-ink/40 p-2 rounded-input border border-rule-2">
                      "{detail.invoice.draftMessage || detail.invoice.note || "No customer message attached."}"
                    </p>
                  </div>

                  {/* State Transition Timeline */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-board-type flex items-center space-x-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted" />
                      <span>Audit Transition Timeline</span>
                    </h3>

                    {detail.timeline.length === 0 ? (
                      <p className="text-xs text-muted">No timeline entries recorded yet.</p>
                    ) : (
                      <div className="space-y-2 border-l-2 border-rule-2 pl-3 ml-1">
                        {detail.timeline.map((entry) => (
                          <div key={entry.id} className="text-[11px] space-y-0.5">
                            <div className="flex items-center justify-between text-muted">
                              <span className="font-semibold text-board-type">{entry.action}</span>
                              <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-muted">
                              Actor: <span className="font-mono text-board-type">{entry.actor}</span>
                            </p>
                            {Boolean(entry.details?.from) && (
                              <p className="text-muted text-[11px]">
                                Transition: {String(entry.details.from)} → {String(entry.details.to)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create Invoice Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4 overflow-y-auto">
            <div className="w-full max-w-xl rounded-card border border-rule-2 bg-ink-2 p-6 shadow-[0_20px_60px_-20px_rgb(0,0,0/0.5)] space-y-4 my-8">
              <div className="flex items-center justify-between border-b border-rule-2 pb-3">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold text-board-type">Issue Invoice with AI Extraction</h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-muted hover:text-board-type p-1 rounded-input"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Natural language extraction prompt */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-board-type">
                  Natural Language Prompt (One Model Call)
                </label>
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="e.g. invoice Acme Corp $400 for website revamp, due in 15 days"
                    className="block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-xs text-board-type placeholder-muted focus:border-focus focus:outline-none"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-muted">
                    Extracts customer name, email, amount, currency, due days, and notes. Missing fields returned null.
                  </span>
                  <button
                    type="button"
                    onClick={handleExtract}
                    disabled={extracting || !promptText.trim()}
                    className="inline-flex items-center space-x-1.5 rounded-input bg-accent/20 border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/30 disabled:opacity-50 transition-colors"
                  >
                    <Sparkles className={`h-3 w-3 ${extracting ? "motion-safe:animate-spin" : ""}`} />
                    <span>{extracting ? "Extracting..." : "Extract with AI"}</span>
                  </button>
                </div>
              </div>

              {extractionReasoning && (
                <div className="rounded-input border border-rule-2 bg-ink/60 p-2.5 text-[11px] text-muted space-y-1">
                  <span className="font-semibold text-board-type">Model Reasoning:</span>
                  <p>{extractionReasoning}</p>
                </div>
              )}

              {/* Form Fields */}
              <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2 border-t border-rule-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-board-type flex items-center justify-between">
                      <span>Customer Name</span>
                      {missingFields.includes("customerName") && (
                        <span className="text-[10px] text-warning">Required</span>
                      )}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      placeholder="Acme Corp"
                      className={`mt-1 block w-full rounded-input border ${
                        missingFields.includes("customerName") ? "border-warning" : "border-rule-2"
                      } bg-ink px-3 py-2 text-xs text-board-type focus:border-focus focus:outline-none`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-board-type flex items-center justify-between">
                      <span>Customer Email</span>
                      {missingFields.includes("customerEmail") && (
                        <span className="text-[10px] text-warning">Required</span>
                      )}
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.customerEmail}
                      onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                      placeholder="client@example.com"
                      className={`mt-1 block w-full rounded-input border ${
                        missingFields.includes("customerEmail") ? "border-warning" : "border-rule-2"
                      } bg-ink px-3 py-2 text-xs text-board-type focus:border-focus focus:outline-none`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-board-type flex items-center justify-between">
                      <span>Amount</span>
                      {missingFields.includes("amount") && (
                        <span className="text-[10px] text-warning">Required</span>
                      )}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          amount: e.target.value === "" ? "" : parseFloat(e.target.value),
                        })
                      }
                      placeholder="400.00"
                      className={`mt-1 block w-full rounded-input border ${
                        missingFields.includes("amount") ? "border-warning" : "border-rule-2"
                      } bg-ink px-3 py-2 text-xs text-board-type focus:border-focus focus:outline-none`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-board-type">Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="mt-1 block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-xs text-board-type focus:border-focus focus:outline-none"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD ($)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-board-type">Due Days</label>
                    <input
                      type="number"
                      min="1"
                      max="90"
                      required
                      value={formData.dueDays}
                      onChange={(e) => setFormData({ ...formData, dueDays: parseInt(e.target.value, 10) || 15 })}
                      className="mt-1 block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-xs text-board-type focus:border-focus focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-board-type">Line Item Description</label>
                  <input
                    type="text"
                    value={formData.lineItemDescription}
                    onChange={(e) => setFormData({ ...formData, lineItemDescription: e.target.value })}
                    placeholder="e.g. Logo design & brand strategy"
                    className="mt-1 block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-xs text-board-type focus:border-focus focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-board-type">Customer Note (Stored as Draft)</label>
                  <input
                    type="text"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="e.g. Thank you for your business!"
                    className="mt-1 block w-full rounded-input border border-rule-2 bg-ink px-3 py-2 text-xs text-board-type focus:border-focus focus:outline-none"
                  />
                </div>

                {/* Policy Decision Preview */}
                <div className="rounded-input border border-rule-2 bg-ink/40 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Guardrail Policy Preview:</span>
                    <span
                      className={`font-semibold ${
                        typeof formData.amount === "number" && formData.amount > 500
                          ? "text-warning"
                          : "text-success"
                      }`}
                    >
                      {typeof formData.amount === "number" && formData.amount > 500
                        ? "NEEDS_APPROVAL (> $500 threshold)"
                        : "AUTO (Direct send via Executor)"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted">
                    Under $500 auto-sends sandbox invoice. Above threshold creates single-use token in Approvals Inbox.
                  </p>
                </div>

                <div className="pt-2 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-input border border-rule-2 bg-ink px-4 py-2 text-xs font-medium text-board-type hover:bg-ink/60 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center space-x-2 rounded-input bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50 transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{submitting ? "Processing..." : "Create & Dispatch Invoice"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink text-muted p-8">Loading Invoices...</div>}>
      <InvoicesContent />
    </Suspense>
  );
}