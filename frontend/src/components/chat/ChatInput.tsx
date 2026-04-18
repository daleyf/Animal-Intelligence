import { KeyboardEvent, useCallback, useRef, useState } from "react";
import { useAppStore } from "@/store/appStore";

interface Props {
  onSend: (text: string) => void;
}

export function ChatInput({ onSend }: Props) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const { isGenerating, stopGeneration } = useAppStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const text = value.trim();
    if (!text || isGenerating) return;
    onSend(text);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
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

  const canSend = !isGenerating && value.trim().length > 0;
  const buttonActive = canSend || isGenerating;

  const handleButtonClick = () => {
    if (isGenerating) {
      stopGeneration();
    } else {
      handleSend();
    }
  };

  return (
    /*
     * Outer wrapper matches the main window background exactly — no visible
     * separator.  Because it's a solid flex child sitting below the message
     * list, scrolled content naturally disappears behind it.
     */
    <div
      style={{
        padding: "6px 0 14px",
        background: "var(--color-bg)",
        flexShrink: 0,
      }}
    >
      {/* Centered column — same 760px max-width as the message list */}
      <div
        style={{
          width: "100%",
          maxWidth: "760px",
          margin: "0 auto",
          padding: "0 20px",
        }}
      >

      {/* The floating rounded-rectangle input card */}
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
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={isGenerating ? "Generating…" : "Message Anchorpoint…"}
          disabled={isGenerating}
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

        {/* Send / Stop button — icon morphs between arrow and square */}
        <button
          onClick={handleButtonClick}
          disabled={!buttonActive}
          title={isGenerating ? "Stop generation" : "Send message (Enter)"}
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "var(--radius-sm)",
            background: buttonActive ? "var(--color-accent)" : "transparent",
            border: buttonActive ? "none" : "1px solid var(--color-border)",
            color: buttonActive ? "#fff" : "var(--color-text-muted)",
            cursor: buttonActive ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            position: "relative",
            overflow: "hidden",
            transition: "background 0.18s, border-color 0.18s, color 0.18s",
          }}
        >
          {/* Arrow icon — visible when idle */}
          <svg
            width="13"
            height="13"
            viewBox="0 0 13 13"
            fill="none"
            aria-hidden="true"
            style={{
              position: "absolute",
              opacity: isGenerating ? 0 : 1,
              transform: isGenerating ? "scale(0.4) rotate(-90deg)" : "scale(1) rotate(0deg)",
              transition: "opacity 0.18s ease, transform 0.18s ease",
            }}
          >
            <path
              d="M6.5 11V2M2 6l4.5-4.5L11 6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Square icon — visible when generating */}
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
            style={{
              position: "absolute",
              opacity: isGenerating ? 1 : 0,
              transform: isGenerating ? "scale(1)" : "scale(0.4)",
              transition: "opacity 0.18s ease, transform 0.18s ease",
            }}
          >
            <rect x="1" y="1" width="8" height="8" rx="1.5" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/*
       * Hint text sits on the same var(--color-bg) outer wrapper, so it looks
       * uniform with the main window — but scrolled messages are clipped behind
       * the solid outer div and never bleed through.
       */}
      <div
        style={{
          fontSize: "10.5px",
          color: "var(--color-text-muted)",
          textAlign: "center",
          marginTop: "8px",
          letterSpacing: "0.02em",
        }}
      >
        Shift+Enter for new line · Everything stays on your device
      </div>

      </div> {/* end centering column */}
    </div>
  );
}
