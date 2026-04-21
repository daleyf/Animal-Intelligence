import { useCallback, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAppStore } from "@/store/appStore";
import { useProfile } from "@/hooks/useProfile";
import { checkHealth } from "@/api/settings";
import { AppShell } from "@/components/layout/AppShell";
import { ChatPage } from "@/components/chat/ChatPage";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { ModelsPage } from "@/components/settings/ModelsPage";
import { ProfilePage } from "@/components/settings/ProfilePage";
import { MemoryPage } from "@/components/settings/MemoryPage";
import { IntegrationsPage } from "@/components/settings/IntegrationsPage";
import { VoicePage } from "@/components/settings/VoicePage";
import { ActivityLog } from "@/components/layout/ActivityLog";
import { ReportPage } from "@/components/layout/ReportPage";
import { ResearchPage } from "@/components/research/ResearchPage";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { useQueryClient } from "@tanstack/react-query";

function AppInner() {
  const { setOllamaConnected, setActiveModel } = useAppStore();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const queryClient = useQueryClient();

  // Poll health check + load active model from settings on startup — run in parallel
  useEffect(() => {
    const checkAndLoad = async () => {
      await Promise.all([
        checkHealth()
          .then((h) => setOllamaConnected(h.ollama_connected))
          .catch(() => setOllamaConnected(false)),
        fetch("/api/v1/settings")
          .then((r) => (r.ok ? r.json() : null))
          .then((s) => { if (s?.active_model) setActiveModel(s.active_model); })
          .catch(() => undefined),
      ]);
    };
    checkAndLoad();
    const interval = setInterval(
      () => checkHealth()
        .then((h) => setOllamaConnected(h.ollama_connected))
        .catch(() => setOllamaConnected(false)),
      15_000
    );
    return () => clearInterval(interval);
  }, [setOllamaConnected, setActiveModel]);

  const handleOnboardingComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  }, [queryClient]);

  const { ollamaConnected } = useAppStore();

  // Show onboarding wizard if profile not yet completed
  if (!profileLoading && profile && !profile.onboarding_done) {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Ollama disconnection banner — in normal flow so it doesn't push content off-screen */}
      {!ollamaConnected && (
        <div
          style={{
            background: "var(--color-danger)",
            color: "#fff",
            fontSize: "12px",
            padding: "8px 20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexShrink: 0,
            zIndex: 1000,
          }}
        >
          <span style={{ fontWeight: 600 }}>Ollama not connected</span>
          <span style={{ opacity: 0.85 }}>
            Start Ollama to chat:{" "}
            <code style={{ background: "rgba(0,0,0,0.2)", padding: "1px 5px", borderRadius: "3px" }}>
              ollama serve
            </code>
          </span>
        </div>
      )}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<ChatPage />} />
            <Route path="/research" element={<ResearchPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/activity" element={<ActivityLog />} />
            <Route path="/settings" element={<SettingsPage />}>
              <Route index element={<Navigate to="/settings/general" replace />} />
              <Route path="general" element={<GeneralSettings />} />
              <Route path="models" element={<ModelsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="memory" element={<MemoryPage />} />
              <Route path="integrations" element={<IntegrationsPage />} />
              <Route path="voice" element={<VoicePage />} />
            </Route>
          </Route>
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
