import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  disconnectCalendar,
  fetchCalendarAuthUrl,
  fetchReportStatus,
  submitCalendarCode,
} from "@/api/memory";
import { useToast } from "@/components/ui/Toast";

export function IntegrationsPage() {
  const qc = useQueryClient();
  const { show, ToastContainer } = useToast();
  const { data: status, isLoading } = useQuery({
    queryKey: ["report-status"],
    queryFn: fetchReportStatus,
    staleTime: 30_000,
  });

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

  const handleCalendarConnect = async () => {
    if (!status?.calendar_configured) {
      show("Google OAuth not configured - add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env", "error");
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

  if (isLoading) {
    return <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Loading...</div>;
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
          Configure external integrations for the Daily Report. API keys go in your{" "}
          <code style={{ fontSize: "11px" }}>.env</code> file - they never leave your device.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <IntegrationCard
            name="Weather"
            description="OpenWeatherMap - set OPENWEATHERMAP_API_KEY"
            active={status?.weather ?? false}
          />
          <IntegrationCard
            name="Web Search"
            description="Ollama API - set OLLAMA_API_KEY (ollama.com/settings/keys)"
            active={status?.web_search ?? false}
            note="Powers research queries for your report"
          />
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
                Google Calendar
              </div>
              <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                {status?.calendar ? "Connected - events included in daily report" : "Not connected"}
              </div>
            </div>
            <StatusDot active={status?.calendar ?? false} />
          </div>

          {status?.calendar ? (
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
              {!status?.calendar_configured && (
                <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                  Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env to enable Calendar.
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

function IntegrationCard({
  name,
  description,
  active,
  note,
}: {
  name: string;
  description: string;
  active: boolean;
  note?: string;
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
      {note && (
        <div
          style={{
            fontSize: "11px",
            color: "var(--color-text-muted)",
            marginTop: "2px",
            fontStyle: "italic",
          }}
        >
          {note}
        </div>
      )}
    </div>
  );
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
