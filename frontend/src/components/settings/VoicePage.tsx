import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getVoiceProfiles,
  getVoiceSettings,
  updateVoiceSettings,
  createCustomProfile,
  deleteCustomProfile,
  VoiceProfile,
} from "@/api/voice";
import { useSpeech } from "@/hooks/useVoice";

const PREVIEW_TEXT =
  "Good morning. Here's your daily briefing. The weather looks clear and your first meeting is at nine.";

export function VoicePage() {
  const qc = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRate, setNewRate] = useState(1.0);
  const [newPitch, setNewPitch] = useState(1.0);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["voice-settings"],
    queryFn: getVoiceSettings,
    staleTime: 60_000,
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["voice-profiles"],
    queryFn: getVoiceProfiles,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: updateVoiceSettings,
    onSuccess: (updated) => qc.setQueryData(["voice-settings"], updated),
  });

  const createMutation = useMutation({
    mutationFn: createCustomProfile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["voice-profiles"] });
      setShowCreateForm(false);
      setNewName("");
      setNewRate(1.0);
      setNewPitch(1.0);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCustomProfile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["voice-profiles"] });
      qc.invalidateQueries({ queryKey: ["voice-settings"] });
    },
  });

  const { speak, stop, speaking, supported } = useSpeech();

  if (settingsLoading || !settings) {
    return <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Loading…</div>;
  }

  const handleProfileSelect = (profile: VoiceProfile) => {
    mutation.mutate({ profile: profile.id, rate: profile.rate, pitch: profile.pitch });
  };

  const handlePreview = () => {
    if (speaking) { stop(); return; }
    speak(PREVIEW_TEXT);
  };

  const handleCreateSubmit = () => {
    if (!newName.trim()) return;
    createMutation.mutate({ name: newName.trim(), rate: newRate, pitch: newPitch });
  };

  const builtInProfiles = profiles.filter((p) => !p.is_custom);
  const customProfiles = profiles.filter((p) => p.is_custom);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px", maxWidth: "520px" }}>
      {/* Enable toggle */}
      <section>
        <div style={sectionHeaderStyle}>Voice Output</div>
        <label style={rowStyle}>
          <span style={{ fontSize: "13px", color: "var(--color-text)" }}>
            Enable "Read Aloud" button on assistant messages
          </span>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => mutation.mutate({ enabled: e.target.checked })}
            style={{ accentColor: "var(--color-accent)", width: "16px", height: "16px" }}
          />
        </label>
        {!supported && (
          <div style={{ fontSize: "11px", color: "var(--color-danger)", marginTop: "6px" }}>
            Web Speech API is not supported in this browser.
          </div>
        )}
      </section>

      {/* Built-in profile selector */}
      <section>
        <div style={sectionHeaderStyle}>Voice Profile</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {builtInProfiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isActive={settings.profile === profile.id}
              onSelect={() => handleProfileSelect(profile)}
            />
          ))}
        </div>
      </section>

      {/* Custom profiles */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <div style={sectionHeaderStyle}>Custom Profiles</div>
          <button
            onClick={() => setShowCreateForm((v) => !v)}
            style={{
              fontSize: "11px",
              padding: "4px 10px",
              background: showCreateForm ? "var(--color-surface-2)" : "var(--color-accent)",
              color: showCreateForm ? "var(--color-text-muted)" : "#fff",
              border: showCreateForm ? "1px solid var(--color-border)" : "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
            }}
          >
            {showCreateForm ? "Cancel" : "+ New Profile"}
          </button>
        </div>

        {/* Create form */}
        {showCreateForm && (
          <div style={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            padding: "14px",
            marginBottom: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}>
            <div>
              <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "4px" }}>
                Profile name
              </div>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Calm, Energetic…"
                maxLength={100}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--color-text)",
                  fontSize: "13px",
                  fontFamily: "var(--font-sans)",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <SliderRow
              label="Speed"
              value={newRate}
              min={0.5} max={2.0} step={0.05}
              display={`${newRate.toFixed(2)}×`}
              onChange={setNewRate}
            />
            <SliderRow
              label="Pitch"
              value={newPitch}
              min={0.0} max={2.0} step={0.05}
              display={newPitch.toFixed(2)}
              onChange={setNewPitch}
            />
            <button
              onClick={handleCreateSubmit}
              disabled={!newName.trim() || createMutation.isPending}
              style={{
                padding: "8px 16px",
                background: newName.trim() ? "var(--color-accent)" : "var(--color-surface-3)",
                color: newName.trim() ? "#fff" : "var(--color-text-muted)",
                border: "none",
                borderRadius: "var(--radius-sm)",
                fontSize: "12px",
                cursor: newName.trim() ? "pointer" : "not-allowed",
                fontFamily: "var(--font-sans)",
                alignSelf: "flex-start",
              }}
            >
              {createMutation.isPending ? "Saving…" : "Save Profile"}
            </button>
          </div>
        )}

        {customProfiles.length === 0 && !showCreateForm && (
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
            No custom profiles yet. Click "+ New Profile" to create one.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {customProfiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isActive={settings.profile === profile.id}
              onSelect={() => handleProfileSelect(profile)}
              onDelete={() => deleteMutation.mutate(profile.id)}
            />
          ))}
        </div>
      </section>

      {/* Fine-tune sliders */}
      <section>
        <div style={sectionHeaderStyle}>Fine-tune</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <SliderRow
            label="Speed"
            value={settings.rate}
            min={0.5} max={2.0} step={0.05}
            display={`${settings.rate.toFixed(2)}×`}
            onChange={(v) => mutation.mutate({ rate: v })}
          />
          <SliderRow
            label="Pitch"
            value={settings.pitch}
            min={0.0} max={2.0} step={0.05}
            display={settings.pitch.toFixed(2)}
            onChange={(v) => mutation.mutate({ pitch: v })}
          />
        </div>
      </section>

      {/* Preview */}
      <section>
        <div style={sectionHeaderStyle}>Preview</div>
        <button
          onClick={handlePreview}
          disabled={!supported}
          style={{
            padding: "8px 18px",
            background: speaking ? "var(--color-surface-2)" : "var(--color-accent)",
            border: speaking ? "1px solid var(--color-border)" : "none",
            borderRadius: "var(--radius-sm)",
            color: speaking ? "var(--color-text-muted)" : "#fff",
            fontSize: "12px",
            cursor: supported ? "pointer" : "not-allowed",
            fontFamily: "var(--font-sans)",
          }}
        >
          {speaking ? "Stop preview" : "▶ Play sample"}
        </button>
        <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "6px" }}>
          Uses your operating system's built-in voices — fully local, no network required.
        </div>
      </section>
    </div>
  );
}

function ProfileCard({
  profile,
  isActive,
  onSelect,
  onDelete,
}: {
  profile: VoiceProfile;
  isActive: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        background: isActive ? "var(--color-accent-dim)" : "var(--color-surface-2)",
        border: `1px solid ${isActive ? "var(--color-accent)" : "var(--color-border)"}`,
        borderRadius: "var(--radius-sm)",
        gap: "8px",
      }}
    >
      <button
        onClick={onSelect}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          padding: 0,
        }}
      >
        <div>
          <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text)", marginBottom: "2px" }}>
            {profile.name}
          </div>
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
            {profile.description}
          </div>
        </div>
        {isActive && (
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-accent)", flexShrink: 0, marginRight: "8px" }} />
        )}
      </button>
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete profile"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text-muted)",
            fontSize: "14px",
            padding: "2px 6px",
            borderRadius: "var(--radius-sm)",
            flexShrink: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
        <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{label}</span>
        <span style={{ fontSize: "12px", color: "var(--color-text)", fontVariantNumeric: "tabular-nums" }}>
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "var(--color-accent)" }}
      />
    </div>
  );
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "var(--color-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.8px",
  marginBottom: "10px",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  cursor: "pointer",
};
