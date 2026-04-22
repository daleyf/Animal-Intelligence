import { ResearchSource } from "@/types/memory";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  extra_data?: { sources?: ResearchSource[]; reasoning?: string[] } | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  model_name: string;
  conversation_type?: string | null;
  updated_at: string;
  preview: string;
}

export interface ConversationDetail {
  id: string;
  title: string | null;
  model_name: string;
  conversation_type?: string | null;
  created_at: string;
  messages: Message[];
}

export interface ConversationListResponse {
  conversations: Conversation[];
  total: number;
}

/** A message being displayed in the chat UI (may not yet be persisted). */
export interface DisplayMessage {
  /** Temporary client-side ID before the server assigns one. */
  id: string;
  role: "user" | "assistant";
  content: string;
  /** True when this is the assistant bubble currently being streamed. */
  isStreaming?: boolean;
}
