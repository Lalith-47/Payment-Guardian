"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import "@/lib/ag-grid";
import { AgGridReact } from "ag-grid-react";
import { ColDef } from "ag-grid-community";
import { FileText, Download, RefreshCw, Shield, Search } from "lucide-react";

interface AuditEntry {
  id: number;
  timestamp: string;
  source: string;
  eventType: string;
  eventId: string | null;
  actor: string;
  action: string;
  details: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");
  const gridRef = useRef<AgGridReact<AuditEntry>>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/audit");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.auditLogs || []);
      }
    } catch {
      // Keep existing state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const columnDefs = useMemo<ColDef<AuditEntry>[]>(() => {
    return [
      {
        field: "id",
        headerName: "ID",
        width: 80,
        cellRenderer: (params: any) => (
          <span className="font-mono text-xs font-bold text-[#001C44]">#{params.value}</span>
        ),
      },
      {
        field: "timestamp",
        headerName: "Timestamp",
        width: 180,
        valueFormatter: (params) => (params.value ? new Date(params.value).toLocaleString() : ""),
      },
      {
        field: "actor",
        headerName: "Actor",
        width: 140,
        cellRenderer: (params: any) => (
          <span className="font-semibold text-xs text-[#003087]">{params.value}</span>
        ),
      },
      {
        field: "action",
        headerName: "Action",
        width: 180,
        cellRenderer: (params: any) => {
          const val = String(params.value || "");
          const isApprove = val.includes("APPROVE") || val.includes("SUCCESS");
          const isReject = val.includes("REJECT") || val.includes("FAIL");
          return (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                isApprove
                  ? "bg-success/15 text-success"
                  : isReject
                  ? "bg-danger/15 text-danger"
                  : "bg-paper-3 text-ink-2"
              }`}
            >
              {val}
            </span>
          );
        },
      },
      {
        field: "source",
        headerName: "Source",
        width: 130,
        cellRenderer: (params: any) => (
          <span className="font-mono text-xs text-muted bg-paper-3 px-2 py-0.5 rounded-full">
            {params.value}
          </span>
        ),
      },
      {
        field: "eventId",
        headerName: "Event ID",
        width: 170,
        cellRenderer: (params: any) => (
          <span className="font-mono text-[#0070BA] font-semibold text-xs">{params.value || "—"}</span>
        ),
      },
      {
        field: "details",
        headerName: "Details Summary",
        flex: 1,
        minWidth: 260,
        valueGetter: (params) => (params.data?.details ? JSON.stringify(params.data.details) : ""),
        cellRenderer: (params: any) => (
          <span className="font-mono text-[11px] text-muted truncate block">{params.value}</span>
        ),
      },
    ];
  }, []);

  const handleExportCsv = () => {
    if (gridRef.current?.api) {
      gridRef.current.api.exportDataAsCsv({
        fileName: `revenue-guardian-audit-log-${new Date().toISOString().split("T")[0]}.csv`,
      });
    } else {
      const headers = ["id", "timestamp", "actor", "action", "source", "eventId", "details"];
      const rows = logs.map((l) => [
        l.id,
        l.timestamp,
        l.actor,
        l.action,
        l.source,
        l.eventId || "",
        JSON.stringify(l.details || {}),
      ]);
      const csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `revenue-guardian-audit-log-${new Date().toISOString().split("T")[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const filteredLogs = useMemo(() => {
    if (!filterText.trim()) return logs;
    const q = filterText.toLowerCase();
    return logs.filter((l) => {
      return (
        String(l.id).includes(q) ||
        (l.actor && l.actor.toLowerCase().includes(q)) ||
        (l.action && l.action.toLowerCase().includes(q)) ||
        (l.source && l.source.toLowerCase().includes(q)) ||
        (l.eventId && l.eventId.toLowerCase().includes(q)) ||
        (l.details && JSON.stringify(l.details).toLowerCase().includes(q))
      );
    });
  }, [logs, filterText]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-rule">
          <div>
            <h1 className="text-2xl font-bold text-[#001C44] flex items-center gap-2.5">
              <Shield className="h-6 w-6 text-[#0070BA]" />
              <span>Append-Only Cryptographic Audit Trail</span>
            </h1>
            <p className="mt-1 text-xs text-muted">
              Immutable ledger of all policy adjustments, decline ingestions, proposals, approvals, and executed settlements.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCsv}
              className="btn-paypal-secondary btn-sm"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="btn-paypal-secondary btn-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#0070BA]" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Input & Count Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 card-paypal p-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter by action, actor, event ID, or source..."
              className="w-full rounded-full border border-rule bg-paper-3 pl-10 pr-4 py-2 text-xs text-ink placeholder-muted focus:border-[#0070BA] focus:bg-white focus:outline-none transition-all"
            />
          </div>
          <span className="text-xs text-muted font-mono">
            Showing <strong className="text-ink font-bold">{filteredLogs.length}</strong> of {logs.length} entries
          </span>
        </div>

        {/* AG Grid */}
        <div className="card-paypal p-5">
          <div className="ag-theme-quartz w-full h-[600px] rounded-xl overflow-hidden border border-rule">
            <AgGridReact<AuditEntry>
              ref={gridRef}
              rowData={filteredLogs}
              columnDefs={columnDefs}
              pagination={true}
              paginationPageSize={20}
              animateRows={false}
            />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
