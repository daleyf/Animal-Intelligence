import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ModelInfo, DownloadProgress as Progress } from "@/types/models";
import { setActiveModel, pullModel } from "@/api/models";
import { useAppStore } from "@/store/appStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DownloadProgress } from "./DownloadProgress";

interface Props {
  model: ModelInfo;
  isRecommended?: boolean;
}

export function ModelCard({ model, isRecommended = false }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const { setActiveModel: storeSetActiveModel } = useAppStore();
  const queryClient = useQueryClient();

  const handleSetActive = async () => {
    storeSetActiveModel(model.name);
    await setActiveModel(model.name);
    queryClient.invalidateQueries({ queryKey: ["models"] });
  };

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    setProgress(null);

    await pullModel(
      model.name,
      (p) => setProgress(p),
      () => {
        setDownloading(false);
        setProgress(null);
        queryClient.invalidateQueries({ queryKey: ["models"] });
      },
      (err) => {
        setDownloading(false);
        setDownloadError(err);
      }
    );
  };

  return (
    <div
      style={{
        background: "var(--color-surface-2)",
        border: `1px solid ${model.is_active ? "var(--color-accent)" : "var(--color-border)"}`,
        borderRadius: "var(--radius-md)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              marginBottom: "4px",
            }}
          >
            {model.name}
          </div>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
            {model.description}
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
          {model.is_active && <Badge label="Active" color="accent" />}
          {isRecommended && !model.is_active && <Badge label="Recommended" color="accent" />}
          <Badge label={`${model.size_gb} GB`} color="muted" />
          <Badge label={`${model.min_ram_gb}+ GB RAM`} color="muted" />
        </div>
      </div>

      {downloading && progress && <DownloadProgress progress={progress} />}
      {downloadError && (
        <div style={{ fontSize: "12px", color: "var(--color-danger)" }}>{downloadError}</div>
      )}

      <div style={{ display: "flex", gap: "8px" }}>
        {model.is_installed && !model.is_active && (
          <Button size="sm" variant="ghost" onClick={handleSetActive}>
            Set Active
          </Button>
        )}
        {!model.is_installed && !downloading && (
          <Button size="sm" onClick={handleDownload}>
            Download
          </Button>
        )}
        {downloading && (
          <Button size="sm" variant="ghost" disabled>
            Downloading…
          </Button>
        )}
      </div>
    </div>
  );
}
