import { useEffect, useRef, useState } from "react";
import { DisplayMessage } from "@/types/chat";
import { MessageBubble } from "./MessageBubble";
import anchorpointLogo from "@/assets/AnchorpointLogo.svg";

interface Props {
  messages: DisplayMessage[];
  isGenerating: boolean;
}

export function MessageList({ messages, isGenerating }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  useEffect(() => {
    if (!userScrolled) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isGenerating, userScrolled]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setUserScrolled(!atBottom);
  };

  useEffect(() => {
    setUserScrolled(false);
  }, [messages.length]);

  if (messages.length === 0) {
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
        <img
          src={anchorpointLogo}
          alt=""
          style={{
            width: "52px",
            height: "52px",
            opacity: 0.45,
            marginBottom: "22px",
            animation: "logo-drift 5s ease-in-out infinite, fade-in 0.8s ease both",
          }}
        />
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
          What's on your mind?
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "var(--color-text-muted)",
            letterSpacing: "0.04em",
            animation: "fade-in 0.9s ease 0.3s both",
          }}
        >
          Everything stays on your device.
        </div>
      </div>
    );
  }

  return (
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
      {/* Centered content column — matches the input bar's max-width */}
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
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
