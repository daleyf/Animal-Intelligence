import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearIntegrationSecret,
  fetchIntegrationSecrets,
  IntegrationSecretStatus,
  saveIntegrationSecret,
} from "@/api/settings";
import {
  disconnectCalendar,
  fetchCalendarAuthUrl,
  fetchReportStatus,
  submitCalendarCode,
} from "@/api/memory";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

const SECRET_FIELDS = [
  {
    key: "OPENWEATHERMAP_API_KEY",
    title: "Weather",
    label: "OpenWeatherMap API key",
    description: "Used to power local weather in the daily report.",
  },
  {
    key: "OLLAMA_API_KEY",
    title: "Web Search",
    label: "Ollama API key",
    description: "Enables research and search-backed report queries.",
  },
  {
    key: "GOOGLE_CLIENT_ID",
    title: "Google Calendar",
    label: "Google client ID",
    description: "Required for Google Calendar OAuth setup.",
  },
  {
    key: "GOOGLE_CLIENT_SECRET",
    title: "Google Calendar",
    label: "Google client secret",
    description: "Stored locally and used only for Calendar OAuth.",
  },
] as const;

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

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [clearingKey, setClearingKey] = useState<string | null>(null);
  const [oauthCode, setOauthCode] = useState("");
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      setOauthCode(code);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const refreshIntegrationQueries = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["integration-secrets"] }),
      qc.invalidateQueries({ queryKey: ["report-status"] }),
    ]);
  };

  const handleSecretSave = async (key: string) => {
    const value = (drafts[key] ?? "").trim();
    if (!value) {
      show("Enter a value before saving.", "error");
      return;
    }

    setSavingKey(key);
    try {
      await saveIntegrationSecret(key, value);
      setDrafts((current) => ({ ...current, [key]: "" }));
      await refreshIntegrationQueries();
      show("Integration credential saved locally.", "success");
    } catch {
      show("Failed to save integration credential.", "error");
    } finally {
      setSavingKey(null);
    }
  };

  const handleSecretClear = async (key: string) => {
    setClearingKey(key);
    try {
      await clearIntegrationSecret(key);
      setDrafts((current) => ({ ...current, [key]: "" }));
      await refreshIntegrationQueries();
      show("Integration credential removed from local .env.", "info");
    } catch {
      show("Failed to clear integration credential.", "error");
    } finally {
      setClearingKey(null);
    }
  };

  const handleCalendarConnect = async () => {
    if (!status?.calendar_configured) {
      show("Google OAuth not configured yet. Add the Calendar credentials below first.", "error");
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

  const handleSubmitCode = async () => {
    if (!oauthCode.trim()) return;

    setConnecting(true);
    try {
      const result = await submitCalendarCode(oauthCode.trim());
      if (result.success) {
        show("Google Calendar connected!", "success");
        qc.invalidateQueries({ queryKey: ["report-status"] });
        setOauthCode("");
      } else {
        show(result.error ?? "Failed to connect", "error");
      }
    } catch {
      show("Failed to submit auth code", "error");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectCalendar();
    qc.invalidateQueries({ queryKey: ["report-status"] });
    show("Google Calendar disconnected", "info");
  };

  if (isLoading || !status || !secrets) {
    return <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Loading...</div>;
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ fontSize: "13px", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
          Integration credentials are stored only in your local <code style={{ fontSize: "11px" }}>.env</code>{" "}
          file. The browser only receives whether a value exists and, when available, the last four characters.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <IntegrationSummaryCard
            name="Weather"
            description="OpenWeatherMap"
            active={status.weather}
            detail={formatSecretStatus(secrets.OPENWEATHERMAP_API_KEY)}
          />
          <IntegrationSummaryCard
            name="Web Search"
            description="Ollama Web Search"
            active={status.web_search}
            detail={formatSecretStatus(secrets.OLLAMA_API_KEY)}
          />
        </div>

        <div
          style={{
            display: "grid",
            gap: "12px",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          {SECRET_FIELDS.map((field) => {
            const secret = secrets[field.key];
            const draft = drafts[field.key] ?? "";
            return (
              <SecretEditorCard
                key={field.key}
                title={field.title}
                label={field.label}
                description={field.description}
                secret={secret}
                value={draft}
                isSaving={savingKey === field.key}
                isClearing={clearingKey === field.key}
                onChange={(next) => setDrafts((current) => ({ ...current, [field.key]: next }))}
                onSave={() => void handleSecretSave(field.key)}
                onClear={() => void handleSecretClear(field.key)}
              />
            );
          })}
        </div>

        <div
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            padding: "16px",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}
          >
            <div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--color-text)",
                  marginBottom: "2px",
                }}
              >
                Google Calendar Connection
              </div>
              <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                {status.calendar ? "Connected and available in the daily report." : "Not connected yet."}
              </div>
            </div>
            <StatusDot active={status.calendar} />
          </div>

          {status.calendar ? (
            <button onClick={handleDisconnect} style={ghostButtonStyle}>
              Disconnect
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button onClick={handleCalendarConnect} style={accentButtonStyle}>
                Connect Google Calendar
              </button>
              {oauthCode && (
                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                  <input
                    value={oauthCode}
                    onChange={(e) => setOauthCode(e.target.value)}
                    placeholder="Auth code"
                    style={inputStyle}
                  />
                  <button onClick={handleSubmitCode} disabled={connecting} style={accentButtonStyle}>
                    {connecting ? "Connecting..." : "Submit"}
                  </button>
                </div>
              )}
              {!status.calendar_configured && (
                <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                  Save both Google credential fields above before starting OAuth.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <ToastContainer />
    </>
  );
}

function SecretEditorCard({
  title,
  label,
  description,
  secret,
  value,
  isSaving,
  isClearing,
  onChange,
  onSave,
  onClear,
}: {
  title: string;
  label: string;
  description: string;
  secret: IntegrationSecretStatus;
  value: string;
  isSaving: boolean;
  isClearing: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
}) {
  return (
    <div
      style={{
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-sm)",
        padding: "14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>{title}</div>
        <StatusDot active={secret.configured} />
      </div>
      <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "12px", lineHeight: 1.5 }}>
        {description}
      </div>
      <Input
        type="password"
        autoComplete="off"
        spellCheck={false}
        label={label}
        value={value}
        placeholder={buildSecretPlaceholder(secret)}
        onChange={(e) => onChange(e.target.value)}
      />
      <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "8px" }}>
        {formatSecretStatus(secret)}
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        <button onClick={onSave} disabled={isSaving || !value.trim()} style={accentButtonStyle}>
          {isSaving ? "Saving..." : secret.configured ? "Update" : "Save"}
        </button>
        <button onClick={onClear} disabled={isClearing || !secret.configured} style={ghostButtonStyle}>
          {isClearing ? "Clearing..." : "Clear"}
        </button>
      </div>
    </div>
  );
}

function IntegrationSummaryCard({
  name,
  description,
  active,
  detail,
}: {
  name: string;
  description: string;
  active: boolean;
  detail: string;
}) {
  return (
    <div
      style={{
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-sm)",
        padding: "12px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text)" }}>{name}</span>
        <StatusDot active={active} />
      </div>
      <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{description}</div>
      <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px" }}>{detail}</div>
    </div>
  );
}

function buildSecretPlaceholder(secret: IntegrationSecretStatus) {
  if (!secret.configured) return "Enter value";
  return secret.last4 ? `Saved locally (...${secret.last4})` : "Saved locally";
}

function formatSecretStatus(secret: IntegrationSecretStatus) {
  if (!secret.configured) return "Not configured in .env.";
  return secret.last4
    ? `Configured locally. Suffix: ${secret.last4}`
    : "Configured locally.";
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <div
      style={{
        width: "7px",
        height: "7px",
        borderRadius: "50%",
        background: active ? "var(--color-success)" : "var(--color-text-muted)",
        flexShrink: 0,
      }}
    />
  );
}

const accentButtonStyle: React.CSSProperties = {
  padding: "6px 12px",
  background: "var(--color-accent)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  color: "#fff",
  fontSize: "12px",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
};

const ghostButtonStyle: React.CSSProperties = {
  padding: "6px 12px",
  background: "transparent",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text-muted)",
  fontSize: "12px",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text)",
  fontSize: "12px",
  padding: "6px 10px",
  fontFamily: "var(--font-sans)",
  outline: "none",
};
