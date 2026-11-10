"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import "@/lib/ag-grid";
import { AgGridReact } from "ag-grid-react";
import { ColDef, RowClickedEvent } from "ag-grid-community";
import {
  ListOrdered,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  X,
  ArrowRight,
  Clock,
  Sparkles,
  Zap,
  ExternalLink,
} from "lucide-react";

interface EventItem {
  id: string;
  type: string;
  source: string;
  externalId: string | null;
  status: string;
  amount: string | null;
  currency: string;
  errorMessage: string | null;
  createdAt: string;
  proposal?: {
    id: string;
    action: string;
    confidence: string;
    reasoning: string;
    modelUsed: string;
  } | null;
  action?: {
    id: string;
    actionType: string;
    status: string;
    idempotencyKey: string;
  } | null;
}

interface EventDetail {
  event: EventItem;
  proposals: Array<{
    id: string;
    action: string;
    amount: string | null;
    currency: string | null;
    message: string;
    confidence: string;
    reasoning: string;
    modelUsed: string;
    contextSnapshot: Record<string, unknown> | null;
    createdAt: string;
  }>;
  actions: Array<{
    id: string;
    actionType: string;
    idempotencyKey: string;
    paypalEndpoint: string;
    paypalMethod: string;
    status: string;
    statusCode: number | null;
    errorMessage: string | null;
    executedAt: string;
  }>;
  auditTrail: Array<{
    id: number;
    timestamp: string;
    actor: string;
    action: string;
    details: Record<string, unknown>;
  }>;
}

function EventsContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("id");

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialId);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<string | null>(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {
      // Keep existing state on error
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (id: string) => {
    try {
      setLoadingDetail(true);
      setRetryResult(null);
      const res = await fetch(`/api/events/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDetail(data);
      }
    } catch {
      // keep existing
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchDetail(selectedEventId);
    }
  }, [selectedEventId]);

  const handleRetry = async () => {
    if (!selectedEventId) return;
    setRetrying(true);
    setRetryResult(null);

    try {
      const res = await fetch(`/api/events/${selectedEventId}/retry`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Retry request failed");
      }
      setRetryResult("Event successfully re-enqueued for recovery triage.");
      await fetchDetail(selectedEventId);
      await fetchEvents();
    } catch (err) {
      setRetryResult(`Retry failed: ${(err as Error).message}`);
    } finally {
      setRetrying(false);
    }
  };

  const columnDefs = useMemo<ColDef<EventItem>[]>(() => {
    return [
      {
        field: "id",
        headerName: "Event ID",
        width: 170,
        cellRenderer: (params: any) => (
          <span className="font-mono text-[#0070BA] font-bold">{params.value}</span>
        ),
      },
      {
        field: "type",
        headerName: "Classification",
        width: 200,
        cellRenderer: (params: any) => (
          <span className="font-medium text-ink">{params.value}</span>
        ),
      },
      {
        field: "source",
        headerName: "Source",
        width: 140,
        cellRenderer: (params: any) => (
          <div className="flex items-center h-full">
            <span className="font-mono text-muted bg-paper-3 px-2 py-0.5 rounded-full text-[11px] leading-tight inline-flex items-center">
              {params.value}
            </span>
          </div>
        ),
      },
      {
        field: "status",
        headerName: "Status",
        width: 170,
        cellRenderer: (params: any) => {
          const s = params.value;
          let badgeClass = "badge-status badge-status--info";
          if (s === "RECOVERED" || s === "EXECUTED" || s === "COMPLETED") {
            badgeClass = "badge-status badge-status--success";
          } else if (s === "EXECUTED_CONFIRMED_BY_POLLING") {
            badgeClass = "badge-status badge-status--info";
          } else if (s === "AWAITING_APPROVAL") {
            badgeClass = "badge-status badge-status--warning";
          } else if (s === "WAITING_FOR_AI") {
            badgeClass = "badge-status badge-status--info";
          } else if (s === "FAILED" || s === "REJECTED") {
            badgeClass = "badge-status badge-status--error";
          }
          return (
            <div className="flex items-center h-full">
              <span className={badgeClass}>
                {s}
              </span>
            </div>
          );
        },
      },
      {
        field: "amount",
        headerName: "Amount",
        width: 130,
        valueGetter: (params) => (params.data?.amount ? `$${params.data.amount} ${params.data.currency}` : "—"),
        cellRenderer: (params: any) => (
          <div className="flex items-center h-full">
            <span className="font-mono text-ink font-bold">{params.value}</span>
          </div>
        ),
      },
      {
        field: "createdAt",
        headerName: "Timestamp",
        width: 170,
        valueFormatter: (params) => (params.value ? new Date(params.value).toLocaleString() : ""),
      },
    ];
  }, []);

  const onRowClicked = (event: RowClickedEvent<EventItem>) => {
    if (event.data?.id) {
      setSelectedEventId(event.data.id);
    }
  };

  const isRetryEligible =
    detail &&
    (detail.event.status === "WAITING_FOR_AI" ||
      detail.event.status === "FAILED" ||
      detail.actions.some((a) => a.status === "DEAD_LETTER"));

  return (
    <DashboardShell>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-rule">
          <div>
            <h1 className="text-2xl font-bold text-[#001C44] flex items-center gap-2.5">
              <ListOrdered className="h-6 w-6 text-[#0070BA]" />
              <span>Payment Recovery Event Stream</span>
            </h1>
            <p className="mt-1 text-sm text-muted">
              Live lifecycle triage ledger tracing events from webhook ingestion to policy evaluation and executor dispatch.
            </p>
          </div>
          <button
            onClick={fetchEvents}
            disabled={loading}
            className="btn-paypal-secondary btn-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#0070BA]" : ""}`} />
            <span className="hidden sm:inline">Refresh Events</span>
          </button>
        </div>

        {/* Main Grid and Detail Drawer layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* AG Grid Table */}
          <div className={selectedEventId ? "lg:col-span-7" : "lg:col-span-12"}>
            <div className="card-paypal p-5 space-y-4">
              <div className="flex items-center justify-between text-xs text-muted pb-3 border-b border-rule">
                <span className="font-mono font-bold text-ink">{events.length} Events Ingested</span>
                <span>Select any event row to inspect lifecycle trace</span>
              </div>
              <div className="ag-theme-quartz w-full h-[540px] rounded-xl overflow-hidden border border-rule">
                <AgGridReact<EventItem>
                  theme="legacy"
                  rowData={events}
                  columnDefs={columnDefs}
                  rowSelection={{ mode: "singleRow" }}
                  onRowClicked={onRowClicked}
                  pagination={true}
                  paginationPageSize={15}
                  paginationPageSizeSelector={[10, 15, 25, 50]}
                />
              </div>
            </div>
          </div>

          {/* Side Detail Panel */}
          {selectedEventId && (
            <div className="lg:col-span-5 card-paypal p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-rule pb-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-[#0070BA]" />
                  <h2 className="text-sm font-bold text-[#001C44]">Event Resolution Trace</h2>
                </div>
                <button
                  onClick={() => setSelectedEventId(null)}
                  className="text-muted hover:text-ink-2 p-1.5 rounded-full hover:bg-paper-3 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {loadingDetail ? (
                <div className="p-12 text-center text-xs text-muted">Loading event trace…</div>
              ) : !detail ? (
                <div className="p-12 text-center text-xs text-muted">Event record not found.</div>
              ) : (
                <div className="space-y-5 max-h-[500px] overflow-y-auto pr-1 text-xs">
                  {/* Event summary */}
                  <div className="rounded-2xl border border-rule bg-paper-3 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[#0070BA] font-bold">{detail.event.id}</span>
                      <span className="badge-status badge-status--info">
                        {detail.event.status}
                      </span>
                    </div>
                    <p className="text-muted text-xs">
                      External Order: <span className="text-ink font-mono font-bold">{detail.event.externalId || "—"}</span>
                    </p>
                    <p className="text-muted text-xs">
                      Ingested: <span className="text-ink-2 font-mono">{new Date(detail.event.createdAt).toLocaleString()}</span>
                    </p>
                    {detail.event.errorMessage && (
                      <div className="space-y-2.5 pt-1">
                        <p className="text-error text-xs font-medium">
                          Error: <span className="font-mono break-all">{detail.event.errorMessage}</span>
                        </p>
                        {(detail.event.errorMessage.includes("ORDER_NOT_APPROVED") ||
                          detail.event.errorMessage.toLowerCase().includes("payer has not yet approved")) &&
                          detail.event.externalId && (
                            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 space-y-2">
                              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                                Payer Approval Required in Sandbox
                              </p>
                              <p className="text-[11px] text-muted leading-relaxed">
                                The payer has not yet authorized payment on this order. Complete approval via the PayPal Sandbox checkout, then retry recovery triage.
                              </p>
                              <a
                                href={`https://www.sandbox.paypal.com/checkoutnow?token=${detail.event.externalId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-paypal-gold btn-sm w-full inline-flex items-center justify-center gap-1.5 font-bold shadow-sm"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Open PayPal Sandbox Approval Link
                              </a>
                            </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Retry Action button */}
                  {isRetryEligible && (
                    <div className="rounded-2xl border border-warning/30 bg-warning/15 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-warning text-xs">Recovery Triage Eligible</span>
                        <button
                          onClick={handleRetry}
                          disabled={retrying}
                          className="btn-paypal-gold btn-sm"
                        >
                          <RotateCcw className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
                          <span>{retrying ? "Retrying..." : "Retry Recovery"}</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-warning">
                        Verifies LLM budget availability and re-enqueues for safe, idempotent re-triage.
                      </p>
                      {retryResult && <p className="text-xs text-success font-bold pt-1">{retryResult}</p>}
                    </div>
                  )}

                  {/* Proposals / Reasoning */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-[#001C44]">AI Proposal & Reasoning</h3>
                    {detail.proposals.length === 0 ? (
                      <p className="text-muted italic text-xs">No proposal generated for this state.</p>
                    ) : (
                      <div className="space-y-3">
                        {detail.proposals.map((p) => (
                          <div key={p.id} className="rounded-2xl border border-rule bg-white p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-success capitalize">Action: {p.action}</span>
                              <span className="text-muted font-mono text-[11px]">Confidence: {Math.round(parseFloat(p.confidence) * 100)}%</span>
                            </div>
                            <div className="text-[11px] text-muted font-mono">
                              Model: {p.modelUsed}
                            </div>
                            <p className="text-ink-2 text-xs bg-paper-3 p-3 rounded-xl border border-rule italic leading-relaxed">
                              "{p.reasoning}"
                            </p>
                            {p.message && (
                              <div className="rounded-xl bg-paper-3 p-3 border border-rule text-xs">
                                <span className="text-muted text-[10px] block font-bold uppercase tracking-wider">Draft Customer Notice:</span>
                                <p className="text-ink mt-1">{p.message}</p>
                              </div>
                            )}
                            {p.contextSnapshot && (
                              <div>
                                <span className="text-muted text-[10px] block font-bold uppercase tracking-wider">Context Snapshot:</span>
                                <pre className="mt-1 max-h-24 overflow-y-auto rounded-xl bg-paper-3 p-2 font-mono text-[10px] text-ink-2 border border-rule">
                                  {JSON.stringify(p.contextSnapshot, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Executor Executions */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-[#001C44]">ActionExecutor Dispatches</h3>
                    {detail.actions.length === 0 ? (
                      <p className="text-muted italic text-xs">No mutating actions executed.</p>
                    ) : (
                      <div className="space-y-2">
                        {detail.actions.map((act) => (
                          <div key={act.id} className="rounded-2xl border border-rule bg-white p-3.5 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-ink">{act.actionType}</span>
                              <span
                                className={`badge-status ${
                                  act.status === "SUCCESS"
                                    ? "badge-status--success"
                                    : act.status === "DEAD_LETTER"
                                    ? "badge-status--error"
                                    : "badge-status--info"
                                }`}
                              >
                                {act.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted truncate font-mono">
                              Idempotency: {act.idempotencyKey}
                            </p>
                            <p className="text-muted font-mono text-[11px]">
                              {act.paypalMethod} {act.paypalEndpoint} ({act.statusCode || "—"})
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Audit Trail */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-[#001C44]">Audit Trail</h3>
                    <div className="space-y-2 border-l-2 border-rule pl-4 ml-2">
                      {detail.auditTrail.map((log) => (
                        <div key={log.id} className="text-xs text-muted space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[#0070BA] font-bold">[{log.actor}]</span>
                            <span className="font-mono text-[11px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-ink-2">{log.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted text-xs font-mono">Loading events...</div>}>
      <EventsContent />
    </Suspense>
  );
}
