interface BadgeProps {
  label: string;
  color?: "accent" | "success" | "warning" | "muted";
}

const colors = {
  accent: { bg: "var(--color-accent-dim)", text: "var(--color-accent)" },
  success: { bg: "rgba(76,175,125,0.15)", text: "var(--color-success)" },
  warning: { bg: "rgba(224,149,85,0.15)", text: "var(--color-warning)" },
  muted: { bg: "var(--color-surface-3)", text: "var(--color-text-muted)" },
};

export function Badge({ label, color = "muted" }: BadgeProps) {
  const { bg, text } = colors[color];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: 600,
        background: bg,
        color: text,
        letterSpacing: "0.3px",
      }}
    >
      {label}
    </span>
  );
}
