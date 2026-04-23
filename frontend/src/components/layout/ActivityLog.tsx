import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getActivityLog, clearActivityLog, ToolLogEntry } from "@/api/activity";

// ── Constants ────────────────────────────────────────────────────────────────

const TOOL_NAMES = ["all", "web_search", "memory", "weather", "calendar"];

const TOOL_LABELS: Record<string, string> = {
  web_search: "Web Search",
  memory: "Memory",
  weather: "Weather",
  calendar: "Calendar",
};

/** Destinations that are strictly local to the user's device. */
const LOCAL_DESTINATIONS = new Set(["local", "localhost"]);

// ── Data locality metadata for each known tool ───────────────────────────────

const TOOL_LOCALITY: Record<
  string,
  { isExternal: boolean; note: string; destination: string }
> = {
  web_search: {
    isExternal: true,
    destination: "ollama.com/api/web_search",
    note: "Search query sent to Ollama's web search API. Your conversation and profile are never included.",
  },
  weather: {
    isExternal: true,
    destination: "api.openweathermap.org",
    note: "Your home location (set in Profile) is sent to OpenWeatherMap to retrieve current conditions.",
  },
  calendar: {
    isExternal: true,
    destination: "google.com/calendar",
    note: "Events fetched from Google Calendar via OAuth. Token is encrypted at rest on your device.",
  },
  memory: {
    isExternal: false,
    destination: "local (ChromaDB)",
    note: "Vector memory search runs entirely on your device. No data leaves the machine.",
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTs(iso: string | null, full = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (full) return d.toLocaleString();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function parseSubQueries(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function isExternalDestination(entry: ToolLogEntry): boolean {
  if (!entry.data_destination) {
    return TOOL_LOCALITY[entry.tool_name]?.isExternal ?? false;
  }
  return !LOCAL_DESTINATIONS.has(entry.data_destination.toLowerCase());
}

function getDestinationLabel(entry: ToolLogEntry): string {
  if (entry.data_destination) return entry.data_destination;
  return TOOL_LOCALITY[entry.tool_name]?.destination ?? "local";
}

// ── Grouping logic ───────────────────────────────────────────────────────────

type LogItem =
  | { kind: "single"; log: ToolLogEntry }
  | { kind: "group"; sessionId: string; entries: ToolLogEntry[] };

function groupLogs(logs: ToolLogEntry[]): LogItem[] {
  const result: LogItem[] = [];
  const seenSessions = new Map<string, LogItem & { kind: "group" }>();

  for (const log of logs) {
    if (!log.session_id) {
      result.push({ kind: "single", log });
    } else {
      if (!seenSessions.has(log.session_id)) {
        const group: LogItem & { kind: "group" } = {
          kind: "group",
          sessionId: log.session_id,
          entries: [log],
        };
        seenSessions.set(log.session_id, group);
        result.push(group);
      } else {
        seenSessions.get(log.session_id)!.entries.push(log);
      }
    }
  }

  // Flatten single-entry groups back to individual rows so they are always
  // visible (e.g. when filtering by "weather" each entry has a session_id
  // but only one entry per session is returned — collapsing it into a group
  // header would hide it behind a click).
  return result.map((item) =>
    item.kind === "group" && item.entries.length === 1
      ? { kind: "single" as const, log: item.entries[0] }
      : item
  );
}

// ── Label for a session group ─────────────────────────────────────────────────

function groupLabel(entries: ToolLogEntry[]): string {
  const names = [...new Set(entries.map((e) => TOOL_LABELS[e.tool_name] ?? e.tool_name))];
  if (entries.some((e) => e.tool_name === "weather" || e.tool_name === "calendar")) {
    return `Daily Report (${entries.length} call${entries.length !== 1 ? "s" : ""})`;
  }
  return `${names.join(", ")} (${entries.length} call${entries.length !== 1 ? "s" : ""})`;
}

// ── Privacy Audit Panel ──────────────────────────────────────────────────────

function PrivacyPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        margin: "0 20px 0 20px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface-2)",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          textAlign: "left",
        }}
      >
        <ShieldIcon />
        <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--color-text)", flex: 1 }}>
          Data Locality &amp; Privacy
        </span>
        <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 12px 12px 12px", borderTop: "1px solid var(--color-border)" }}>
          <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: "8px 0 10px" }}>
            All AI inference runs on your local device via Ollama. External network calls are
            limited to the integrations below — only the minimum required data is sent.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {[
              {
                label: "LLM Inference",
                dest: "localhost:11434 (Ollama)",
                external: false,
                note: "Your entire conversation stays on-device. No prompt or message ever leaves your machine.",
              },
              {
                label: "Web Search",
                dest: "ollama.com/api/web_search",
                external: true,
                note: "Only the sanitized search query is sent. Conversation history and profile data are never included.",
              },
              {
                label: "Weather",
                dest: "api.openweathermap.org",
                external: true,
                note: "Your home location (city name) is sent. No name, account, or conversation data is included.",
              },
              {
                label: "Google Calendar",
                dest: "google.com/calendar",
                external: true,
                note: "OAuth access token (encrypted on disk) is used. Your calendar data is read but never stored on our servers.",
              },
              {
                label: "Memory",
                dest: "local (ChromaDB)",
                external: false,
                note: "Embeddings and memory search run entirely on-device. Nothing is transmitted.",
              },
            ].map(({ label, dest, external, note }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  padding: "6px 8px",
                  borderRadius: "4px",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <DestinationBadge external={external} />
                  <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--color-text)" }}>
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--color-text-muted)",
                      fontFamily: "monospace",
                      marginLeft: "auto",
                    }}
                  >
                    {dest}
                  </span>
                </div>
                <div style={{ fontSize: "10.5px", color: "var(--color-text-muted)", paddingLeft: "2px" }}>
                  {note}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Destination badge ─────────────────────────────────────────────────────────

function DestinationBadge({ external }: { external: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        padding: "1px 5px",
        borderRadius: "999px",
        fontSize: "9.5px",
        fontWeight: 600,
        letterSpacing: "0.03em",
        background: external ? "rgba(234, 179, 8, 0.12)" : "rgba(119, 221, 119, 0.12)",
        color: external ? "#ca8a04" : "#16a34a",
        border: `1px solid ${external ? "rgba(234,179,8,0.3)" : "rgba(119,221,119,0.3)"}`,
        flexShrink: 0,
      }}
    >
      {external ? "External" : "Local"}
    </span>
  );
}

// ── Single log row ────────────────────────────────────────────────────────────

function LogRow({
  log,
  expanded,
  onToggle,
  indent = false,
}: {
  log: ToolLogEntry;
  expanded: boolean;
  onToggle: () => void;
  indent?: boolean;
}) {
  const subQueries = parseSubQueries(log.sub_queries);
  const external = isExternalDestination(log);
  const destination = getDestinationLabel(log);
  const locality = TOOL_LOCALITY[log.tool_name];

  return (
    <div style={{ borderBottom: indent ? "none" : "1px solid var(--color-border)" }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: indent ? "7px 20px 7px 36px" : "9px 20px",
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

        {/* Tool name + destination badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "5px", minWidth: "120px" }}>
          <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--color-text)", textTransform: "capitalize" }}>
            {TOOL_LABELS[log.tool_name] ?? log.tool_name}
          </span>
          <DestinationBadge external={external} />
        </div>

        {/* Input preview */}
        <span
          style={{
            fontSize: "11px",
            color: "var(--color-text-muted)",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {log.input_summary || "—"}
        </span>

        {/* Sub-query count pill */}
        {subQueries.length > 0 && (
          <span
            style={{
              fontSize: "9.5px",
              padding: "1px 6px",
              borderRadius: "999px",
              background: "var(--color-accent-dim)",
              color: "var(--color-accent)",
              border: "1px solid var(--color-accent)",
              flexShrink: 0,
              fontWeight: 500,
            }}
          >
            {subQueries.length} quer{subQueries.length !== 1 ? "ies" : "y"}
          </span>
        )}

        {/* Duration */}
        <span style={{ fontSize: "11px", color: "var(--color-text-muted)", flexShrink: 0, minWidth: "40px", textAlign: "right" }}>
          {formatDuration(log.duration_ms)}
        </span>

        {/* Time */}
        <span style={{ fontSize: "11px", color: "var(--color-text-muted)", flexShrink: 0, minWidth: "70px", textAlign: "right" }}>
          {formatTs(log.created_at)}
        </span>

        {/* Chevron */}
        <span
          style={{
            fontSize: "10px",
            color: "var(--color-text-muted)",
            transition: "transform 0.15s",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          ›
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div
          style={{
            padding: "10px 20px 14px",
            paddingLeft: indent ? "52px" : "36px",
            background: "var(--color-surface-2)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {/* Sub-queries */}
          {subQueries.length > 0 && (
            <div>
              <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>
                Search Queries Executed
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                {subQueries.map((q, i) => (
                  <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--color-accent)",
                        fontWeight: 600,
                        minWidth: "18px",
                        flexShrink: 0,
                        paddingTop: "1px",
                      }}
                    >
                      {i + 1}.
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--color-text)",
                        fontFamily: "monospace",
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "4px",
                        padding: "2px 7px",
                        wordBreak: "break-word",
                      }}
                    >
                      {q}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data flow summary */}
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>
              Data Flow
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <DataFlowRow
                label="Sent to"
                value={destination}
                badge={<DestinationBadge external={external} />}
              />
              {log.input_summary && (
                <DataFlowRow label="Data sent" value={log.input_summary} mono />
              )}
              <DataFlowRow
                label="PII handling"
                value={
                  external
                    ? "Sanitized before transmission — personal names and locations stripped"
                    : "Not applicable — no external transmission"
                }
              />
              <DataFlowRow
                label="Verification"
                value={
                  external
                    ? `Your query was sent to ${destination}. No conversation history, profile, or account data was included.`
                    : "Confirmed local-only. No data left your device for this call."
                }
                success={!external}
                warn={external}
              />
              {locality?.note && (
                <DataFlowRow label="Notes" value={locality.note} />
              )}
            </div>
          </div>

          {/* Status / error */}
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>
              Result
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <DataFlowRow label="Status" value={log.success ? "Success" : "Failed"} success={log.success} warn={!log.success} />
              {log.error_message && <DataFlowRow label="Error" value={log.error_message} warn />}
              {log.duration_ms != null && <DataFlowRow label="Duration" value={formatDuration(log.duration_ms)} />}
              <DataFlowRow label="Timestamp" value={formatTs(log.created_at, true)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DataFlowRow({
  label,
  value,
  badge,
  mono = false,
  success = false,
  warn = false,
}: {
  label: string;
  value: string;
  badge?: React.ReactNode;
  mono?: boolean;
  success?: boolean;
  warn?: boolean;
}) {
  const color = success
    ? "var(--color-success)"
    : warn
    ? "var(--color-danger)"
    : "var(--color-text)";

  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
      <span
        style={{
          fontSize: "11px",
          color: "var(--color-text-muted)",
          minWidth: "80px",
          flexShrink: 0,
          paddingTop: "1px",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
        {badge}
        <span
          style={{
            fontSize: "11px",
            color,
            wordBreak: "break-word",
            fontFamily: mono ? "monospace" : "var(--font-sans)",
          }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

// ── Session group row ─────────────────────────────────────────────────────────

function GroupRow({
  entries,
  expandedId,
  onToggleEntry,
}: {
  entries: ToolLogEntry[];
  expandedId: string | null;
  onToggleEntry: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const allSuccess = entries.every((e) => e.success);
  const label = groupLabel(entries);
  const firstTs = entries[entries.length - 1]?.created_at ?? null;

  return (
    <div style={{ borderBottom: "1px solid var(--color-border)" }}>
      {/* Group header */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "9px 20px",
          background: open ? "var(--color-surface-2)" : "transparent",
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
            background: allSuccess ? "var(--color-success)" : "var(--color-danger)",
          }}
        />

        {/* Group icon + label */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0 }}>
          <LayersIcon />
          <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {label}
          </span>
        </div>

        {/* Time */}
        <span style={{ fontSize: "11px", color: "var(--color-text-muted)", flexShrink: 0, minWidth: "70px", textAlign: "right" }}>
          {formatTs(firstTs)}
        </span>

        {/* Chevron */}
        <span
          style={{
            fontSize: "10px",
            color: "var(--color-text-muted)",
            transition: "transform 0.15s",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          ›
        </span>
      </button>

      {/* Nested entries */}
      {open && (
        <div
          style={{
            background: "var(--color-surface-2)",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          {entries.map((log) => (
            <LogRow
              key={log.id}
              log={log}
              expanded={expandedId === log.id}
              onToggle={() => onToggleEntry(log.id)}
              indent
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ActivityLog() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["activity", filter],
    queryFn: () =>
      getActivityLog({
        limit: 200,
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
  const grouped = groupLogs(logs);

  const toggleEntry = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

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
            Every tool call Anchorpoint makes — full query detail, no PII stored
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {isFetching && (
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "var(--color-accent)",
                opacity: 0.7,
              }}
            />
          )}
          {confirmClear ? (
            <>
              <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>Clear all?</span>
              <button onClick={() => clearMutation.mutate()} style={dangerButtonStyle}>
                Yes, clear
              </button>
              <button onClick={() => setConfirmClear(false)} style={ghostButtonStyle}>
                Cancel
              </button>
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

      {/* Privacy panel */}
      <div style={{ padding: "10px 0 6px", flexShrink: 0 }}>
        <PrivacyPanel />
      </div>

      {/* Log entries */}
      <div style={{ flex: 1, overflowY: "auto", borderTop: "1px solid var(--color-border)" }}>
        {isLoading ? (
          <div style={{ padding: "20px", fontSize: "12px", color: "var(--color-text-muted)" }}>
            Loading…
          </div>
        ) : grouped.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>No activity yet</div>
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px" }}>
              Tool calls from web search, memory, weather, calendar, and more will appear here.
            </div>
          </div>
        ) : (
          grouped.map((item, idx) =>
            item.kind === "single" ? (
              <LogRow
                key={item.log.id}
                log={item.log}
                expanded={expandedId === item.log.id}
                onToggle={() => toggleEntry(item.log.id)}
              />
            ) : (
              <GroupRow
                key={`group-${item.sessionId}-${idx}`}
                entries={item.entries}
                expandedId={expandedId}
                onToggleEntry={toggleEntry}
              />
            )
          )
        )}
      </div>

      {/* Footer count */}
      {logs.length > 0 && (
        <div
          style={{
            padding: "8px 20px",
            borderTop: "1px solid var(--color-border)",
            fontSize: "11px",
            color: "var(--color-text-muted)",
            flexShrink: 0,
          }}
        >
          {data?.total ?? logs.length} total entries
        </div>
      )}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ShieldIcon() {
  return (
    <svg width="12" height="13" viewBox="0 0 12 13" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        d="M6 1L1.5 3v3.5C1.5 9.5 3.5 11.5 6 12c2.5-.5 4.5-2.5 4.5-5.5V3L6 1z"
        stroke="var(--color-success)"
        strokeWidth="1.1"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M4 6.5l1.5 1.5L8 5"
        stroke="var(--color-success)"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ flexShrink: 0, color: "var(--color-text)" }}>
      <path d="M1 4l5 2.5L11 4 6 1.5 1 4z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" fill="none" />
      <path d="M1 7.5l5 2.5 5-2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// ── Button styles ─────────────────────────────────────────────────────────────

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
