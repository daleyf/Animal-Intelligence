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
  timezone: string;
}

const TIMEZONES: { label: string; zones: { value: string; label: string }[] }[] = [
  {
    label: "UTC",
    zones: [{ value: "UTC", label: "UTC" }],
  },
  {
    label: "United States & Canada",
    zones: [
      { value: "America/New_York", label: "Eastern Time (ET)" },
      { value: "America/Chicago", label: "Central Time (CT)" },
      { value: "America/Denver", label: "Mountain Time (MT)" },
      { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
      { value: "America/Anchorage", label: "Alaska Time (AKT)" },
      { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
      { value: "America/Toronto", label: "Toronto" },
      { value: "America/Vancouver", label: "Vancouver" },
      { value: "America/Halifax", label: "Halifax (AT)" },
    ],
  },
  {
    label: "Latin America",
    zones: [
      { value: "America/Mexico_City", label: "Mexico City" },
      { value: "America/Bogota", label: "Bogotá" },
      { value: "America/Lima", label: "Lima" },
      { value: "America/Santiago", label: "Santiago" },
      { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
      { value: "America/Sao_Paulo", label: "São Paulo" },
    ],
  },
  {
    label: "UK & Ireland",
    zones: [
      { value: "Europe/London", label: "London (GMT/BST)" },
      { value: "Europe/Dublin", label: "Dublin" },
    ],
  },
  {
    label: "Europe",
    zones: [
      { value: "Europe/Paris", label: "Paris (CET)" },
      { value: "Europe/Berlin", label: "Berlin" },
      { value: "Europe/Madrid", label: "Madrid" },
      { value: "Europe/Rome", label: "Rome" },
      { value: "Europe/Amsterdam", label: "Amsterdam" },
      { value: "Europe/Brussels", label: "Brussels" },
      { value: "Europe/Zurich", label: "Zurich" },
      { value: "Europe/Vienna", label: "Vienna" },
      { value: "Europe/Stockholm", label: "Stockholm" },
      { value: "Europe/Oslo", label: "Oslo" },
      { value: "Europe/Copenhagen", label: "Copenhagen" },
      { value: "Europe/Warsaw", label: "Warsaw" },
      { value: "Europe/Prague", label: "Prague" },
      { value: "Europe/Budapest", label: "Budapest" },
      { value: "Europe/Helsinki", label: "Helsinki" },
      { value: "Europe/Athens", label: "Athens" },
      { value: "Europe/Bucharest", label: "Bucharest" },
      { value: "Europe/Moscow", label: "Moscow (MSK)" },
    ],
  },
  {
    label: "Middle East & Africa",
    zones: [
      { value: "Asia/Dubai", label: "Dubai (GST)" },
      { value: "Asia/Riyadh", label: "Riyadh (AST)" },
      { value: "Asia/Tehran", label: "Tehran (IRST)" },
      { value: "Asia/Jerusalem", label: "Jerusalem" },
      { value: "Africa/Cairo", label: "Cairo (EET)" },
      { value: "Africa/Johannesburg", label: "Johannesburg (SAST)" },
      { value: "Africa/Lagos", label: "Lagos (WAT)" },
      { value: "Africa/Nairobi", label: "Nairobi (EAT)" },
    ],
  },
  {
    label: "South & Central Asia",
    zones: [
      { value: "Asia/Karachi", label: "Karachi (PKT)" },
      { value: "Asia/Kolkata", label: "India (IST)" },
      { value: "Asia/Dhaka", label: "Dhaka (BST)" },
    ],
  },
  {
    label: "East & Southeast Asia",
    zones: [
      { value: "Asia/Bangkok", label: "Bangkok (ICT)" },
      { value: "Asia/Jakarta", label: "Jakarta (WIB)" },
      { value: "Asia/Singapore", label: "Singapore (SGT)" },
      { value: "Asia/Kuala_Lumpur", label: "Kuala Lumpur" },
      { value: "Asia/Manila", label: "Manila (PST)" },
      { value: "Asia/Shanghai", label: "China (CST)" },
      { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
      { value: "Asia/Taipei", label: "Taipei" },
      { value: "Asia/Tokyo", label: "Tokyo (JST)" },
      { value: "Asia/Seoul", label: "Seoul (KST)" },
    ],
  },
  {
    label: "Australia & Pacific",
    zones: [
      { value: "Australia/Perth", label: "Perth (AWST)" },
      { value: "Australia/Adelaide", label: "Adelaide (ACST)" },
      { value: "Australia/Brisbane", label: "Brisbane (AEST)" },
      { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
      { value: "Australia/Melbourne", label: "Melbourne" },
      { value: "Pacific/Auckland", label: "Auckland (NZST)" },
      { value: "Pacific/Fiji", label: "Fiji (FJT)" },
      { value: "Pacific/Honolulu", label: "Honolulu (HST)" },
    ],
  },
];

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

  const tz = schedule?.timezone ?? "UTC";
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
                timezone: tz === "UTC" ? browserTz : tz,
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
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "6px" }}>
                Time
              </div>
              <input
                type="time"
                value={schedule.time}
                onChange={(e) =>
                  scheduleMutation.mutate({ enabled: true, time: e.target.value, timezone: tz })
                }
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
            <div>
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "6px" }}>
                Timezone
              </div>
              <select
                value={tz}
                onChange={(e) =>
                  scheduleMutation.mutate({ enabled: true, time: schedule.time, timezone: e.target.value })
                }
                style={{
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--color-text)",
                  fontSize: "13px",
                  padding: "6px 8px",
                  fontFamily: "var(--font-sans)",
                  outline: "none",
                  minWidth: "240px",
                }}
              >
                {TIMEZONES.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.zones.map((z) => (
                      <option key={z.value} value={z.value}>
                        {z.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
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
