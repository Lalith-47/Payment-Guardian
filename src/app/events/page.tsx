"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { AgGridReact } from "ag-grid-react";
import { ColDef, RowClickedEvent } from "ag-grid-community";
import {
  ListOrdered,
  RefreshCw,
  ExternalLink,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldAlert,
  X,
  FileText,
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
          <span className="font-mono text-blue-400 font-medium">{params.value}</span>
        ),
      },
      {
        field: "type",
        headerName: "Type",
        width: 190,
      },
      {
        field: "source",
        headerName: "Source",
        width: 150,
        cellRenderer: (params: any) => (
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
            {params.value}
          </span>
        ),
      },
      {
        field: "status",
        headerName: "Status",
        width: 160,
        cellRenderer: (params: any) => {
          const s = params.value;
          let badge = "bg-slate-800 text-slate-300 border-slate-700";
          if (s === "EXECUTED" || s === "COMPLETED") {
            badge = "bg-emerald-950 text-emerald-300 border-emerald-800";
          } else if (s === "AWAITING_APPROVAL") {
            badge = "bg-amber-950 text-amber-300 border-amber-800";
          } else if (s === "WAITING_FOR_AI") {
            badge = "bg-purple-950 text-purple-300 border-purple-800";
          } else if (s === "FAILED" || s === "REJECTED") {
            badge = "bg-red-950 text-red-300 border-red-800";
          }
          return (
            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${badge}`}>
              {s}
            </span>
          );
        },
      },
      {
        field: "amount",
        headerName: "Amount",
        width: 110,
        valueGetter: (params) => (params.data?.amount ? `$${params.data.amount} ${params.data.currency}` : "—"),
      },
      {
        headerName: "AI Proposal",
        width: 130,
        valueGetter: (params) => params.data?.proposal?.action || "—",
        cellRenderer: (params: any) => (
          <span className="capitalize font-medium text-slate-200">{params.value}</span>
        ),
      },
      {
        field: "createdAt",
        headerName: "Timestamp",
        width: 180,
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-blue-400" />
              <span>Payment Recovery Events</span>
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Interactive triage grid showing end-to-end event resolution from ingest to automated execution.
            </p>
          </div>
          <button
            onClick={fetchEvents}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-blue-500 active:scale-[0.98]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "motion-safe:animate-spin" : ""}`} />
            <span>Refresh Events</span>
          </button>
        </div>

        {/* Main Grid and Detail Drawer layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* AG Grid Table */}
          <div className={selectedEventId ? "lg:col-span-7" : "lg:col-span-12"}>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                <span>{events.length} Events Ingested</span>
                <span>Click a row to inspect end-to-end proposal and execution trail</span>
              </div>
              <div className="ag-theme-quartz-dark w-full h-[520px] rounded-lg overflow-hidden">
                <AgGridReact<EventItem>
                  rowData={events}
                  columnDefs={columnDefs}
                  rowSelection="single"
                  onRowClicked={onRowClicked}
                  pagination={true}
                  paginationPageSize={15}
                  animateRows={false}
                />
              </div>
            </div>
          </div>

          {/* Side Detail Panel */}
          {selectedEventId && (
            <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="h-4 w-4 text-blue-400" />
                  <h2 className="text-sm font-semibold text-white">Event Resolution Detail</h2>
                </div>
                <button
                  onClick={() => setSelectedEventId(null)}
                  className="text-slate-400 hover:text-slate-200 p-1 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-blue-500 rounded active:scale-[0.98]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {loadingDetail ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading pipeline trail…</div>
              ) : !detail ? (
                <div className="p-8 text-center text-xs text-slate-400">Event not found.</div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 text-xs">
                  {/* Event summary */}
                  <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-blue-400 font-semibold">{detail.event.id}</span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                        {detail.event.status}
                      </span>
                    </div>
                    <p className="text-slate-400">
                      External Order: <span className="text-slate-200 font-mono">{detail.event.externalId || "—"}</span>
                    </p>
                    <p className="text-slate-400">
                      Ingested: <span className="text-slate-300">{new Date(detail.event.createdAt).toLocaleString()}</span>
                    </p>
                    {detail.event.errorMessage && (
                      <p className="text-red-400 font-mono text-[11px] pt-1">Error: {detail.event.errorMessage}</p>
                    )}
                  </div>

                  {/* Retry Action button */}
                  {isRetryEligible && (
                    <div className="rounded-lg border border-purple-800/60 bg-purple-950/40 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-purple-200">Incident Recovery Available</span>
                        <button
                          onClick={handleRetry}
                          disabled={retrying}
                          className="inline-flex items-center space-x-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-purple-400 active:scale-[0.98]"
                        >
                          <RotateCcw className={`h-3 w-3 ${retrying ? "motion-safe:animate-spin" : ""}`} />
                          <span>{retrying ? "Retrying..." : "Retry Recovery"}</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-purple-300">
                        Verifies LLM budget availability and re-enqueues for safe, idempotent re-triage.
                      </p>
                      {retryResult && <p className="text-[11px] text-emerald-300 pt-1">{retryResult}</p>}
                    </div>
                  )}

                  {/* Proposals / Reasoning */}
                  <div>
                    <h3 className="font-semibold text-slate-200 mb-2">AI Proposals & Reasoning</h3>
                    {detail.proposals.length === 0 ? (
                      <p className="text-slate-500 italic">No proposal generated (e.g. WAITING_FOR_AI or fail-safe).</p>
                    ) : (
                      <div className="space-y-3">
                        {detail.proposals.map((p) => (
                          <div key={p.id} className="rounded-lg border border-slate-800 bg-slate-800/30 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-emerald-400 capitalize">Action: {p.action}</span>
                              <span className="text-slate-400">Confidence: {Math.round(parseFloat(p.confidence) * 100)}%</span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[11px]">Model:</span>
                              <span className="text-slate-300 text-[11px] font-mono ml-1.5">{p.modelUsed}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Reasoning:</span>
                              <p className="text-slate-300 mt-0.5 italic">{p.reasoning}</p>
                            </div>
                            {p.message && (
                              <div className="rounded bg-slate-900/80 p-2 border border-slate-800">
                                <span className="text-slate-400 text-[11px]">Draft Customer Notice (Not Sent):</span>
                                <p className="text-slate-300 mt-0.5">{p.message}</p>
                              </div>
                            )}
                            {p.contextSnapshot && (
                              <div>
                                <span className="text-slate-400 text-[11px]">Grounded DB Context Snapshot:</span>
                                <pre className="mt-1 max-h-24 overflow-y-auto rounded bg-slate-950 p-2 font-mono text-[10px] text-slate-400">
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
                  <div>
                    <h3 className="font-semibold text-slate-200 mb-2">Action Executor Dispatches</h3>
                    {detail.actions.length === 0 ? (
                      <p className="text-slate-500 italic">No mutating actions executed yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {detail.actions.map((act) => (
                          <div key={act.id} className="rounded-lg border border-slate-800 bg-slate-800/30 p-3 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-200">{act.actionType}</span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                                  act.status === "SUCCESS"
                                    ? "bg-emerald-950 text-emerald-300"
                                    : act.status === "DEAD_LETTER"
                                    ? "bg-red-950 text-red-300"
                                    : "bg-slate-800 text-slate-300"
                                }`}
                              >
                                {act.status}
                              </span>
                            </div>
                            <p className="font-mono text-[11px] text-slate-400 truncate">Idempotency: {act.idempotencyKey}</p>
                            <p className="text-slate-400">
                              {act.paypalMethod} {act.paypalEndpoint} ({act.statusCode || "—"})
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Audit Trail */}
                  <div>
                    <h3 className="font-semibold text-slate-200 mb-2">Event Audit Trail</h3>
                    <div className="space-y-1.5">
                      {detail.auditTrail.map((log) => (
                        <div key={log.id} className="flex items-baseline space-x-2 text-[11px] text-slate-400">
                          <span className="text-slate-500 shrink-0">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="text-blue-400 font-medium">[{log.actor}]</span>
                          <span className="text-slate-300">{log.action}</span>
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
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading events...</div>}>
      <EventsContent />
    </Suspense>
  );
}
