import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { fetchSettings, updateSettings } from "@/api/settings";
import { clearAllConversations } from "@/api/conversations";
import { useAppStore } from "@/store/appStore";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function GeneralSettings() {
  const [clearConfirm, setClearConfirm] = useState(false);
  const queryClient = useQueryClient();
  const { setActiveConversation } = useAppStore();

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const personalizationEnabled = settings?.personalization_enabled === "true";

  const togglePersonalization = async () => {
    await updateSettings({
      personalization_enabled: personalizationEnabled ? "false" : "true",
    });
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  };

  const handleClearAll = async () => {
    await clearAllConversations();
    setActiveConversation(null);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    setClearConfirm(false);
  };

  return (
    <div style={{ maxWidth: "560px" }}>
      <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "24px" }}>General</h2>

      {/* Personalization toggle */}
      <section style={{ marginBottom: "32px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>
          Personalization
        </h3>
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "12px" }}>
          When enabled, your name, location, interests, and projects are injected into the system
          prompt to tailor responses.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={togglePersonalization}
            role="switch"
            aria-checked={personalizationEnabled}
            style={{
              width: "44px",
              height: "24px",
              borderRadius: "12px",
              background: personalizationEnabled ? "var(--color-accent)" : "var(--color-surface-3)",
              border: "none",
              cursor: "pointer",
              position: "relative",
              transition: "background 0.2s",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "3px",
                left: personalizationEnabled ? "22px" : "3px",
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: "white",
                transition: "left 0.2s",
              }}
            />
          </button>
          <span style={{ fontSize: "13px", color: "var(--color-text)" }}>
            {personalizationEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>
      </section>

      {/* Danger zone */}
      <section>
        <h3
          style={{
            fontSize: "14px",
            fontWeight: 600,
            marginBottom: "4px",
            color: "var(--color-danger)",
          }}
        >
          Danger Zone
        </h3>
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "12px" }}>
          Permanently delete all conversations and messages from local storage.
        </p>
        <Button variant="danger" size="sm" onClick={() => setClearConfirm(true)}>
          Clear All History
        </Button>
      </section>

      <Modal
        isOpen={clearConfirm}
        title="Clear all history"
        message="All conversations and messages will be permanently deleted. This cannot be undone."
        confirmLabel="Clear All"
        onConfirm={handleClearAll}
        onCancel={() => setClearConfirm(false)}
        dangerous
      />
    </div>
  );
}
