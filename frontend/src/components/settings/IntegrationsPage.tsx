import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearIntegrationSecret,
  fetchIntegrationSecrets,
  saveIntegrationSecret,
} from "@/api/settings";
import {
  disconnectCalendar,
  fetchCalendarAuthUrl,
  fetchReportStatus,
  submitCalendarCode,
} from "@/api/memory";
import { useToast } from "@/components/ui/Toast";

// ── Credential modal ───────────────────────────────────────────────────────

interface ModalField {
  key: string;
  label: string;
  hint?: string;
}

function CredentialModal({
  title,
  fields,
  hasExisting,
  onSave,
  onClear,
  onClose,
}: {
  title: string;
  fields: ModalField[];
  hasExisting: boolean;
  onSave: (values: Record<string, string>) => Promise<void>;
  onClear?: () => Promise<void>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, ""]))
  );
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const allFilled = fields.every((f) => values[f.key]?.trim());

  const handleSave = async () => {
    if (!allFilled) return;
    setSaving(true);
    try {
      await onSave(values);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!onClear) return;
    setClearing(true);
    try {
      await onClear();
      onClose();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "24px",
          width: "380px",
          maxWidth: "90vw",
          animation: "fade-in 0.15s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "20px" }}>{title}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "22px" }}>
          {fields.map((field) => (
            <div key={field.key}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--color-text-muted)",
                  marginBottom: "6px",
                }}
              >
                {field.label}
              </label>
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={values[field.key]}
                placeholder={field.hint ? `Current: ...${field.hint}` : "Enter value"}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter" && allFilled) void handleSave(); }}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--color-text)",
                  fontSize: "13px",
                  padding: "8px 10px",
                  fontFamily: "var(--font-sans)",
                  outline: "none",
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            {onClear && hasExisting && (
              <button
                onClick={() => void handleClear()}
                disabled={clearing}
                style={{
                  padding: "7px 12px",
                  background: "transparent",
                  border: "1px solid var(--color-danger)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--color-danger)",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                }}
              >
                {clearing ? "Removing…" : "Remove"}
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={onClose} style={ghostButtonStyle}>
              Cancel
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={saving || !allFilled}
              style={{
                ...accentButtonStyle,
                opacity: !allFilled ? 0.5 : 1,
                cursor: !allFilled ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving…" : hasExisting ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Integration card ───────────────────────────────────────────────────────

function IntegrationCard({
  icon,
  name,
  provider,
  description,
  configured,
  statusLabel,
  actions,
}: {
  icon: React.ReactNode;
  name: string;
  provider: string;
  description: string;
  configured: boolean;
  statusLabel: string;
  actions: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        padding: "18px 20px",
      }}
    >
      <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
        {/* Icon */}
        <div
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "var(--radius-sm)",
            background: configured
              ? "color-mix(in srgb, var(--color-accent) 12%, transparent)"
              : "var(--color-surface-3)",
            border: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: configured ? "var(--color-accent)" : "var(--color-text-muted)",
          }}
        >
          {icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text)" }}>
              {name}
            </span>
            <span
              style={{
                fontSize: "10px",
                padding: "2px 7px",
                borderRadius: "999px",
                background: configured
                  ? "color-mix(in srgb, var(--color-success) 14%, transparent)"
                  : "var(--color-surface-3)",
                color: configured ? "var(--color-success)" : "var(--color-text-muted)",
                fontWeight: 500,
              }}
            >
              {statusLabel}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "8px" }}>
            {provider}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--color-text-muted)",
              lineHeight: 1.55,
              marginBottom: "14px",
            }}
          >
            {description}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>{actions}</div>
        </div>
      </div>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────

function WeatherIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
      <circle cx="8.5" cy="7" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8.5 1.5V3M8.5 11v1.5M3 7H1.5M15.5 7H14M4.6 3.6 3.5 2.5M13.5 12.5l-1.1-1.1M4.6 10.4 3.5 11.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <rect x="3.5" y="13" width="10" height="2.5" rx="1.25" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
      <circle cx="7.5" cy="7.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11.5 11.5L15 15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M5.5 6.5c.3-.8 1-1.5 2-1.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
      <rect x="2" y="3.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 7h13" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 2v3M11.5 2v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="5" y="9.5" width="2.5" height="2.5" rx="0.5" fill="currentColor" opacity="0.6" />
      <rect x="9.5" y="9.5" width="2.5" height="2.5" rx="0.5" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function IntegrationsPage() {
  const qc = useQueryClient();
  const { show, ToastContainer } = useToast();

  const { data: status, isLoading } = useQuery({
    queryKey: ["report-status"],
    queryFn: fetchReportStatus,
    staleTime: 30_000,
  });

  const { data: secrets } = useQuery({
    queryKey: ["integration-secrets"],
    queryFn: fetchIntegrationSecrets,
    staleTime: 5_000,
  });

  // Which modal is open: "weather" | "web_search" | "calendar" | null
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Auto-capture and submit Google OAuth redirect code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.history.replaceState({}, "", window.location.pathname);
      void (async () => {
        setConnecting(true);
        try {
          const result = await submitCalendarCode(code);
          if (result.success) {
            show("Google Calendar connected!", "success");
            qc.invalidateQueries({ queryKey: ["report-status"] });
          } else {
            show(result.error ?? "Failed to connect", "error");
          }
        } catch {
          show("Failed to submit auth code", "error");
        } finally {
          setConnecting(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["integration-secrets"] }),
      qc.invalidateQueries({ queryKey: ["report-status"] }),
    ]);
  };

  const handleSaveSecrets = async (keys: string[], values: Record<string, string>) => {
    for (const key of keys) {
      await saveIntegrationSecret(key, values[key]);
    }
    await refreshAll();
    show("Credentials saved.", "success");
  };

  const handleClearSecrets = async (keys: string[]) => {
    for (const key of keys) {
      await clearIntegrationSecret(key);
    }
    await refreshAll();
    show("Credentials removed.", "info");
  };

  const handleCalendarConnect = async () => {
    if (!status?.calendar_configured) {
      show("Add your Google credentials first.", "error");
      return;
    }
    try {
      const { auth_url, error } = await fetchCalendarAuthUrl();
      if (error || !auth_url) {
        show(error ?? "Could not get auth URL", "error");
        return;
      }
      window.location.href = auth_url;
    } catch {
      show("Failed to initiate Google auth", "error");
    }
  };

  const handleDisconnect = async () => {
    await disconnectCalendar();
    qc.invalidateQueries({ queryKey: ["report-status"] });
    show("Google Calendar disconnected", "info");
  };

  if (isLoading || !status || !secrets) {
    return <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Loading…</div>;
  }

  const weatherConfigured = secrets.OPENWEATHERMAP_API_KEY?.configured ?? false;
  const webSearchConfigured = secrets.OLLAMA_API_KEY?.configured ?? false;
  const calendarCredsSet = status.calendar_configured;
  const calendarConnected = status.calendar;

  return (
    <>
      <div style={{ maxWidth: "560px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "6px" }}>Integrations</h2>
        <p
          style={{
            fontSize: "13px",
            color: "var(--color-text-muted)",
            marginBottom: "28px",
            lineHeight: 1.55,
          }}
        >
          Credentials are stored only in your local{" "}
          <code style={{ fontSize: "11px" }}>.env</code> file and never leave your device.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* ── Weather ── */}
          <IntegrationCard
            icon={<WeatherIcon />}
            name="Weather"
            provider="OpenWeatherMap"
            description="Adds current conditions and temperature to your daily report. Free tier at openweathermap.org."
            configured={weatherConfigured}
            statusLabel={
              weatherConfigured ? (status.weather ? "Active" : "Configured") : "Not configured"
            }
            actions={
              <button
                onClick={() => setActiveModal("weather")}
                style={weatherConfigured ? ghostButtonStyle : accentButtonStyle}
              >
                {weatherConfigured ? "Edit Key" : "Add Key"}
              </button>
            }
          />

          {/* ── Web Search & News ── */}
          <IntegrationCard
            icon={<SearchIcon />}
            name="Web Search & News"
            provider="Ollama API"
            description="Powers web research and personalised news headlines in your daily report. Free account at ollama.com."
            configured={webSearchConfigured}
            statusLabel={
              webSearchConfigured
                ? status.web_search
                  ? "Active"
                  : "Configured"
                : "Not configured"
            }
            actions={
              <button
                onClick={() => setActiveModal("web_search")}
                style={webSearchConfigured ? ghostButtonStyle : accentButtonStyle}
              >
                {webSearchConfigured ? "Edit Key" : "Add Key"}
              </button>
            }
          />

          {/* ── Google Calendar ── */}
          <IntegrationCard
            icon={<CalendarIcon />}
            name="Google Calendar"
            provider="Google OAuth 2.0"
            description="Shows today's events in your daily report. Requires a Google Cloud OAuth app — see the README for setup instructions."
            configured={calendarConnected}
            statusLabel={
              calendarConnected
                ? "Connected"
                : calendarCredsSet
                ? "Credentials set"
                : "Not configured"
            }
            actions={
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setActiveModal("calendar")}
                  style={ghostButtonStyle}
                >
                  {calendarCredsSet ? "Edit Credentials" : "Add Credentials"}
                </button>
                {calendarConnected ? (
                  <button onClick={() => void handleDisconnect()} style={dangerButtonStyle}>
                    Disconnect
                  </button>
                ) : calendarCredsSet ? (
                  <button
                    onClick={() => void handleCalendarConnect()}
                    disabled={connecting}
                    style={accentButtonStyle}
                  >
                    {connecting ? "Connecting…" : "Connect Calendar"}
                  </button>
                ) : null}
              </div>
            }
          />
        </div>
      </div>

      {/* ── Modals ── */}
      {activeModal === "weather" && (
        <CredentialModal
          title="Weather API Key"
          fields={[
            {
              key: "OPENWEATHERMAP_API_KEY",
              label: "OpenWeatherMap API Key",
              hint: secrets.OPENWEATHERMAP_API_KEY?.last4 ?? undefined,
            },
          ]}
          hasExisting={weatherConfigured}
          onSave={(values) => handleSaveSecrets(["OPENWEATHERMAP_API_KEY"], values)}
          onClear={() => handleClearSecrets(["OPENWEATHERMAP_API_KEY"])}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === "web_search" && (
        <CredentialModal
          title="Web Search API Key"
          fields={[
            {
              key: "OLLAMA_API_KEY",
              label: "Ollama API Key",
              hint: secrets.OLLAMA_API_KEY?.last4 ?? undefined,
            },
          ]}
          hasExisting={webSearchConfigured}
          onSave={(values) => handleSaveSecrets(["OLLAMA_API_KEY"], values)}
          onClear={() => handleClearSecrets(["OLLAMA_API_KEY"])}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === "calendar" && (
        <CredentialModal
          title="Google Calendar Credentials"
          fields={[
            {
              key: "GOOGLE_CLIENT_ID",
              label: "Google Client ID",
              hint: secrets.GOOGLE_CLIENT_ID?.last4 ?? undefined,
            },
            {
              key: "GOOGLE_CLIENT_SECRET",
              label: "Google Client Secret",
              hint: secrets.GOOGLE_CLIENT_SECRET?.last4 ?? undefined,
            },
          ]}
          hasExisting={calendarCredsSet}
          onSave={(values) =>
            handleSaveSecrets(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], values)
          }
          onClear={() => handleClearSecrets(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"])}
          onClose={() => setActiveModal(null)}
        />
      )}

      <ToastContainer />
    </>
  );
}

// ── Shared button styles ───────────────────────────────────────────────────

const accentButtonStyle: React.CSSProperties = {
  padding: "7px 14px",
  background: "var(--color-accent)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  color: "#fff",
  fontSize: "12px",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
};

const ghostButtonStyle: React.CSSProperties = {
  padding: "7px 14px",
  background: "transparent",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text-muted)",
  fontSize: "12px",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "7px 14px",
  background: "transparent",
  border: "1px solid var(--color-danger)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-danger)",
  fontSize: "12px",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
};
