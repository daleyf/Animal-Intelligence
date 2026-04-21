import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { useModels } from "@/hooks/useModels";
import { useConversation } from "@/hooks/useConversations";
import { setActiveModel } from "@/api/models";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";

export function TopBar() {
  const { activeModel, setActiveModel: storeSetActiveModel, ollamaConnected, activeConversationId } = useAppStore();
  const { data: modelsData } = useModels();
  const { data: activeConversation } = useConversation(activeConversationId);

  // Sync active model to an installed model if the stored value isn't available
  useEffect(() => {
    if (!modelsData?.installed.length) return;
    const installedNames = modelsData.installed.map((m) => m.name);
    if (!installedNames.includes(activeModel)) {
      const corrected = modelsData.active_model || installedNames[0];
      storeSetActiveModel(corrected);
    }
  }, [modelsData, activeModel, storeSetActiveModel]);

  const queryClient = useQueryClient();
  const { show, ToastContainer } = useToast();

  const handleModelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const model = e.target.value;
    storeSetActiveModel(model);
    await setActiveModel(model);
    queryClient.invalidateQueries({ queryKey: ["models"] });
    show(`Switched to ${model}`, "info");
  };

  const conversationTitle = activeConversation?.title ?? null;

  return (
    <>
      <div
        style={{
          height: "var(--topbar-height)",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: "12px",
          flexShrink: 0,
          minWidth: 0,
        }}
      >
        {/* Conversation title — left side, takes all remaining space */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {conversationTitle && (
            <span
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--color-text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "block",
                letterSpacing: "-0.01em",
              }}
            >
              {conversationTitle}
            </span>
          )}
        </div>

        {/* Model selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "7px", flexShrink: 0 }}>
          <span style={{ fontSize: "11.5px", color: "var(--color-text-muted)", letterSpacing: "0.01em" }}>
            Model
          </span>
          <select
            id="model-select"
            value={activeModel}
            onChange={handleModelChange}
            style={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--color-text)",
              padding: "4px 8px",
              fontSize: "12px",
              fontFamily: "var(--font-sans)",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {modelsData?.installed.length ? (
              modelsData.installed.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))
            ) : (
              <option value={activeModel}>{activeModel}</option>
            )}
          </select>
        </div>

        {/* Ollama status — far right, inline with model selector */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "11.5px",
            color: "var(--color-text-muted)",
            letterSpacing: "0.01em",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: ollamaConnected ? "var(--color-success)" : "var(--color-danger)",
              boxShadow: ollamaConnected
                ? "0 0 6px rgba(119, 221, 119, 0.5)"
                : "0 0 6px rgba(228, 89, 76, 0.4)",
            }}
          />
          {ollamaConnected ? "Connected" : "Ollama offline"}
        </div>
      </div>
      <ToastContainer />
    </>
  );
}
