import { useQuery } from "@tanstack/react-query";
import { useModels } from "@/hooks/useModels";
import { fetchHardwareRecommendation } from "@/api/models";
import { ModelCard } from "./ModelCard";
import { Spinner } from "@/components/ui/Spinner";

export function ModelsPage() {
  const { data, isLoading, error } = useModels();
  const { data: rec } = useQuery({
    queryKey: ["hardware-recommendation"],
    queryFn: fetchHardwareRecommendation,
    staleTime: Infinity, // hardware doesn't change mid-session
  });

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: "var(--color-danger)", padding: "16px" }}>
        Failed to load models. Make sure Ollama is running.
      </div>
    );
  }

  const tierColor: Record<string, string> = {
    light: "var(--color-text-muted)",
    standard: "var(--color-accent)",
    performance: "#22c55e",
  };

  return (
    <div style={{ maxWidth: "680px" }}>
      <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "6px" }}>Models</h2>
      <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "24px" }}>
        Manage your local LLM models. All models run entirely on your device.
      </p>

      {/* Hardware recommendation banner */}
      {rec && (
        <div
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            padding: "12px 16px",
            marginBottom: "28px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: tierColor[rec.tier] ?? "var(--color-accent)",
              flexShrink: 0,
              marginTop: "5px",
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)", marginBottom: "3px" }}>
              Recommended for your hardware:{" "}
              <span style={{ color: tierColor[rec.tier] ?? "var(--color-accent)" }}>
                {rec.recommended_model}
              </span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{rec.reason}</div>
            <div style={{ fontSize: "10px", color: "var(--color-text-muted)", marginTop: "4px", opacity: 0.7 }}>
              {rec.ram_gb} GB RAM · {rec.os}
            </div>
          </div>
        </div>
      )}

      {data?.installed && data.installed.length > 0 && (
        <section style={{ marginBottom: "32px" }}>
          <h3
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              marginBottom: "12px",
            }}
          >
            Installed
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {data.installed.map((m) => (
              <ModelCard
                key={m.name}
                model={m}
                isRecommended={rec?.recommended_model === m.name}
              />
            ))}
          </div>
        </section>
      )}

      {data?.available && data.available.length > 0 && (
        <section>
          <h3
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              marginBottom: "12px",
            }}
          >
            Available to Download
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {data.available.map((m) => (
              <ModelCard
                key={m.name}
                model={m}
                isRecommended={rec?.recommended_model === m.name}
              />
            ))}
          </div>
        </section>
      )}

      {!data?.installed.length && !data?.available.length && (
        <div style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>
          No models found. Make sure Ollama is running and pull a model:{" "}
          <code>ollama pull llama3.1:8b</code>
        </div>
      )}
    </div>
  );
}
