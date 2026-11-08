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
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldAlert,
  X,
  Send,
  ArrowRight,
  Sparkles,
  Search,
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
            text: `Fields requiring completion: ${data.missingFields.join(", ")}. Please review below.`,
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
          text: `Invoice #${data.invoiceNumber || data.invoiceId} generated and dispatched via ActionExecutor.`,
        });
        await fetchInvoices();
        if (data.invoiceId) {
          setSelectedInvoiceId(data.invoiceId);
        }
        setIsModalOpen(false);
      } else if (data.decision === "NEEDS_APPROVAL") {
        setActionNotice({
          type: "warning",
          text: `Invoice exceeds auto-send limits (${data.ruleTriggered}). Warrant created in Approval Inbox.`,
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
          <span className="font-mono text-[#0070BA] font-bold">
            {params.value || params.data?.id.slice(0, 12) || "—"}
          </span>
        ),
      },
      {
        headerName: "Recipient",
        field: "customerName",
        width: 190,
        cellRenderer: (params: { value: string | null; data?: InvoiceItem }) => (
          <div className="flex flex-col justify-center h-full">
            <span className="text-ink font-semibold">{params.value || "Customer"}</span>
            <span className="text-[11px] text-muted truncate font-mono">{params.data?.recipientEmail}</span>
          </div>
        ),
      },
      {
        headerName: "Amount",
        width: 130,
        valueGetter: (params) =>
          params.data ? `${params.data.currency} ${parseFloat(params.data.amount).toFixed(2)}` : "—",
        cellRenderer: (params: { value: string }) => (
          <span className="font-mono text-ink font-bold">{params.value}</span>
        ),
      },
      {
        headerName: "Status",
        field: "status",
        width: 170,
        cellRenderer: (params: { value: string; data?: InvoiceItem }) => {
          const val = params.value || "DRAFT";
          if (val === "PAID_CONFIRMED_BY_POLLING") {
            return (
              <span className="badge-status badge-status--success">
                PAID (Polled)
              </span>
            );
          }
          if (val === "PAID") {
            return (
              <span className="badge-status badge-status--success">
                PAID (Webhook)
              </span>
            );
          }
          if (val === "SENT") {
            return (
              <span className="badge-status badge-status--info">
                SENT
              </span>
            );
          }
          if (val === "CANCELLED") {
            return (
              <span className="badge-status badge-status--error">
                CANCELLED
              </span>
            );
          }
          return (
            <span className="badge-status badge-status--info">
              {val}
            </span>
          );
        },
      },
      {
        headerName: "Source",
        field: "confirmationSource",
        width: 120,
        cellRenderer: (params: { value: string | null }) => (
          <span className="text-muted font-mono text-[11px] bg-paper-3 px-2 py-0.5 rounded-full">
            {params.value || "executor"}
          </span>
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
        width: 140,
        valueFormatter: (params) => (params.value ? new Date(params.value).toLocaleDateString() : "—"),
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
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-rule">
          <div>
            <h1 className="text-2xl font-bold text-[#001C44] flex items-center gap-2.5">
              <Receipt className="h-6 w-6 text-[#0070BA]" />
              <span>PayPal Invoicing Ledger</span>
            </h1>
            <p className="mt-1 text-sm text-muted">
              Policy-bounded invoice generation with AI field extraction and deterministic due date calculation.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsModalOpen(true);
                setActionNotice(null);
                setMissingFields([]);
              }}
              className="btn-paypal-primary"
            >
              <Plus className="h-4 w-4" />
              <span>New Invoice</span>
            </button>
            <button
              onClick={fetchInvoices}
              disabled={loading}
              className="btn-paypal-secondary"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#0070BA]" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Global Action Banner */}
        {actionNotice && (
          <div
            className={`rounded-2xl p-4 text-xs flex items-center justify-between border ${
              actionNotice.type === "success"
                ? "bg-success/15 border-success/30 text-success"
                : actionNotice.type === "warning"
                ? "bg-warning/15 border-warning/30 text-warning"
                : "bg-error/15 border-error/30 text-error"
            }`}
          >
            <div className="flex items-center gap-2.5 font-medium">
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
                href="/approvals"
                className="btn-paypal-primary btn-sm inline-flex items-center gap-1 text-xs font-bold"
              >
                <span>View Warrant</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}

        {/* Main Grid & Side Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Invoices AG Grid */}
          <div className={selectedInvoiceId ? "lg:col-span-7" : "lg:col-span-12"}>
            <div className="card-paypal p-5 space-y-4">
              <div className="flex items-center justify-between text-xs text-muted pb-3 border-b border-rule">
                <span className="font-mono font-bold text-ink">{invoices.length} Invoices Tracked</span>
                <span>Select any row to view audit timeline</span>
              </div>
              <div className="ag-theme-quartz w-full h-[540px] rounded-xl overflow-hidden border border-rule">
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
            <div className="lg:col-span-5 card-paypal p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-rule pb-4">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-[#0070BA]" />
                  <h2 className="text-sm font-bold text-[#001C44]">Invoice Audit Record</h2>
                </div>
                <button
                  onClick={() => setSelectedInvoiceId(null)}
                  className="text-muted hover:text-ink-2 p-1.5 rounded-full hover:bg-paper-3 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {loadingDetail ? (
                <div className="p-12 text-center text-xs text-muted">Loading invoice timeline…</div>
              ) : !detail ? (
                <div className="p-12 text-center text-xs text-muted">Invoice record not found.</div>
              ) : (
                <div className="space-y-5 max-h-[500px] overflow-y-auto pr-1 text-xs">
                  {/* Summary Card */}
                  <div className="rounded-2xl border border-rule bg-paper-3 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[#0070BA] font-bold">{detail.invoice.id}</span>
                      <span className="badge-status badge-status--info">
                        {detail.invoice.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                      <div>
                        <span className="text-muted block text-[11px]">Recipient:</span>
                        <span className="text-ink font-bold">{detail.invoice.customerName || "Customer"}</span>
                      </div>
                      <div>
                        <span className="text-muted block text-[11px]">Email:</span>
                        <span className="text-ink-2 font-mono">{detail.invoice.recipientEmail}</span>
                      </div>
                      <div>
                        <span className="text-muted block text-[11px]">Total Amount:</span>
                        <span className="text-ink font-extrabold font-mono text-sm">
                          {detail.invoice.currency} {parseFloat(detail.invoice.amount).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted block text-[11px]">Source:</span>
                        <span className="text-ink-2 font-mono">{detail.invoice.confirmationSource || "executor"}</span>
                      </div>
                    </div>

                    {detail.invoice.payerViewUrl && (
                      <div className="pt-3 border-t border-rule">
                        <a
                          href={detail.invoice.payerViewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-paypal-secondary btn-sm w-full inline-flex items-center justify-center gap-1.5"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Open PayPal Sandbox View</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Customer Draft Message */}
                  <div className="rounded-2xl border border-rule bg-white p-4 space-y-1.5">
                    <span className="text-[11px] text-muted block font-bold uppercase tracking-wider">
                      Customer notification note (draft):
                    </span>
                    <p className="text-ink-2 italic bg-paper-3 p-3 rounded-xl border border-rule text-xs">
                      "{detail.invoice.draftMessage || detail.invoice.note || "No customer message attached."}"
                    </p>
                  </div>

                  {/* State Transition Timeline */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-ink flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted" />
                      <span>Audit Transition Timeline</span>
                    </h3>

                    {detail.timeline.length === 0 ? (
                      <p className="text-xs text-muted">No timeline entries recorded.</p>
                    ) : (
                      <div className="space-y-3 border-l-2 border-rule pl-4 ml-2">
                        {detail.timeline.map((entry) => (
                          <div key={entry.id} className="text-xs space-y-1">
                            <div className="flex items-center justify-between text-muted">
                              <span className="font-bold text-ink">{entry.action}</span>
                              <span className="font-mono text-[11px]">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-muted text-[11px]">
                              Actor: <span className="font-mono font-semibold text-ink-2">{entry.actor}</span>
                            </p>
                            {Boolean(entry.details?.from) && (
                              <p className="text-muted text-[11px] font-mono">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-deep backdrop-blur-xs p-4 overflow-y-auto">
            <div className="w-full max-w-xl card-paypal-elevated p-6 sm:p-8 space-y-6 my-8">
              <div className="flex items-center justify-between border-b border-rule pb-4">
                <div className="flex items-center gap-2.5">
                  <Receipt className="h-5 w-5 text-[#0070BA]" />
                  <h2 className="text-lg font-bold text-[#001C44]">Issue Invoice via AI Brief</h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-muted hover:text-ink-2 p-1.5 rounded-full hover:bg-paper-3 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Natural language extraction prompt */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-ink-2">
                  Instruction Brief
                </label>
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="e.g. invoice Vanguard Logistics GmbH $400 for quarterly consulting, due in 15 days"
                    className="block w-full rounded-xl border border-rule bg-paper-3 p-3 text-xs text-ink placeholder-slate-400 focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-muted">
                      Extracts recipient, amount, currency, and net terms into structured schema.
                    </span>
                    <button
                      type="button"
                      onClick={handleExtract}
                      disabled={extracting || !promptText.trim()}
                      className="btn-paypal-secondary btn-sm"
                    >
                      <Sparkles className="h-3 w-3 text-[#0070BA]" />
                      <span>{extracting ? "Extracting..." : "Extract Fields"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {extractionReasoning && (
                <div className="rounded-xl border border-rule bg-paper-3 p-3 text-xs text-ink-2 space-y-1">
                  <span className="font-bold text-ink">Extraction Analysis:</span>
                  <p>{extractionReasoning}</p>
                </div>
              )}

              {/* Form Fields */}
              <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2 border-t border-rule">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-ink-2 flex items-center justify-between">
                      <span>Customer Name</span>
                      {missingFields.includes("customerName") && (
                        <span className="text-[10px] text-warning font-bold">Required</span>
                      )}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      placeholder="Vanguard Logistics GmbH"
                      className={`block w-full rounded-xl border ${
                        missingFields.includes("customerName") ? "border-warning/30 bg-warning/15" : "border-rule bg-paper-3"
                      } px-3 py-2 text-xs text-ink focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-ink-2 flex items-center justify-between">
                      <span>Customer Email</span>
                      {missingFields.includes("customerEmail") && (
                        <span className="text-[10px] text-warning font-bold">Required</span>
                      )}
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.customerEmail}
                      onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                      placeholder="client@example.com"
                      className={`block w-full rounded-xl border ${
                        missingFields.includes("customerEmail") ? "border-warning/30 bg-warning/15" : "border-rule bg-paper-3"
                      } px-3 py-2 text-xs text-ink focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-ink-2 flex items-center justify-between">
                      <span>Amount</span>
                      {missingFields.includes("amount") && (
                        <span className="text-[10px] text-warning font-bold">Required</span>
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
                      className={`block w-full rounded-xl border ${
                        missingFields.includes("amount") ? "border-warning/30 bg-warning/15" : "border-rule bg-paper-3"
                      } px-3 py-2 text-xs text-ink font-mono font-bold focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-ink-2">Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="block w-full rounded-xl border border-rule bg-paper-3 px-3 py-2 text-xs font-bold text-ink focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD ($)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-ink-2">Due Window (Days)</label>
                    <input
                      type="number"
                      min="1"
                      max="90"
                      required
                      value={formData.dueDays}
                      onChange={(e) => setFormData({ ...formData, dueDays: parseInt(e.target.value, 10) || 15 })}
                      className="block w-full rounded-xl border border-rule bg-paper-3 px-3 py-2 text-xs text-ink font-mono font-bold focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink-2">Line Item Description</label>
                  <input
                    type="text"
                    value={formData.lineItemDescription}
                    onChange={(e) => setFormData({ ...formData, lineItemDescription: e.target.value })}
                    placeholder="e.g. Quarterly consulting retainer"
                    className="block w-full rounded-xl border border-rule bg-paper-3 px-3 py-2 text-xs text-ink focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink-2">Customer Note (Stored as Draft)</label>
                  <input
                    type="text"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="e.g. Thank you for your business"
                    className="block w-full rounded-xl border border-rule bg-paper-3 px-3 py-2 text-xs text-ink focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
                  />
                </div>

                {/* Policy Preview */}
                <div className="rounded-xl border border-rule bg-paper-3 p-3.5 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted font-medium">Guardrail Evaluation:</span>
                    <span
                      className={`font-bold ${
                        typeof formData.amount === "number" && formData.amount > 500
                          ? "text-warning"
                          : "text-success"
                      }`}
                    >
                      {typeof formData.amount === "number" && formData.amount > 500
                        ? "NEEDS_APPROVAL (> $500 threshold)"
                        : "AUTO (Direct send via ActionExecutor)"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted">
                    Invoices under threshold send automatically in sandbox. Amounts exceeding limit generate an approval warrant.
                  </p>
                </div>

                <div className="pt-3 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="btn-paypal-secondary btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-paypal-primary btn-sm"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{submitting ? "Processing..." : "Issue Invoice"}</span>
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
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC] text-muted p-8 text-xs font-mono">Loading Invoices...</div>}>
      <InvoicesContent />
    </Suspense>
  );
}
