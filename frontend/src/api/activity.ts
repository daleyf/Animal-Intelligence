import { apiFetch } from "./client";

export interface ToolLogEntry {
  id: string;
  tool_name: string;
  input_summary: string | null;
  success: boolean;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string | null;
  session_id: string | null;
  /** JSON-encoded string[] of individual search queries executed within this call */
  sub_queries: string | null;
  /** Human-readable label of where data was sent, e.g. "ollama.com/api/web_search" */
  data_destination: string | null;
}

export interface ActivityResponse {
  logs: ToolLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export function getActivityLog(params?: {
  limit?: number;
  offset?: number;
  tool_name?: string;
}): Promise<ActivityResponse> {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  if (params?.tool_name) qs.set("tool_name", params.tool_name);
  const query = qs.toString();
  return apiFetch<ActivityResponse>(`/activity${query ? `?${query}` : ""}`);
}

export function clearActivityLog(): Promise<{ deleted: number }> {
  return apiFetch<{ deleted: number }>("/activity", { method: "DELETE" });
}
