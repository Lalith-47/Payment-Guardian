"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { AgGridReact } from "ag-grid-react";
import { ColDef } from "ag-grid-community";
import { FileText, Download, RefreshCw, Filter, Shield } from "lucide-react";

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

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");
  const gridRef = useRef<AgGridReact<AuditEntry>>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/audit?limit=250");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      // Keep existing state on error
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
      },
      {
        field: "timestamp",
        headerName: "Timestamp",
        width: 180,
        valueFormatter: (params) => (params.value ? new Date(params.value).toLocaleString() : ""),
        sort: "desc",
      },
      {
        field: "actor",
        headerName: "Actor",
        width: 130,
        cellRenderer: (params: any) => {
          const act = params.value;
          let badge = "bg-ink text-board-type border border-rule-2";
          if (act === "owner") badge = "bg-accent/15 text-accent border border-accent/30";
          else if (act === "agent") badge = "bg-info/15 text-info border border-info/30";
          else if (act === "policy_engine") badge = "bg-warning/15 text-warning border border-warning/30";
          else if (act === "executor") badge = "bg-success/15 text-success border border-success/30";
          return (
            <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-medium ${badge}`}>
              {act}
            </span>
          );
        },
      },
      {
        field: "action",
        headerName: "Action",
        width: 190,
        cellRenderer: (params: any) => (
          <span className="font-mono text-xs font-semibold text-board-type">{params.value}</span>
        ),
      },
      {
        field: "source",
        headerName: "Source",
        width: 140,
      },
      {
        field: "eventId",
        headerName: "Event ID",
        width: 160,
        cellRenderer: (params: any) => (
          <span className="font-mono text-muted">{params.value || "—"}</span>
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
      // Fallback CSV download
      const headers = ["id", "timestamp", "actor", "action", "source", "eventId", "details"];
      const rows = logs.map((l) => [
        l.id,
        new Date(l.timestamp).toISOString(),
        l.actor,
        l.action,
        l.source,
        l.eventId || "",
        `"${JSON.stringify(l.details).replace(/"/g, '""')}"`,
      ]);
      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `revenue-guardian-audit-log-${Date.now()}.csv`);
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
        l.action.toLowerCase().includes(q) ||
        l.actor.toLowerCase().includes(q) ||
        (l.eventId && l.eventId.toLowerCase().includes(q)) ||
        l.source.toLowerCase().includes(q)
      );
    });
  }, [logs, filterText]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-board-type flex items-center gap-2">
              <Shield className="h-5 w-5 text-success" />
              <span>Cryptographic & Append-Only Audit Trail</span>
            </h1>
            <p className="mt-1 text-xs text-muted">
              Immutable ledger of all policy adjustments, decline ingestions, AI proposals, approvals, and executed settlements.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center space-x-1.5 rounded-input border border-rule-2 bg-ink px-3 py-1.5 text-xs font-semibold text-board-type hover:bg-ink-2 active:opacity-80 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-focus disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 rounded-input border border-rule-2 bg-ink px-3 py-1.5 text-xs font-semibold text-board-type hover:bg-ink-2 active:opacity-80 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-focus disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "motion-safe:animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Input & Count */}
        <div className="flex items-center justify-between gap-4 rounded-card border border-rule-2 bg-ink-2 p-4 shadow-card">
          <div className="relative flex-1 max-w-md">
            <Filter className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search by action, actor, event ID, or source..."
              className="w-full rounded-input border border-rule-2 bg-ink pl-9 pr-3 py-1.5 text-xs text-board-type placeholder-muted focus:border-focus focus:outline-none"
            />
          </div>
          <span className="text-xs text-muted">
            Showing <strong className="text-board-type">{filteredLogs.length}</strong> of {logs.length} entries
          </span>
        </div>

        {/* AG Grid */}
        <div className="rounded-card border border-rule-2 bg-ink-2 p-4 shadow-card">
          <div className="ag-theme-quartz-dark w-full h-[580px] rounded-input overflow-hidden">
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

