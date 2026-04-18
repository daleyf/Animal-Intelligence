import { apiFetch, API_BASE } from "./client";
import { ModelsResponse, DownloadProgress } from "@/types/models";

export interface HardwareRecommendation {
  recommended_model: string;
  tier: "light" | "standard" | "performance";
  reason: string;
  ram_gb: number;
  os: string;
  size_gb: number | null;
  min_ram_gb: number | null;
}

export function fetchModels() {
  return apiFetch<ModelsResponse>("/models");
}

export function fetchHardwareRecommendation() {
  return apiFetch<HardwareRecommendation>("/models/recommendation");
}

export function setActiveModel(model: string) {
  return apiFetch<{ active_model: string }>("/models/active", {
    method: "PUT",
    body: JSON.stringify({ model }),
  });
}

/**
 * Pull (download) a model and stream progress events.
 */
export async function pullModel(
  modelName: string,
  onProgress: (progress: DownloadProgress) => void,
  onDone: () => void,
  onError: (message: string) => void,
  signal?: AbortSignal
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/models/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName }),
      signal,
    });
  } catch {
    onError("Failed to start download.");
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onError("No response stream.");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6);
        try {
          const chunk = JSON.parse(json) as DownloadProgress & {
            message?: string;
          };
          if (chunk.status === "done") {
            onDone();
          } else if (chunk.status === "error" && chunk.message) {
            onError(chunk.message);
          } else {
            onProgress(chunk);
          }
        } catch {
          continue;
        }
      }
    }
  } catch {
    onError("Download interrupted.");
  } finally {
    reader.releaseLock();
  }
}
