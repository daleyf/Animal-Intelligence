import { useQuery } from "@tanstack/react-query";
import { useModels } from "@/hooks/useModels";
import { fetchHardwareRecommendation } from "@/api/models";
import { ModelCard } from "@/components/settings/ModelCard";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

interface Props {
  onFinish: () => void;
  onBack: () => void;
  isSaving: boolean;
}

const tierColor: Record<string, string> = {
  light: "var(--color-text-muted)",
  standard: "var(--color-accent)",
  performance: "#22c55e",
};

export function StepModel({ onFinish, onBack, isSaving }: Props) {
  const { data, isLoading } = useModels();
  const { data: rec } = useQuery({
    queryKey: ["hardware-recommendation"],
    queryFn: fetchHardwareRecommendation,
    staleTime: Infinity,
  });

  const hasInstalled = (data?.installed?.length ?? 0) > 0;

  return (
    <div>
      <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
        Choose a Model
      </h2>
      <p style={{ fontSize: "14px", color: "var(--color-text-muted)", marginBottom: "20px" }}>
        Models run entirely on your device — nothing leaves your machine. Download
        one now or skip and do it later in Settings.
      </p>

      {/* Hardware recommendation banner */}
      {rec && (
        <div
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 14px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: tierColor[rec.tier] ?? "var(--color-accent)",
              flexShrink: 0,
              marginTop: "4px",
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "2px" }}>
              Recommended for your hardware:{" "}
              <span style={{ color: tierColor[rec.tier] ?? "var(--color-accent)" }}>
                {rec.recommended_model}
              </span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{rec.reason}</div>
            <div style={{ fontSize: "10px", color: "var(--color-text-muted)", marginTop: "3px", opacity: 0.7 }}>
              {rec.ram_gb} GB RAM · {rec.os}
            </div>
          </div>
        </div>
      )}

      {/* Model list */}
      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
          <Spinner />
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            maxHeight: "320px",
            overflowY: "auto",
            marginBottom: "20px",
            paddingRight: "2px",
          }}
        >
          {data?.installed && data.installed.length > 0 && (
            <>
              <div style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                marginBottom: "2px",
              }}>
                Installed
              </div>
              {data.installed.map((m) => (
                <ModelCard key={m.name} model={m} isRecommended={rec?.recommended_model === m.name} />
              ))}
            </>
          )}

          {data?.available && data.available.length > 0 && (
            <>
              <div style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                marginTop: data?.installed?.length ? "8px" : "0",
                marginBottom: "2px",
              }}>
                Available to Download
              </div>
              {data.available.map((m) => (
                <ModelCard key={m.name} model={m} isRecommended={rec?.recommended_model === m.name} />
              ))}
            </>
          )}

          {!isLoading && !data?.installed?.length && !data?.available?.length && (
            <div style={{ fontSize: "13px", color: "var(--color-text-muted)", padding: "12px 0" }}>
              Could not reach Ollama. Make sure it is running, then restart the app.
              You can also choose a model later in{" "}
              <strong>Settings → Models</strong>.
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={onFinish} disabled={isSaving}>
          {isSaving ? "Saving…" : hasInstalled ? "Get Started →" : "Skip for now"}
        </Button>
      </div>
    </div>
  );
}
