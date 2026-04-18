import { apiFetch } from "./client";

export function fetchSettings() {
  return apiFetch<Record<string, string>>("/settings");
}

export function updateSettings(updates: Record<string, string>) {
  return apiFetch<Record<string, string>>("/settings", {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export async function checkHealth(): Promise<{
  status: string;
  ollama_connected: boolean;
  version: string;
}> {
  const response = await fetch("/health");
  if (!response.ok) throw new Error("Health check failed");
  return response.json();
}
