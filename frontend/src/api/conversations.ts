import { apiFetch } from "./client";
import {
  ConversationListResponse,
  ConversationDetail,
} from "@/types/chat";

export function fetchConversations(search?: string, limit = 20, offset = 0) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return apiFetch<ConversationListResponse>(`/conversations?${params}`);
}

export function fetchConversation(id: string) {
  return apiFetch<ConversationDetail>(`/conversations/${id}`);
}

export function deleteConversation(id: string) {
  return apiFetch<{ ok: boolean }>(`/conversations/${id}`, {
    method: "DELETE",
  });
}

export function clearAllConversations() {
  return apiFetch<{ deleted: number }>(`/conversations`, {
    method: "DELETE",
  });
}

export function renameConversation(id: string, title: string) {
  return apiFetch<{ ok: boolean; title: string }>(`/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}
