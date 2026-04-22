import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSettings, updateSettings, factoryReset } from "@/api/settings";
import { apiFetch } from "@/api/client";
import { useAppStore } from "@/store/appStore";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface ScheduleSettings {
  enabled: boolean;
  time: string;
}

export function GeneralSettings() {
  const [clearConfirm, setClearConfirm] = useState(false);
  const queryClient = useQueryClient();
  const { setActiveConversation } = useAppStore();

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const { data: schedule } = useQuery({
    queryKey: ["report-schedule"],
    queryFn: () => apiFetch<ScheduleSettings>("/report/schedule"),
    staleTime: 60_000,
  });

  const scheduleMutation = useMutation({
    mutationFn: (body: ScheduleSettings) =>
      apiFetch<ScheduleSettings>("/report/schedule", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => queryClient.setQueryData(["report-schedule"], data),
  });

  const personalizationEnabled = settings?.personalization_enabled === "true";

  const togglePersonalization = async () => {
    await updateSettings({
      personalization_enabled: personalizationEnabled ? "false" : "true",
    });
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  };

  const handleClearAll = async () => {
    await factoryReset();
    setActiveConversation(null);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    queryClient.invalidateQueries({ queryKey: ["activity"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ["report-latest"] });
    queryClient.invalidateQueries({ queryKey: ["memories"] });
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

      {/* Daily Report auto-schedule */}
      <section style={{ marginBottom: "32px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>
          Daily Report Auto-Schedule
        </h3>
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "12px" }}>
          Automatically generate a daily report each morning. Generated reports are saved to your
          conversation history.
        </p>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            cursor: "pointer",
            marginBottom: schedule?.enabled ? "12px" : "0",
          }}
        >
          <button
            onClick={() =>
              scheduleMutation.mutate({
                enabled: !(schedule?.enabled ?? false),
                time: schedule?.time ?? "07:00",
              })
            }
            role="switch"
            aria-checked={schedule?.enabled ?? false}
            style={{
              width: "44px",
              height: "24px",
              borderRadius: "12px",
              background: schedule?.enabled ? "var(--color-accent)" : "var(--color-surface-3)",
              border: "none",
              cursor: "pointer",
              position: "relative",
              transition: "background 0.2s",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "3px",
                left: schedule?.enabled ? "22px" : "3px",
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: "white",
                transition: "left 0.2s",
              }}
            />
          </button>
          <span style={{ fontSize: "13px", color: "var(--color-text)" }}>
            {schedule?.enabled ? "Enabled" : "Disabled"}
          </span>
        </label>
        {schedule?.enabled && (
          <div>
            <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "6px" }}>
              Time (UTC)
            </div>
            <input
              type="time"
              value={schedule.time}
              onChange={(e) => scheduleMutation.mutate({ enabled: true, time: e.target.value })}
              style={{
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--color-text)",
                fontSize: "13px",
                padding: "6px 8px",
                fontFamily: "var(--font-sans)",
                outline: "none",
              }}
            />
          </div>
        )}
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
          Permanently delete all conversations, messages, activity logs, and saved memories, and reset your profile. You will be taken back to the onboarding screen.
        </p>
        <Button variant="danger" size="sm" onClick={() => setClearConfirm(true)}>
          Clear All History
        </Button>
      </section>

      <Modal
        isOpen={clearConfirm}
        title="Clear all history"
        message="All conversations, messages, activity logs, and saved memories will be permanently deleted and your profile will be reset. This cannot be undone."
        confirmLabel="Clear All"
        onConfirm={handleClearAll}
        onCancel={() => setClearConfirm(false)}
        dangerous
      />
    </div>
  );
}
