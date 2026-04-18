import { useConversations } from "@/hooks/useConversations";
import { ConversationItem } from "./ConversationItem";
import { Spinner } from "@/components/ui/Spinner";

interface Props {
  search: string;
}

export function ConversationList({ search }: Props) {
  const { data, isLoading, error } = useConversations(search || undefined);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
        <Spinner size={18} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontSize: "12px", color: "var(--color-danger)", padding: "8px" }}>
        Failed to load conversations
      </div>
    );
  }

  const conversations = data?.conversations ?? [];

  if (conversations.length === 0) {
    return (
      <div
        style={{
          fontSize: "12px",
          color: "var(--color-text-muted)",
          padding: "12px 8px",
          textAlign: "center",
        }}
      >
        {search ? "No matching conversations" : "No conversations yet"}
      </div>
    );
  }

  return (
    <div>
      {conversations.map((convo) => (
        <ConversationItem key={convo.id} conversation={convo} />
      ))}
    </div>
  );
}
