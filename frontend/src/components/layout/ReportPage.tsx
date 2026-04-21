import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { useAppStore } from "@/store/appStore";

interface ScheduleSettings {
  enabled: boolean;
  time: string;
}

interface LatestReport {
  content: string;
  generated_at: string;
}

function streamReport(
  model: string,
  callbacks: {
    onToken: (t: string) => void;
    onDone: () => void;
    onError: (msg: string) => void;
  },
  signal: AbortSignal,
) {
  fetch(`/api/v1/report?model=${encodeURIComponent(model)}`, { signal })
    .then(async (resp) => {
      if (!resp.body) {
        callbacks.onError("No response body");
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "token") callbacks.onToken(ev.content);
            else if (ev.type === "done") callbacks.onDone();
            else if (ev.type === "error") callbacks.onError(ev.message);
          } catch {
            // Skip malformed events from the stream.
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== "AbortError") callbacks.onError(String(err));
    });
}

export function ReportPage() {
  const qc = useQueryClient();
  const { activeModel } = useAppStore();
  const [content, setContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const { data: latest } = useQuery({
    queryKey: ["report-latest"],
    queryFn: () => apiFetch<LatestReport>("/report/latest"),
    staleTime: 30_000,
  });

  const { data: schedule } = useQuery({
    queryKey: ["report-schedule"],
    queryFn: () => apiFetch<ScheduleSettings>("/report/schedule"),
    staleTime: 60_000,
  });

  const scheduleMutation = useMutation({
    mutationFn: (body: ScheduleSettings) =>
      apiFetch<ScheduleSettings>("/report/schedule", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => qc.setQueryData(["report-schedule"], data),
  });

  const handleGenerate = () => {
    if (isGenerating) {
      abortRef.current?.abort();
      setIsGenerating(false);
      return;
    }

    setContent("");
    setError("");
    setIsGenerating(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = "";

    streamReport(
      activeModel,
      {
        onToken: (t) => {
          accumulated += t;
          setContent(accumulated);
        },
        onDone: () => setIsGenerating(false),
        onError: (msg) => {
          setError(msg);
          setIsGenerating(false);
        },
      },
      controller.signal,
    );
  };

  const displayContent = content || latest?.content || "";
  const generatedAt = content
    ? "Just now"
    : latest?.generated_at
      ? new Date(latest.generated_at).toLocaleString()
      : null;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text)" }}>
              Daily Report
            </div>
            {generatedAt && (
              <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
                {generatedAt}
              </div>
            )}
          </div>
          <button
            onClick={handleGenerate}
            style={{
              padding: "7px 16px",
              background: isGenerating ? "var(--color-surface-2)" : "var(--color-accent)",
              border: isGenerating ? "1px solid var(--color-border)" : "none",
              borderRadius: "var(--radius-sm)",
              color: isGenerating ? "var(--color-text-muted)" : "#fff",
              fontSize: "12px",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {isGenerating ? (
              <>
                <span className="streaming-cursor" style={{ background: "var(--color-text-muted)" }} />
                Stop
              </>
            ) : (
              <>Generate report</>
            )}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {error && (
            <div
              style={{
                padding: "10px 14px",
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-danger)",
                borderRadius: "var(--radius-sm)",
                fontSize: "12px",
                color: "var(--color-danger)",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}
          {displayContent ? (
            <div
              className="llm-body"
              style={{ fontSize: "14px", lineHeight: "1.75" }}
              dangerouslySetInnerHTML={{
                __html: displayContent
                  .replace(/\n\n/g, "</p><p>")
                  .replace(/\n/g, "<br/>")
                  .replace(/^/, "<p>")
                  .replace(/$/, "</p>"),
              }}
            />
          ) : !isGenerating ? (
            <div style={{ textAlign: "center", paddingTop: "60px" }}>
              <div style={{ fontSize: "24px", marginBottom: "12px", fontWeight: 600 }}>No Daily Reports</div>
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                Click "Generate report" to create your daily briefing
              </div>
            </div>
          ) : null}
          {isGenerating && !displayContent && (
            <div
              style={{
                display: "flex",
                gap: "6px",
                alignItems: "center",
                color: "var(--color-text-muted)",
                fontSize: "12px",
              }}
            >
              <span className="streaming-cursor" style={{ background: "var(--color-accent)" }} />
              Generating your daily report...
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          width: "240px",
          borderLeft: "1px solid var(--color-border)",
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          flexShrink: 0,
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
          }}
        >
          Auto-Schedule
        </div>

        <label
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        >
          <span style={{ fontSize: "12px", color: "var(--color-text)" }}>Daily auto-generate</span>
          <input
            type="checkbox"
            checked={schedule?.enabled ?? false}
            onChange={(e) =>
              scheduleMutation.mutate({ enabled: e.target.checked, time: schedule?.time ?? "07:00" })
            }
            style={{ accentColor: "var(--color-accent)", width: "15px", height: "15px" }}
          />
        </label>

        {schedule?.enabled && (
          <div>
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "6px" }}>
              Time (UTC)
            </div>
            <input
              type="time"
              value={schedule.time}
              onChange={(e) => scheduleMutation.mutate({ enabled: true, time: e.target.value })}
              style={{
                width: "100%",
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--color-text)",
                fontSize: "12px",
                padding: "6px 8px",
                fontFamily: "var(--font-sans)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ fontSize: "10.5px", color: "var(--color-text-muted)", marginTop: "4px" }}>
              Report generates in the background and is ready when you open the app.
            </div>
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "16px" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              marginBottom: "10px",
            }}
          >
            Integrations
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {["Weather", "Calendar"].map((label) => (
              <a
                key={label}
                href="/settings/integrations"
                style={{ fontSize: "11px", color: "var(--color-accent)", textDecoration: "none" }}
              >
                Configure {label} {"->"}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
