import { apiFetch } from "./client";

export interface IntegrationSecretStatus {
  key: string;
  configured: boolean;
  last4: string | null;
}

export function fetchSettings() {
  return apiFetch<Record<string, string>>("/settings");
}

export function updateSettings(updates: Record<string, string>) {
  return apiFetch<Record<string, string>>("/settings", {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export function fetchIntegrationSecrets() {
  return apiFetch<Record<string, IntegrationSecretStatus>>("/settings/integrations/secrets");
}

export function saveIntegrationSecret(key: string, value: string) {
  return apiFetch<IntegrationSecretStatus>(`/settings/integrations/secrets/${key}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
}

export function clearIntegrationSecret(key: string) {
  return apiFetch<IntegrationSecretStatus>(`/settings/integrations/secrets/${key}`, {
    method: "DELETE",
  });
}

export function factoryReset() {
  return apiFetch<{ reset: boolean }>("/reset", { method: "POST" });
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
