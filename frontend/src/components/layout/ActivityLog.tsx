import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getActivityLog, clearActivityLog, ToolLogEntry } from "@/api/activity";

const TOOL_NAMES = [
  "all",
  "web_search",
  "memory",
  "weather",
  "news",
  "commute",
  "calendar",
];

const TOOL_LABELS: Record<string, string> = {
  web_search: "Web Search",
  memory: "Memory",
  weather: "Weather",
  news: "News",
  commute: "Commute",
  calendar: "Calendar",
};

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTs(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ActivityLog() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["activity", filter],
    queryFn: () =>
      getActivityLog({
        limit: 100,
        tool_name: filter === "all" ? undefined : filter,
      }),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const clearMutation = useMutation({
    mutationFn: clearActivityLog,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity"] });
      setConfirmClear(false);
    },
  });

  const logs = data?.logs ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          gap: "12px",
        }}
      >
        <div>
          <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text)" }}>
            Activity Log
          </div>
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
            Every tool Anchorpoint uses is logged here — no PII stored
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {isFetching && (
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-accent)", opacity: 0.7 }} />
          )}
          {confirmClear ? (
            <>
              <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>Clear all?</span>
              <button onClick={() => clearMutation.mutate()} style={dangerButtonStyle}>Yes, clear</button>
              <button onClick={() => setConfirmClear(false)} style={ghostButtonStyle}>Cancel</button>
            </>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              disabled={logs.length === 0}
              style={{ ...ghostButtonStyle, opacity: logs.length === 0 ? 0.4 : 1 }}
            >
              Clear log
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div
        style={{
          padding: "8px 20px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          gap: "6px",
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        {TOOL_NAMES.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            style={{
              padding: "3px 10px",
              fontSize: "11px",
              borderRadius: "999px",
              border: `1px solid ${filter === t ? "var(--color-accent)" : "var(--color-border)"}`,
              background: filter === t ? "var(--color-accent-dim)" : "transparent",
              color: filter === t ? "var(--color-accent)" : "var(--color-text-muted)",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              textTransform: "capitalize",
            }}
          >
            {t === "all" ? "All" : (TOOL_LABELS[t] ?? t)}
          </button>
        ))}
      </div>

      {/* Log entries */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {isLoading ? (
          <div style={{ padding: "20px", fontSize: "12px", color: "var(--color-text-muted)" }}>
            Loading…
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>No activity yet</div>
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px" }}>
              Tool calls from web search, memory, weather, and more will appear here.
            </div>
          </div>
        ) : (
          logs.map((log) => <LogRow key={log.id} log={log} expanded={expanded === log.id} onToggle={() => setExpanded(expanded === log.id ? null : log.id)} />)
        )}
      </div>

      {/* Footer count */}
      {logs.length > 0 && (
        <div style={{ padding: "8px 20px", borderTop: "1px solid var(--color-border)", fontSize: "11px", color: "var(--color-text-muted)", flexShrink: 0 }}>
          {data?.total ?? logs.length} total entries
        </div>
      )}
    </div>
  );
}

function LogRow({
  log,
  expanded,
  onToggle,
}: {
  log: ToolLogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        borderBottom: "1px solid var(--color-border)",
        padding: "0",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "9px 20px",
          background: expanded ? "var(--color-surface-2)" : "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "var(--font-sans)",
        }}
      >
        {/* Status dot */}
        <div
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            flexShrink: 0,
            background: log.success ? "var(--color-success)" : "var(--color-danger)",
          }}
        />

        {/* Tool name */}
        <span
          style={{
            fontSize: "11px",
            fontWeight: 500,
            color: "var(--color-text)",
            minWidth: "80px",
            textTransform: "capitalize",
          }}
        >
          {TOOL_LABELS[log.tool_name] ?? log.tool_name}
        </span>

        {/* Input preview */}
        <span style={{ fontSize: "11px", color: "var(--color-text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {log.input_summary || "—"}
        </span>

        {/* Duration */}
        <span style={{ fontSize: "11px", color: "var(--color-text-muted)", flexShrink: 0, minWidth: "40px", textAlign: "right" }}>
          {formatDuration(log.duration_ms)}
        </span>

        {/* Time */}
        <span style={{ fontSize: "11px", color: "var(--color-text-muted)", flexShrink: 0, minWidth: "70px", textAlign: "right" }}>
          {formatTs(log.created_at)}
        </span>

        {/* Chevron */}
        <span style={{ fontSize: "10px", color: "var(--color-text-muted)", transition: "transform 0.15s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}>
          ›
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "8px 20px 12px 36px", background: "var(--color-surface-2)" }}>
          {log.input_summary && (
            <DetailRow label="Input" value={log.input_summary} />
          )}
          <DetailRow label="Status" value={log.success ? "Success" : "Failed"} danger={!log.success} />
          {log.error_message && (
            <DetailRow label="Error" value={log.error_message} danger />
          )}
          {log.duration_ms != null && (
            <DetailRow label="Duration" value={formatDuration(log.duration_ms)} />
          )}
          {log.created_at && (
            <DetailRow label="Time" value={new Date(log.created_at).toLocaleString()} />
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
      <span style={{ fontSize: "11px", color: "var(--color-text-muted)", minWidth: "60px", flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: "11px", color: danger ? "var(--color-danger)" : "var(--color-text)", wordBreak: "break-word" }}>
        {value}
      </span>
    </div>
  );
}

const ghostButtonStyle: React.CSSProperties = {
  padding: "4px 10px",
  background: "transparent",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text-muted)",
  fontSize: "11px",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "4px 10px",
  background: "transparent",
  border: "1px solid var(--color-danger)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-danger)",
  fontSize: "11px",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
};
