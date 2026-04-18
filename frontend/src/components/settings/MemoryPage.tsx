import { useState } from "react";
import { useMemories, useDeleteMemory, useClearMemories } from "@/hooks/useMemory";
import { useToast } from "@/components/ui/Toast";

export function MemoryPage() {
  const { data, isLoading } = useMemories();
  const deleteMemory = useDeleteMemory();
  const clearMemories = useClearMemories();
  const { show, ToastContainer } = useToast();
  const [confirmClear, setConfirmClear] = useState(false);

  const handleDelete = async (id: string) => {
    await deleteMemory.mutateAsync(id);
    show("Memory deleted", "info");
  };

  const handleClear = async () => {
    await clearMemories.mutateAsync();
    setConfirmClear(false);
    show("All memories cleared", "info");
  };

  if (!data?.available) {
    return (
      <div style={{ padding: "32px 0", color: "var(--color-text-muted)", fontSize: "13px" }}>
        Memory store is unavailable. Make sure <code>chromadb</code> and{" "}
        <code>sentence-transformers</code> are installed.
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text)", marginBottom: "4px" }}>
              Semantic Memory
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
              {isLoading ? "…" : `${data?.total ?? 0} memories stored`} · Automatically populated from conversations
            </div>
          </div>
          {(data?.total ?? 0) > 0 && (
            <button
              onClick={() => setConfirmClear(true)}
              style={{
                padding: "6px 12px",
                background: "transparent",
                border: "1px solid var(--color-danger)",
                borderRadius: "var(--radius-sm)",
                color: "var(--color-danger)",
                fontSize: "12px",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
              }}
            >
              Clear all
            </button>
          )}
        </div>

        {/* Confirm clear dialog */}
        {confirmClear && (
          <div
            style={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              padding: "14px 16px",
              fontSize: "12px",
              color: "var(--color-text)",
            }}
          >
            <div style={{ marginBottom: "10px" }}>
              This will permanently delete all {data?.total} memories. This cannot be undone.
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleClear}
                disabled={clearMemories.isPending}
                style={{
                  padding: "5px 12px",
                  background: "var(--color-danger)",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  color: "#fff",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                }}
              >
                {clearMemories.isPending ? "Clearing…" : "Yes, clear all"}
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                style={{
                  padding: "5px 12px",
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--color-text-muted)",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Memory list */}
        {isLoading ? (
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Loading…</div>
        ) : data?.memories.length === 0 ? (
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
            No memories yet. Memories are created automatically as you chat.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {data?.memories.map((m) => (
              <MemoryCard key={m.id} memory={m} onDelete={() => handleDelete(m.id)} />
            ))}
          </div>
        )}
      </div>
      <ToastContainer />
    </>
  );
}

function MemoryCard({
  memory,
  onDelete,
}: {
  memory: { id: string; metadata: { user_message: string; assistant_response: string; timestamp: string } };
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const date = memory.metadata.timestamp?.slice(0, 10) ?? "";

  return (
    <div
      style={{
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-sm)",
        padding: "12px 14px",
        fontSize: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: "var(--color-text)",
              marginBottom: "4px",
              whiteSpace: expanded ? "normal" : "nowrap",
              overflow: expanded ? "visible" : "hidden",
              textOverflow: expanded ? "clip" : "ellipsis",
            }}
          >
            <span style={{ color: "var(--color-text-muted)" }}>Q: </span>
            {memory.metadata.user_message}
          </div>
          {expanded && (
            <div style={{ color: "var(--color-text-muted)", marginTop: "6px" }}>
              <span style={{ color: "var(--color-text-muted)" }}>A: </span>
              {memory.metadata.assistant_response}
            </div>
          )}
          <div style={{ color: "var(--color-text-muted)", marginTop: "6px", fontSize: "11px" }}>
            {date}
            {" · "}
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-accent)",
                cursor: "pointer",
                padding: 0,
                fontSize: "11px",
                fontFamily: "var(--font-sans)",
              }}
            >
              {expanded ? "Collapse" : "Expand"}
            </button>
          </div>
        </div>
        <button
          onClick={onDelete}
          title="Delete memory"
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text-muted)",
            cursor: "pointer",
            padding: "2px 4px",
            fontSize: "14px",
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
