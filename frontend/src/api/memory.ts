import { apiFetch, API_BASE } from "./client";
import { MemoryListResponse, MemorySearchResponse, ReportStatus, ResearchSSEEvent, ResearchSource } from "@/types/memory";

export function fetchMemories(limit = 50, offset = 0) {
  return apiFetch<MemoryListResponse>(`/memory?limit=${limit}&offset=${offset}`);
}

export function fetchMemoryCount() {
  return apiFetch<{ count: number; available: boolean }>("/memory/count");
}

export function searchMemories(query: string, nResults = 5) {
  return apiFetch<MemorySearchResponse>("/memory/search", {
    method: "POST",
    body: JSON.stringify({ query, n_results: nResults }),
  });
}

export function deleteMemory(id: string) {
  return apiFetch<{ deleted: string }>(`/memory/${id}`, { method: "DELETE" });
}

export function clearAllMemories() {
  return apiFetch<{ cleared: boolean }>("/memory", { method: "DELETE" });
}

export function fetchReportStatus() {
  return apiFetch<ReportStatus>("/report/status");
}

export function fetchCalendarAuthUrl() {
  return apiFetch<{ auth_url?: string; error?: string }>("/report/calendar/auth");
}

export function submitCalendarCode(code: string) {
  return apiFetch<{ success: boolean; error?: string }>("/report/calendar/callback", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function disconnectCalendar() {
  return apiFetch<{ disconnected: boolean }>("/report/calendar", { method: "DELETE" });
}

/**
 * Stream a research session via SSE.
 */
export async function streamResearch(
  question: string,
  model: string | undefined,
  callbacks: {
    onStatus: (msg: string) => void;
    onToken: (token: string) => void;
    onDone: (fullContent: string, sources: ResearchSource[]) => void;
    onError: (msg: string) => void;
  },
  signal: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ question, model }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    callbacks.onError("Failed to connect to backend.");
    return;
  }

  if (!response.ok) {
    callbacks.onError(`Backend error: ${response.status}`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError("No response body.");
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
        let event: ResearchSSEEvent;
        try {
          event = JSON.parse(line.slice(6));
        } catch {
          continue;
        }
        switch (event.type) {
          case "status":
            callbacks.onStatus(event.message ?? "");
            break;
          case "token":
            callbacks.onToken(event.content ?? "");
            break;
          case "done":
            callbacks.onDone(event.full_content ?? "", event.sources ?? []);
            break;
          case "error":
            callbacks.onError(event.message ?? "Unknown research error.");
            break;
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      callbacks.onError("Research stream interrupted.");
    }
  } finally {
    reader.releaseLock();
  }
}
