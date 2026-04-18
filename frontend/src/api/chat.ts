import { API_BASE } from "./client";

export interface ChatRequest {
  message: string;
  conversation_id?: string | null;
  model?: string;
}

export interface ChatSSEEvent {
  type: "conversation_id" | "token" | "done" | "error";
  content?: string;
  conversation_id?: string;
  full_content?: string;
  token_count?: number;
  message?: string;
}

/**
 * Stream a chat message using fetch + ReadableStream.
 *
 * We use fetch (not EventSource) because EventSource only supports GET requests.
 * SSE lines come through as `data: <json>\n\n`.
 */
export async function streamChat(
  request: ChatRequest,
  callbacks: {
    onConversationId: (id: string) => void;
    onToken: (token: string) => void;
    onDone: (fullContent: string, conversationId: string) => void;
    onError: (message: string) => void;
  },
  signal: AbortSignal
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ ...request, stream: true }),
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
        const jsonStr = line.slice(6);

        let event: ChatSSEEvent;
        try {
          event = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        switch (event.type) {
          case "conversation_id":
            if (event.conversation_id) {
              callbacks.onConversationId(event.conversation_id);
            }
            break;
          case "token":
            if (event.content) {
              callbacks.onToken(event.content);
            }
            break;
          case "done":
            callbacks.onDone(
              event.full_content ?? "",
              event.conversation_id ?? ""
            );
            break;
          case "error":
            callbacks.onError(event.message ?? "Unknown error from LLM.");
            break;
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      callbacks.onError("Stream interrupted.");
    }
  } finally {
    reader.releaseLock();
  }
}
