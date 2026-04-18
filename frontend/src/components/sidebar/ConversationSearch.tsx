import { useEffect, useState } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function ConversationSearch({ value, onChange }: Props) {
  const [local, setLocal] = useState(value);

  // Debounce: only propagate after 300ms of no typing
  useEffect(() => {
    const t = setTimeout(() => onChange(local), 300);
    return () => clearTimeout(t);
  }, [local, onChange]);

  return (
    <input
      type="search"
      placeholder="Search conversations…"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      style={{
        width: "100%",
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-sm)",
        color: "var(--color-text)",
        padding: "6px 10px",
        fontSize: "12px",
        fontFamily: "inherit",
        outline: "none",
        marginBottom: "6px",
      }}
    />
  );
}
