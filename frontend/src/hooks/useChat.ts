import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { streamChat } from "@/api/chat";
import { useAppStore } from "@/store/appStore";
import { DisplayMessage, Conversation, ConversationListResponse } from "@/types/chat";

interface UseChatReturn {
  messages: DisplayMessage[];
  streamedContent: string;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  loadConversation: (messages: DisplayMessage[]) => void;
  clearMessages: () => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [streamedContent, setStreamedContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { activeModel, activeConversationId, setActiveConversation, setGenerating } =
    useAppStore();

  // Stable ref to latest conversation ID so the SSE callbacks capture it correctly
  const conversationIdRef = useRef<string | null>(activeConversationId);
  conversationIdRef.current = activeConversationId;

  // Timer ref for the delayed re-fetch that picks up the LLM-generated title
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setError(null);

      const userMsg: DisplayMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
      };
      const assistantPlaceholder: DisplayMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
      setStreamedContent("");

      const controller = new AbortController();
      setGenerating(true, controller);

      let accumulated = "";

      await streamChat(
        {
          message: text,
          conversation_id: conversationIdRef.current,
          model: activeModel,
        },
        {
          onConversationId: (id) => {
            setActiveConversation(id);
            conversationIdRef.current = id;

            // Optimistically insert the new conversation into the sidebar cache so
            // it appears immediately with a meaningful title rather than waiting for
            // the server round-trip.  We use the first 60 chars of the user's message
            // as a stand-in title; the real LLM-generated title arrives via the
            // delayed invalidation in onDone.
            const isNew = !activeConversationId;
            if (isNew) {
              const optimisticTitle = text.slice(0, 60).trim();
              queryClient.setQueriesData<ConversationListResponse>(
                { queryKey: ["conversations"] },
                (old) => {
                  if (!old) return old;
                  // Guard: don't duplicate if already present
                  if (old.conversations.some((c: Conversation) => c.id === id)) return old;
                  const newConvo: Conversation = {
                    id,
                    title: optimisticTitle,
                    model_name: activeModel,
                    updated_at: new Date().toISOString(),
                    preview: text,
                  };
                  return {
                    ...old,
                    conversations: [newConvo, ...old.conversations],
                    total: old.total + 1,
                  };
                }
              );
            }
          },

          onToken: (token) => {
            accumulated += token;
            setStreamedContent(accumulated);
            setMessages((prev) =>
              prev.map((m) =>
                m.isStreaming ? { ...m, content: accumulated } : m
              )
            );
          },

          onDone: (fullContent, convId) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.isStreaming
                  ? { ...m, content: fullContent, isStreaming: false }
                  : m
              )
            );
            setStreamedContent("");
            setGenerating(false);

            const cid = convId || conversationIdRef.current;

            // Invalidate the individual conversation cache. The query may have been
            // fetched during streaming before messages were saved to DB, leaving a
            // stale 0-message snapshot. Marking it stale now ensures the next visit
            // (or immediate background refetch) returns the complete message list.
            if (cid) {
              queryClient.invalidateQueries({ queryKey: ["conversation", cid] });
            }

            // Update the cache entry's preview + timestamp without forcing a
            // network re-fetch — this keeps the optimistic title intact while
            // the backend's background title-generation task is still running.
            queryClient.setQueriesData<ConversationListResponse>(
              { queryKey: ["conversations"] },
              (old) => {
                if (!old || !cid) return old;
                return {
                  ...old,
                  conversations: old.conversations.map((c: Conversation) =>
                    c.id === cid
                      ? {
                          ...c,
                          preview: fullContent.slice(0, 120),
                          updated_at: new Date().toISOString(),
                        }
                      : c
                  ),
                };
              }
            );

            // Schedule a delayed invalidation so TanStack refetches once the
            // LLM title background task on the server has had time to finish.
            if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
            titleTimerRef.current = setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ["conversations"] });
            }, 3500);
          },

          onError: (msg) => {
            setError(msg);
            setMessages((prev) =>
              prev.map((m) =>
                m.isStreaming
                  ? { ...m, content: `Error: ${msg}`, isStreaming: false }
                  : m
              )
            );
            setStreamedContent("");
            setGenerating(false);
            // Still refresh the list so any partial state is corrected
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
          },
        },
        controller.signal
      );
    },
    [activeModel, activeConversationId, setActiveConversation, setGenerating, queryClient]
  );

  const loadConversation = useCallback((msgs: DisplayMessage[]) => {
    setMessages(msgs);
    setStreamedContent("");
    setError(null);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamedContent("");
    setError(null);
  }, []);

  return { messages, streamedContent, error, sendMessage, loadConversation, clearMessages };
}
