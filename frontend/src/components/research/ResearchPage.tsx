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
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/appStore";
import { streamResearch } from "@/api/memory";
import { streamChat } from "@/api/chat";
import { fetchConversation } from "@/api/conversations";
import { ResearchSource } from "@/types/memory";
import { Conversation, ConversationListResponse } from "@/types/chat";
import { StreamingIndicator } from "@/components/chat/StreamingIndicator";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ResearchMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ResearchSource[];   // present on research-result messages
  reasoning?: string[];         // status steps collected during research
  isStreaming?: boolean;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

/**
 * Convert inline [n] or [Nn] citation markers to markdown links pointing at
 * the corresponding source URL, so ReactMarkdown renders them as clickable anchors.
 *
 * Handles both clean [1] format and the [N1] / [N2] format the LLM sometimes
 * produces when it misreads the "[N]" placeholder in the prompt instructions.
 */
function preprocessCitations(content: string, sources: ResearchSource[]): string {
  if (!sources.length) return content;
  // Match [1], [2] … as well as [N1], [N2] … where N is any leading non-digit prefix
  return content.replace(/\[([A-Za-z]*\d+)\]/g, (_match, token) => {
    // Extract the trailing numeric part to find the 1-based source index
    const digits = token.replace(/^\D+/, "");
    const idx = parseInt(digits, 10) - 1;
    if (idx >= 0 && idx < sources.length) {
      // Render as [[token]](url) — ReactMarkdown turns this into a link with text [token]
      return `[[${token}]](${sources[idx].url})`;
    }
    // Out-of-range or hallucinated citation — remove it entirely rather than
    // leaving a broken [6] or [7] marker in the visible text
    return "";
  });
}

// ── Reasoning chain dropdown ──────────────────────────────────────────────────

function ReasoningChain({
  steps,
  isStreaming,
}: {
  steps: string[];
  isStreaming?: boolean;
}) {
  // Open while streaming so the user sees live progress; auto-close when done
  const [open, setOpen] = useState(true);
  const prevStreaming = useRef(isStreaming);

  useEffect(() => {
    if (prevStreaming.current && !isStreaming) {
      setOpen(false);
    }
    prevStreaming.current = isStreaming;
  }, [isStreaming]);

  if (steps.length === 0) return null;

  return (
    <div style={{ marginBottom: "12px" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          background: "none",
          border: "none",
          padding: "0",
          cursor: "pointer",
          color: "var(--color-text-muted)",
          fontSize: "11.5px",
          fontFamily: "var(--font-sans)",
          opacity: 0.75,
          userSelect: "none",
        }}
      >
        <svg
          width="9"
          height="9"
          viewBox="0 0 9 9"
          fill="none"
          style={{
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
            flexShrink: 0,
          }}
        >
          <path d="M2 1.5l4 3-4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Research steps ({steps.length})
        {isStreaming && (
          <span
            className="streaming-cursor"
            style={{ background: "var(--color-text-muted)", marginLeft: "2px" }}
          />
        )}
      </button>

      {open && (
        <div
          style={{
            marginTop: "7px",
            paddingLeft: "14px",
            borderLeft: "2px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          {steps.map((step, i) => (
            <div
              key={i}
              style={{
                fontSize: "11.5px",
                color: "var(--color-text-muted)",
                lineHeight: "1.5",
                opacity: 0.8,
              }}
            >
              {step}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Source card ───────────────────────────────────────────────────────────────

function SourceCard({ src, index }: { src: ResearchSource; index: number }) {
  return (
    <a
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
        [{index + 1}] {src.title}
      </div>
      <div style={{ fontSize: "10.5px", color: "var(--color-accent)" }}>{src.source}</div>
      {src.snippet && (
        <div style={{ fontSize: "10.5px", color: "var(--color-text-muted)", marginTop: "3px" }}>
          {src.snippet.slice(0, 120)}…
        </div>
      )}
    </a>
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

function AssistantBubble({ msg }: { msg: ResearchMessage }) {
  const { content, sources, reasoning, isStreaming } = msg;
  const isEmpty = !content;

  return (
    <div
      style={{
        display: "flex",
        padding: "10px 20px 10px 40px",
        position: "relative",
        animation: "message-in 0.2s ease",
      }}
    >
      {/* Dot marker — solid for research results, dimmer for chat */}
      <div
        style={{
          position: "absolute",
          left: "22px",
          top: "19px",
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: "var(--color-accent)",
          opacity: reasoning !== undefined ? 0.7 : 0.4,
          flexShrink: 0,
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Reasoning chain — only on research messages */}
        {reasoning !== undefined && (
          <ReasoningChain steps={reasoning} isStreaming={isStreaming} />
        )}

        {/* Main answer */}
        {isStreaming && isEmpty ? (
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
              {!isStreaming && sources?.length
                ? preprocessCitations(content, sources)
                : content}
            </ReactMarkdown>
            {isStreaming && <StreamingIndicator inline />}
          </div>
        )}

        {/* Sources — shown only after streaming completes */}
        {!isStreaming && sources && sources.length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <div
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                marginBottom: "8px",
              }}
            >
              Sources
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {sources.map((src, i) => (
                <SourceCard key={i} src={src} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
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
        width="44"
        height="44"
        viewBox="0 0 44 44"
        fill="none"
        style={{ opacity: 0.35, marginBottom: "20px", animation: "fade-in 0.8s ease both" }}
      >
        <circle cx="19" cy="19" r="13" stroke="#0078FF" strokeWidth="2.2" />
        <line x1="28.5" y1="28.5" x2="39" y2="39" stroke="#0078FF" strokeWidth="2.4" strokeLinecap="round" />
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
        Research anything
      </div>
      <div
        style={{
          fontSize: "12px",
          color: "var(--color-text-muted)",
          letterSpacing: "0.04em",
          animation: "fade-in 0.9s ease 0.3s both",
        }}
      >
        Web search + LLM synthesis · Continue chatting after
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ResearchPage() {
  const { activeModel, setActiveConversation } = useAppStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const conversationIdParam = searchParams.get("id");

  const [messages, setMessages] = useState<ResearchMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [focused, setFocused] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  // Load a saved conversation when ?id= is present in the URL.
  // Guard: skip if research is actively streaming — the navigate({ replace: true })
  // in onDone fires after streaming ends, so by the time this effect reacts the
  // conversation is already saved and safe to fetch.
  useEffect(() => {
    if (isRunning) return;
    if (!conversationIdParam) {
      setMessages([]);
      setConversationId(null);
      return;
    }
    fetchConversation(conversationIdParam).then((detail) => {
      const reconstructed: ResearchMessage[] = [];
      for (const msg of detail.messages) {
        if (msg.role === "user") {
          reconstructed.push({ id: uid(), role: "user", content: msg.content });
        } else if (msg.role === "assistant") {
          const sources: ResearchSource[] = msg.extra_data?.sources ?? [];
          reconstructed.push({
            id: uid(),
            role: "assistant",
            content: msg.content,
            sources,
            reasoning: [],
          });
        }
      }
      setMessages(reconstructed);
      setConversationId(detail.id);
      setActiveConversation(detail.id);
    }).catch(() => {
      // Conversation not found — show empty state
      setMessages([]);
      setConversationId(null);
    });
  }, [conversationIdParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
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

  // ── Message helpers ──────────────────────────────────────────────────────────

  const addUserMessage = (content: string): void => {
    const id = uid();
    setMessages((prev) => [...prev, { id, role: "user", content }]);
  };

  const addPendingAssistant = (isResearch: boolean): string => {
    const id = uid();
    setMessages((prev) => [
      ...prev,
      {
        id,
        role: "assistant",
        content: "",
        isStreaming: true,
        ...(isResearch ? { reasoning: [], sources: [] } : {}),
      },
    ]);
    return id;
  };

  const updateMessage = (id: string, patch: Partial<ResearchMessage>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    );
  };

  const appendReasoning = (asstId: string, step: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === asstId
          ? { ...m, reasoning: [...(m.reasoning ?? []), step] }
          : m
      )
    );
  };

  // ── Research flow ────────────────────────────────────────────────────────────

  const doResearch = async (question: string) => {
    // Reset to a fresh session
    setMessages([]);
    setConversationId(null);
    addUserMessage(question);
    const asstId = addPendingAssistant(true);
    setIsRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = "";
    let capturedId: string | null = null;

    await streamResearch(
      question,
      activeModel,
      {
        onConversationId: (id) => {
          capturedId = id;
          setConversationId(id);
          // Mark as the active conversation so the sidebar highlights it immediately
          setActiveConversation(id);
          // Optimistically insert into the sidebar list so it appears right away
          queryClient.setQueriesData<ConversationListResponse>(
            { queryKey: ["conversations"] },
            (old) => {
              if (!old) return old;
              if (old.conversations.some((c: Conversation) => c.id === id)) return old;
              const newConvo: Conversation = {
                id,
                title: question.slice(0, 60).trim(),
                model_name: activeModel,
                conversation_type: "research",
                updated_at: new Date().toISOString(),
                preview: question,
              };
              return {
                ...old,
                conversations: [newConvo, ...old.conversations],
                total: old.total + 1,
              };
            }
          );
        },
        onStatus: (msg) => {
          // Append each status step to the reasoning chain inside the message bubble
          appendReasoning(asstId, msg);
        },
        onToken: (token) => {
          accumulated += token;
          updateMessage(asstId, { content: accumulated });
        },
        onDone: (fullContent, srcs) => {
          updateMessage(asstId, {
            content: fullContent,
            sources: srcs,
            isStreaming: false,
          });
          setIsRunning(false);
          // Refresh sidebar so the real title (generated by backend) replaces the optimistic one
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
          // Update the URL so it reflects the persisted conversation — enables
          // proper back-navigation and reload behaviour
          if (capturedId) {
            navigate(`/research?id=${capturedId}`, { replace: true });
          }
        },
        onError: (msg) => {
          updateMessage(asstId, { content: msg, isStreaming: false, sources: undefined });
          setIsRunning(false);
        },
      },
      controller.signal,
    );
  };

  // ── Follow-up chat flow ──────────────────────────────────────────────────────

  const doChat = async (message: string) => {
    addUserMessage(message);
    const asstId = addPendingAssistant(false);
    setIsRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = "";

    await streamChat(
      { message, conversation_id: conversationId, model: activeModel },
      {
        onConversationId: (id) => {
          setConversationId(id);
          setActiveConversation(id);
        },
        onToken: (token) => {
          accumulated += token;
          updateMessage(asstId, { content: accumulated });
        },
        onDone: (fullContent) => {
          updateMessage(asstId, { content: fullContent, isStreaming: false });
          setIsRunning(false);
          // Refresh sidebar to reflect updated_at sort order
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
        onError: (msg) => {
          updateMessage(asstId, { content: msg, isStreaming: false });
          setIsRunning(false);
        },
      },
      controller.signal,
    );
  };

  // ── Send handler ─────────────────────────────────────────────────────────────

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isRunning) return;
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    if (messages.length === 0) {
      await doResearch(text);
    } else {
      await doChat(text);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsRunning(false);
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    );
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  const canSend = !isRunning && inputValue.trim().length > 0;
  const isFirstMessage = messages.length === 0;

  const placeholder = isRunning
    ? isFirstMessage
      ? "Researching…"
      : "Thinking…"
    : isFirstMessage
    ? "Ask something to research…"
    : "Ask a follow-up…";

  // ── Render ───────────────────────────────────────────────────────────────────

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
      {/* Message thread */}
      {messages.length === 0 ? (
        <EmptyState />
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
              )
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      {/* Input area — identical styling to ChatInput */}
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
                title={isFirstMessage ? "Research (Enter)" : "Send (Enter)"}
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
            {isFirstMessage
              ? "First message searches the web · Follow-ups use the local LLM"
              : "Shift+Enter for new line · Follow-ups use the local LLM"}
          </div>
        </div>
      </div>
    </div>
  );
}
