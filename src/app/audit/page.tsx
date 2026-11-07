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
          let badge = "bg-slate-800 text-slate-300";
          if (act === "owner") badge = "bg-purple-950 text-purple-300 border border-purple-800";
          else if (act === "agent") badge = "bg-blue-950 text-blue-300 border border-blue-800";
          else if (act === "policy_engine") badge = "bg-amber-950 text-amber-300 border border-amber-800";
          else if (act === "executor") badge = "bg-emerald-950 text-emerald-300 border border-emerald-800";
          return (
            <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ${badge}`}>
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
          <span className="font-mono text-xs font-semibold text-slate-200">{params.value}</span>
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
          <span className="font-mono text-slate-400">{params.value || "—"}</span>
        ),
      },
      {
        field: "details",
        headerName: "Details Summary",
        flex: 1,
        minWidth: 260,
        valueGetter: (params) => (params.data?.details ? JSON.stringify(params.data.details) : ""),
        cellRenderer: (params: any) => (
          <span className="font-mono text-[11px] text-slate-400 truncate block">{params.value}</span>
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
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-400" />
              <span>Cryptographic & Append-Only Audit Trail</span>
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Immutable ledger of all policy adjustments, decline ingestions, AI proposals, approvals, and executed settlements.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-blue-500 active:scale-[0.98] disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-blue-500 active:scale-[0.98] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "motion-safe:animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Input & Count */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Filter className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search by action, actor, event ID, or source..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <span className="text-xs text-slate-400">
            Showing <strong className="text-white">{filteredLogs.length}</strong> of {logs.length} entries
          </span>
        </div>

        {/* AG Grid */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
          <div className="ag-theme-quartz-dark w-full h-[580px] rounded-lg overflow-hidden">
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

