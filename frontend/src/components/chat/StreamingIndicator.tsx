interface Props {
  /** When true, renders as an inline cursor appended to text */
  inline?: boolean;
}

/** Blinking cursor indicator shown while the LLM is generating */
export function StreamingIndicator({ inline = false }: Props) {
  if (inline) {
    return <span className="streaming-cursor" />;
  }

  // Standalone: shown before any tokens arrive
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "2px",
        padding: "4px 0",
      }}
    >
      <span className="streaming-cursor" style={{ height: "0.95em" }} />
    </span>
  );
}
