import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/appStore";

export function NewChatButton() {
  const navigate = useNavigate();
  const { setActiveConversation } = useAppStore();

  const handleNewChat = () => {
    setActiveConversation(null);
    navigate("/");
  };

  return (
    <button
      onClick={handleNewChat}
      style={{
        width: "100%",
        padding: "7px 10px",
        background: "var(--color-accent-dim)",
        border: "1px solid rgba(0, 120, 255, 0.22)",
        borderRadius: "var(--radius-sm)",
        color: "var(--color-accent)",
        fontSize: "12px",
        fontWeight: 500,
        fontFamily: "var(--font-sans)",
        cursor: "pointer",
        textAlign: "left",
        marginBottom: "7px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        letterSpacing: "0.01em",
        transition: "background 0.12s, border-color 0.12s",
      }}
    >
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0 }}>
        <line x1="5.5" y1="1" x2="5.5" y2="10" stroke="#0078FF" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="1" y1="5.5" x2="10" y2="5.5" stroke="#0078FF" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      New conversation
    </button>
  );
}
