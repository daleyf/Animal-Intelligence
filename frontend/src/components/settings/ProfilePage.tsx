import { useState, useEffect } from "react";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { Input, TextArea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

export function ProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const { mutate: save, isPending: saving } = useUpdateProfile();

  const [name, setName] = useState("");
  const [home, setHome] = useState("");
  const [work, setWork] = useState("");
  const [interests, setInterests] = useState("");
  const [projects, setProjects] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setHome(profile.home_location ?? "");
      setWork(profile.work_location ?? "");
      setInterests((profile.interests ?? []).join(", "));
      setProjects((profile.projects ?? []).join("\n"));
    }
  }, [profile]);

  const handleSave = () => {
    save(
      {
        name: name || undefined,
        home_location: home || undefined,
        work_location: work || undefined,
        interests: interests
          ? interests.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        projects: projects
          ? projects.split("\n").map((s) => s.trim()).filter(Boolean)
          : [],
        onboarding_done: true,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
        <Spinner />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "480px" }}>
      <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "6px" }}>Profile</h2>
      <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "24px" }}>
        Your profile is used to personalize responses. All data stays on your device.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Input
          id="name"
          label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alex"
        />
        <Input
          id="home"
          label="Home location"
          value={home}
          onChange={(e) => setHome(e.target.value)}
          placeholder="e.g. Pittsburgh, PA"
        />
        <Input
          id="work"
          label="Work/school location"
          value={work}
          onChange={(e) => setWork(e.target.value)}
          placeholder="e.g. University of Pittsburgh"
        />
        <Input
          id="interests"
          label="Interests (comma-separated)"
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          placeholder="e.g. hiking, software engineering, music"
        />
        <TextArea
          id="projects"
          label="Current projects (one per line)"
          value={projects}
          onChange={(e) => setProjects(e.target.value)}
          placeholder={"e.g. Building Anchorpoint\nLearning Rust"}
          rows={4}
        />

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Profile"}
          </Button>
          {saved && (
            <span style={{ fontSize: "13px", color: "var(--color-success)" }}>
              Saved!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
