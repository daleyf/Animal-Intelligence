import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { streamChat } from "@/api/chat";
import { StreamingIndicator } from "@/components/chat/StreamingIndicator";
import { Conversation, ConversationListResponse } from "@/types/chat";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

// ── SSE streaming ─────────────────────────────────────────────────────────────

function streamReport(
  model: string,
  callbacks: {
    onConversationId: (id: string) => void;
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
            if (ev.type === "conversation_id") callbacks.onConversationId(ev.conversation_id);
            else if (ev.type === "token") callbacks.onToken(ev.content);
            else if (ev.type === "done") callbacks.onDone();
            else if (ev.type === "error") callbacks.onError(ev.message);
          } catch {
            // skip malformed
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== "AbortError") callbacks.onError(String(err));
    });
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "0",
        userSelect: "none",
      }}
    >
      <svg
        width="46"
        height="46"
        viewBox="0 0 46 46"
        fill="none"
        style={{ opacity: 0.35, marginBottom: "20px", animation: "fade-in 0.8s ease both" }}
      >
        <circle cx="23" cy="23" r="8" stroke="#0078FF" strokeWidth="2.2" />
        <path
          d="M23 3v4M23 39v4M3 23h4M39 23h4M8.5 8.5l2.8 2.8M34.7 34.7l2.8 2.8M34.7 8.5l-2.8 2.8M11.3 34.7l-2.8 2.8"
          stroke="#0078FF"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>

      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "21px",
          fontWeight: 400,
          color: "var(--color-text)",
          letterSpacing: "-0.25px",
          marginBottom: "10px",
          animation: "fade-in 0.9s ease 0.15s both",
        }}
      >
        Daily Report
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "var(--color-text-muted)",
          letterSpacing: "0.04em",
          marginBottom: "32px",
          animation: "fade-in 0.9s ease 0.3s both",
        }}
      >
        Personalized briefing of your day · Ask follow-ups after
      </div>

      <button
        onClick={onGenerate}
        style={{
          padding: "11px 28px",
          background: "var(--color-accent)",
          border: "none",
          borderRadius: "10px",
          color: "#fff",
          fontSize: "14px",
          fontWeight: 500,
          fontFamily: "var(--font-sans)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          boxShadow: "0 4px 16px rgba(0, 120, 255, 0.28)",
          animation: "fade-in 0.9s ease 0.45s both",
          transition: "box-shadow 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 6px 22px rgba(0, 120, 255, 0.42)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 4px 16px rgba(0, 120, 255, 0.28)";
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M7 0.5v1.5M7 12v1.5M0.5 7h1.5M12 7h1.5M2.7 2.7l1.1 1.1M10.2 10.2l1.1 1.1M10.2 2.7l-1.1 1.1M4.1 10.2l-1.1 1.1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        Generate Report
      </button>
    </div>
  );
}

// ── Message bubbles ───────────────────────────────────────────────────────────

function UserBubble({ content }: { content: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        padding: "5px 20px",
        animation: "message-in 0.18s ease",
      }}
    >
      <div
        style={{
          maxWidth: "66%",
          padding: "10px 15px",
          background: "var(--color-user-bubble)",
          border: "1px solid var(--color-user-bubble-border)",
          borderRadius: "16px 16px 3px 16px",
          fontSize: "14px",
          lineHeight: "1.65",
          color: "var(--color-text)",
          fontFamily: "var(--font-sans)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {content}
      </div>
    </div>
  );
}

function AssistantBubble({ msg }: { msg: ReportMessage }) {
  const { content, isStreaming } = msg;

  return (
    <div
      style={{
        display: "flex",
        padding: "10px 20px 10px 40px",
        position: "relative",
        animation: "message-in 0.2s ease",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "22px",
          top: "19px",
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: "var(--color-accent)",
          opacity: 0.7,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {isStreaming && !content ? (
          <StreamingIndicator />
        ) : (
          <div className="llm-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--color-accent)" }}
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
            {isStreaming && <StreamingIndicator inline />}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ReportPage() {
  const qc = useQueryClient();
  const { activeModel, setActiveConversation } = useAppStore();

  const [messages, setMessages] = useState<ReportMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [focused, setFocused] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const convIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const addPendingAssistant = (): string => {
    const id = uid();
    setMessages((prev) => [
      ...prev,
      { id, role: "assistant", content: "", isStreaming: true },
    ]);
    return id;
  };

  const updateMessage = (id: string, patch: Partial<ReportMessage>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  };

  // ── Auto-scroll ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userScrolled) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isRunning, userScrolled]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setUserScrolled(!atBottom);
  };

  useEffect(() => {
    setUserScrolled(false);
  }, [messages.length]);

  // ── Generate report ───────────────────────────────────────────────────────────

  const handleGenerate = useCallback(() => {
    setMessages([]);
    setIsRunning(true);
    setUserScrolled(false);
    convIdRef.current = null;

    const asstId = uid();
    setMessages([{ id: asstId, role: "assistant", content: "", isStreaming: true }]);

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = "";

    const todayTitle = `Daily Report \u2013 ${new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })}`;

    streamReport(
      activeModel,
      {
        onConversationId: (id) => {
          convIdRef.current = id;
          setActiveConversation(id);
          qc.setQueriesData<ConversationListResponse>(
            { queryKey: ["conversations"] },
            (old) => {
              if (!old) return old;
              if (old.conversations.some((c: Conversation) => c.id === id)) return old;
              const newConvo: Conversation = {
                id,
                title: todayTitle,
                model_name: activeModel,
                conversation_type: "report",
                updated_at: new Date().toISOString(),
                preview: "",
              };
              return {
                ...old,
                conversations: [newConvo, ...old.conversations],
                total: old.total + 1,
              };
            },
          );
        },
        onToken: (t) => {
          accumulated += t;
          updateMessage(asstId, { content: accumulated });
        },
        onDone: () => {
          updateMessage(asstId, { isStreaming: false });
          setIsRunning(false);
          qc.invalidateQueries({ queryKey: ["conversations"] });
        },
        onError: (msg) => {
          updateMessage(asstId, { content: msg || "Report generation failed.", isStreaming: false });
          setIsRunning(false);
        },
      },
      controller.signal,
    );
  }, [activeModel, qc, setActiveConversation]);

  // ── Follow-up chat ────────────────────────────────────────────────────────────

  const doChat = async (message: string) => {
    const userMsgId = uid();
    setMessages((prev) => [...prev, { id: userMsgId, role: "user", content: message }]);
    const asstId = addPendingAssistant();
    setIsRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = "";

    await streamChat(
      { message, conversation_id: convIdRef.current, model: activeModel },
      {
        onConversationId: (id) => {
          convIdRef.current = id;
          setActiveConversation(id);
        },
        onToken: (token) => {
          accumulated += token;
          updateMessage(asstId, { content: accumulated });
        },
        onDone: (fullContent) => {
          updateMessage(asstId, { content: fullContent, isStreaming: false });
          setIsRunning(false);
          qc.invalidateQueries({ queryKey: ["conversations"] });
        },
        onError: (msg) => {
          updateMessage(asstId, { content: msg, isStreaming: false });
          setIsRunning(false);
        },
      },
      controller.signal,
    );
  };

  // ── Input handlers ────────────────────────────────────────────────────────────

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isRunning) return;
    setInputValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await doChat(text);
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsRunning(false);
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
    );
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const canSend = !isRunning && inputValue.trim().length > 0;
  const hasMessages = messages.length > 0;

  const placeholder = isRunning
    ? "Generating…"
    : "Ask a follow-up about your report…";

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100%",
      }}
    >
      {/* Empty state or message thread */}
      {!hasMessages ? (
        <EmptyState onGenerate={handleGenerate} />
      ) : (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 0 24px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "760px",
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              flex: 1,
            }}
          >
            {messages.map((msg) =>
              msg.role === "user" ? (
                <UserBubble key={msg.id} content={msg.content} />
              ) : (
                <AssistantBubble key={msg.id} msg={msg} />
              ),
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      {/* Chat input — appears once report is started */}
      {hasMessages && (
        <div
          style={{
            padding: "6px 0 14px",
            background: "var(--color-bg)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "760px",
              margin: "0 auto",
              padding: "0 20px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "center",
                background: "var(--color-surface-2)",
                border: `1px solid ${focused ? "rgba(0,120,255,0.45)" : "var(--color-border)"}`,
                borderRadius: "14px",
                padding: "10px 10px 10px 16px",
                boxShadow: focused
                  ? "0 0 0 3px rgba(0,120,255,0.08), 0 4px 16px rgba(0,0,0,0.22)"
                  : "0 2px 10px rgba(0,0,0,0.18)",
                transition: "border-color 0.15s, box-shadow 0.18s",
              }}
            >
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={handleInput}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={placeholder}
                disabled={isRunning}
                rows={1}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  color: "var(--color-text)",
                  fontSize: "14px",
                  fontFamily: "var(--font-sans)",
                  resize: "none",
                  outline: "none",
                  lineHeight: "1.55",
                  maxHeight: "160px",
                  overflow: "auto",
                }}
              />

              {isRunning ? (
                <button
                  onClick={handleStop}
                  title="Stop"
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--color-accent)",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <rect x="1" y="1" width="8" height="8" rx="1.5" fill="currentColor" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  title="Send (Enter)"
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "var(--radius-sm)",
                    background: canSend ? "var(--color-accent)" : "transparent",
                    border: canSend ? "none" : "1px solid var(--color-border)",
                    color: canSend ? "#fff" : "var(--color-text-muted)",
                    cursor: canSend ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "background 0.18s, border-color 0.18s, color 0.18s",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path
                      d="M6.5 11V2M2 6l4.5-4.5L11 6"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>

            <div
              style={{
                fontSize: "10.5px",
                color: "var(--color-text-muted)",
                textAlign: "center",
                marginTop: "8px",
                letterSpacing: "0.02em",
              }}
            >
              {isRunning
                ? "Generating your daily report…"
                : "Follow-ups use the local LLM · Shift+Enter for new line"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
