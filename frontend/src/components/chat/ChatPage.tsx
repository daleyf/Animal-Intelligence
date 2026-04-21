import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { useConversation } from "@/hooks/useConversations";
import { useChat } from "@/hooks/useChat";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { DisplayMessage } from "@/types/chat";

export function ChatPage() {
  const { activeConversationId, isGenerating } = useAppStore();
  const { data: conversationData, isFetching } = useConversation(activeConversationId);
  const { messages, sendMessage, loadConversation, clearMessages } = useChat();

  // When a conversation is selected from the sidebar, load its messages.
  // Guards:
  //   1. Never overwrite local streaming state while generation is in progress —
  //      messages are only saved to the DB after the stream completes, so an interim
  //      fetch would return 0 messages and wipe the optimistic UI.
  //   2. Skip loading while a background refetch is in flight — the cache may hold a
  //      stale snapshot (0 messages) from a fetch that ran during a previous stream
  //      before messages were persisted. Wait for the settled, fresh response.
  useEffect(() => {
    if (isGenerating) return;
    if (activeConversationId && conversationData && !isFetching) {
      const displayMessages: DisplayMessage[] = conversationData.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
      loadConversation(displayMessages);
    } else if (!activeConversationId) {
      clearMessages();
    }
  }, [activeConversationId, conversationData?.id, isFetching]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "row",
        overflow: "hidden",
        height: "100%",
      }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <MessageList messages={messages} isGenerating={isGenerating} />
        <ChatInput onSend={sendMessage} />
      </div>
    </div>
  );
}
