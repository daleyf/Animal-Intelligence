import { useState, useRef } from "react";
import { useAppStore } from "@/store/appStore";
import { streamResearch } from "@/api/memory";
import { ResearchSource } from "@/types/memory";

interface Props {
  onClose: () => void;
}

export function ResearchPanel({ onClose }: Props) {
  const { activeModel } = useAppStore();
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const handleResearch = async () => {
    if (!question.trim() || isRunning) return;
    setIsRunning(true);
    setAnswer("");
    setSources([]);
    setError("");
    setStatus("Starting research…");

    const controller = new AbortController();
    abortRef.current = controller;

    let accumulated = "";

    await streamResearch(
      question,
      activeModel,
      {
        onStatus: (msg) => setStatus(msg),
        onToken: (token) => {
          accumulated += token;
          setAnswer(accumulated);
        },
        onDone: (fullContent, srcs) => {
          setAnswer(fullContent);
          setSources(srcs);
          setStatus("");
          setIsRunning(false);
        },
        onError: (msg) => {
          setError(msg);
          setStatus("");
          setIsRunning(false);
        },
      },
      controller.signal,
    );
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsRunning(false);
    setStatus("");
  };

  return (
    <div
      style={{
        width: "360px",
        borderLeft: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text)" }}>
            Research
          </div>
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "1px" }}>
            Web search + LLM synthesis
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text-muted)",
            cursor: "pointer",
            fontSize: "18px",
            lineHeight: 1,
            padding: "2px 6px",
          }}
        >
          ×
        </button>
      </div>

      {/* Input */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleResearch(); }
          }}
          placeholder="What do you want to research?"
          disabled={isRunning}
          rows={2}
          style={{
            width: "100%",
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--color-text)",
            fontSize: "12.5px",
            fontFamily: "var(--font-sans)",
            padding: "8px 10px",
            resize: "none",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
          <button
            onClick={handleResearch}
            disabled={!question.trim() || isRunning}
            style={{
              flex: 1,
              padding: "6px 0",
              background: question.trim() && !isRunning ? "var(--color-accent)" : "var(--color-surface-2)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              color: question.trim() && !isRunning ? "#fff" : "var(--color-text-muted)",
              fontSize: "12px",
              cursor: question.trim() && !isRunning ? "pointer" : "not-allowed",
              fontFamily: "var(--font-sans)",
            }}
          >
            Research
          </button>
          {isRunning && (
            <button onClick={handleStop} style={{
              padding: "6px 12px",
              background: "transparent",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--color-text-muted)",
              fontSize: "12px",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
            }}>
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Status indicator */}
      {status && (
        <div
          style={{
            padding: "8px 14px",
            fontSize: "11px",
            color: "var(--color-text-muted)",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flexShrink: 0,
          }}
        >
          <span className="streaming-cursor" style={{ background: "var(--color-accent)" }} />
          {status}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: "10px 14px", fontSize: "12px", color: "var(--color-danger)" }}>
          {error}
        </div>
      )}

      {/* Answer */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
        {answer && (
          <div
            className="llm-body"
            style={{ fontSize: "13px" }}
            dangerouslySetInnerHTML={{ __html: answer
              .replace(/\[(\d+)\]/g, '<sup style="color:var(--color-accent);font-size:10px">[$1]</sup>')
              .replace(/\n/g, "<br/>") }}
          />
        )}

        {/* Sources */}
        {sources.length > 0 && (
          <div style={{ marginTop: "20px" }}>
            <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "8px" }}>
              Sources
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {sources.map((src, i) => (
                <a
                  key={i}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    padding: "8px 10px",
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    textDecoration: "none",
                  }}
                >
                  <div style={{ fontSize: "11px", color: "var(--color-text)", marginBottom: "2px" }}>
                    [{i + 1}] {src.title}
                  </div>
                  <div style={{ fontSize: "10.5px", color: "var(--color-accent)" }}>
                    {src.source}
                  </div>
                  {src.snippet && (
                    <div style={{ fontSize: "10.5px", color: "var(--color-text-muted)", marginTop: "3px" }}>
                      {src.snippet.slice(0, 120)}…
                    </div>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
