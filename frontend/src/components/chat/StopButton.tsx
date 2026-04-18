import { useAppStore } from "@/store/appStore";

export function StopButton() {
  const { stopGeneration } = useAppStore();

  return (
    <button
      onClick={stopGeneration}
      title="Stop generation"
      style={{
        padding: "6px 14px",
        background: "transparent",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-pill)",
        color: "var(--color-text-muted)",
        fontSize: "12px",
        fontFamily: "var(--font-sans)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        letterSpacing: "0.02em",
        transition: "border-color 0.12s, color 0.12s",
      }}
    >
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
        <rect x="1" y="1" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.7"/>
      </svg>
      Stop generating
    </button>
  );
}
