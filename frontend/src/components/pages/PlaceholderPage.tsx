interface Props {
  icon: string;
  title: string;
  description: string;
}

export function PlaceholderPage({ icon, title, description }: Props) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "12px",
        color: "var(--color-text-muted)",
        height: "100%",
      }}
    >
      <div style={{ fontSize: "48px" }}>{icon}</div>
      <div style={{ fontSize: "18px", fontWeight: 600, color: "var(--color-text)" }}>
        {title}
      </div>
      <div style={{ fontSize: "13px", maxWidth: "360px", textAlign: "center" }}>
        {description}
      </div>
    </div>
  );
}
