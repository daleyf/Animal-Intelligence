import { DownloadProgress as Progress } from "@/types/models";

interface Props {
  progress: Progress;
}

export function DownloadProgress({ progress }: Props) {
  const { completed, total, status } = progress;
  const pct =
    completed !== null && total !== null && total > 0
      ? Math.round((completed / total) * 100)
      : null;

  return (
    <div style={{ marginTop: "8px" }}>
      <div
        style={{
          fontSize: "11px",
          color: "var(--color-text-muted)",
          marginBottom: "4px",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>{status}</span>
        {pct !== null && <span>{pct}%</span>}
      </div>
      {pct !== null && (
        <div
          style={{
            width: "100%",
            height: "4px",
            background: "var(--color-surface-3)",
            borderRadius: "2px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "var(--color-accent)",
              borderRadius: "2px",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      )}
    </div>
  );
}
