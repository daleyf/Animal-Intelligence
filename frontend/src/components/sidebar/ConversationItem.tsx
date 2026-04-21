import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/appStore";
import { deleteConversation, renameConversation } from "@/api/conversations";
import { Modal } from "@/components/ui/Modal";
import { Conversation, ConversationListResponse } from "@/types/chat";
import { truncateText } from "@/utils/truncateText";
import { formatRelativeDate } from "@/utils/formatDate";

interface Props {
  conversation: Conversation;
}

export function ConversationItem({ conversation }: Props) {
  const [hovered, setHovered] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { activeConversationId, setActiveConversation } = useAppStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isActive = activeConversationId === conversation.id;

  // Auto-focus and select-all when the inline editor opens
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSelect = () => {
    if (isEditing) return;
    setActiveConversation(conversation.id);
    if (conversation.conversation_type === "research") {
      navigate(`/research?id=${conversation.id}`);
    } else {
      navigate("/");
    }
  };

  const handleDelete = async () => {
    await deleteConversation(conversation.id);
    if (isActive) {
      setActiveConversation(null);
      navigate("/");
    }
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    setConfirmOpen(false);
  };

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(conversation.title ?? "");
    setIsEditing(true);
  };

  const saveTitle = async () => {
    const trimmed = editTitle.trim();
    setIsEditing(false);
    if (!trimmed || trimmed === conversation.title) return;
    // Optimistically update the cache so the sidebar reflects the change instantly
    queryClient.setQueriesData<ConversationListResponse>(
      { queryKey: ["conversations"] },
      (old) => {
        if (!old) return old;
        return {
          ...old,
          conversations: old.conversations.map((c: Conversation) =>
            c.id === conversation.id ? { ...c, title: trimmed } : c
          ),
        };
      }
    );
    await renameConversation(conversation.id, trimmed);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveTitle();
    }
    if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  // The trash button is always in the DOM; opacity + translate make it invisible
  // when not hovered so CSS transitions can run in both directions.
  const trashVisible = hovered && !isEditing;

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleSelect}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "flex-start",
          padding: "8px 10px",
          borderRadius: "var(--radius-sm)",
          background: isActive
            ? "var(--color-accent-dim)"
            : hovered
            ? "rgba(255, 255, 255, 0.03)"
            : "transparent",
          boxShadow: isActive ? "inset 0 0 0 1px rgba(0, 120, 255, 0.22)" : "none",
          cursor: isEditing ? "default" : "pointer",
          transition: "background 0.1s, box-shadow 0.1s",
          marginBottom: "2px",
        }}
      >
        {/* Text block — right padding opens up smoothly to make room for the button */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            paddingRight: trashVisible ? "26px" : "2px",
            transition: "padding-right 0.18s ease",
          }}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onBlur={saveTitle}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                fontSize: "13px",
                fontWeight: 500,
                fontFamily: "var(--font-sans)",
                color: "var(--color-text)",
                background: "var(--color-bg)",
                border: "1px solid var(--color-accent)",
                borderRadius: "4px",
                padding: "1px 5px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          ) : (
            <div
              onDoubleClick={startEditing}
              title="Double-click to rename"
              style={{
                fontSize: "13px",
                fontWeight: isActive ? 500 : 400,
                color: isActive ? "var(--color-text-strong)" : "var(--color-text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {conversation.title ?? "New conversation"}
            </div>
          )}

          <div
            style={{
              fontSize: "11px",
              color: "var(--color-text-muted)",
              marginTop: "2px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {conversation.preview
              ? truncateText(conversation.preview, 50)
              : formatRelativeDate(conversation.updated_at)}
          </div>
        </div>

        {/* Trash button — always rendered, slides in on hover */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirmOpen(true);
          }}
          title="Delete conversation"
          style={{
            position: "absolute",
            right: "8px",
            top: "50%",
            transform: trashVisible
              ? "translateY(-50%) translateX(0px)"
              : "translateY(-50%) translateX(6px)",
            opacity: trashVisible ? 1 : 0,
            pointerEvents: trashVisible ? "auto" : "none",
            background: "transparent",
            border: "none",
            color: "var(--color-text-muted)",
            cursor: "pointer",
            padding: "3px",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "opacity 0.18s ease, transform 0.18s ease, color 0.12s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--color-danger)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)";
          }}
        >
          <TrashIcon />
        </button>
      </div>

      <Modal
        isOpen={confirmOpen}
        title="Delete conversation"
        message="This conversation will be permanently removed from your history."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
        dangerous
      />
    </>
  );
}

function TrashIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      aria-hidden="true"
    >
      {/* Lid */}
      <path
        d="M2 3.5h9"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Handle on lid */}
      <path
        d="M5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Body */}
      <path
        d="M3.5 3.5l.5 7a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5l.5-7"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner lines */}
      <path
        d="M5.5 5.5v3.5M7.5 5.5v3.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
