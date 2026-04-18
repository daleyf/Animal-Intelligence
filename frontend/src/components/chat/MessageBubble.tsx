import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DisplayMessage } from "@/types/chat";
import { StreamingIndicator } from "./StreamingIndicator";
import { useSpeech } from "@/hooks/useVoice";

interface Props {
  message: DisplayMessage;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const isStreaming = message.isStreaming;
  const isEmpty = !message.content;
  const { speak, stop, speaking, supported } = useSpeech();
  const [thisMessageSpeaking, setThisMessageSpeaking] = useState(false);

  if (isUser) {
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
          {message.content}
        </div>
      </div>
    );
  }

  /* ── LLM response — editorial, no bubble ─────────────────────────────── */
  return (
    <div
      style={{
        display: "flex",
        padding: "10px 20px 10px 40px",
        position: "relative",
        animation: "message-in 0.2s ease",
      }}
    >
      {/* Ocean dot marker */}
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
        {isStreaming && isEmpty ? (
          <StreamingIndicator />
        ) : (
          <div className="llm-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
            {isStreaming && <StreamingIndicator inline />}
          </div>
        )}

        {/* Read Aloud button — shown on completed assistant messages */}
        {!isStreaming && !isEmpty && supported && (
          <button
            onClick={() => {
              if (thisMessageSpeaking && speaking) {
                stop();
                setThisMessageSpeaking(false);
              } else {
                speak(message.content);
                setThisMessageSpeaking(true);
              }
            }}
            title={thisMessageSpeaking && speaking ? "Stop reading" : "Read aloud"}
            style={{
              marginTop: "6px",
              background: "none",
              border: "none",
              padding: "3px 6px",
              borderRadius: "var(--radius-sm)",
              color: thisMessageSpeaking && speaking
                ? "var(--color-accent)"
                : "var(--color-text-muted)",
              cursor: "pointer",
              fontSize: "11px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              opacity: 0.7,
              transition: "opacity 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
          >
            {/* Speaker icon */}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 4.5H0.5V7.5H2L5 10V2L2 4.5Z"
                fill="currentColor"
              />
              {thisMessageSpeaking && speaking ? (
                <line x1="7.5" y1="4.5" x2="11.5" y2="7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              ) : (
                <>
                  <path d="M7 4.5C7.55 4.91 8 5.41 8 6C8 6.59 7.55 7.09 7 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  <path d="M9 3C10.1 3.73 11 4.79 11 6C11 7.21 10.1 8.27 9 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </>
              )}
            </svg>
            {thisMessageSpeaking && speaking ? "Stop" : "Read aloud"}
          </button>
        )}
      </div>
    </div>
  );
}
