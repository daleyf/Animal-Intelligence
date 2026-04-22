import { useState } from "react";
import { Input, TextArea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Props {
  interests: string[];
  projects: string[];
  onFinish: (interests: string[], projects: string[]) => void;
  onBack: () => void;
  isSaving: boolean;
}

export function StepInterests({
  interests,
  projects,
  onFinish,
  onBack,
  isSaving,
}: Props) {
  const [interestText, setInterestText] = useState(interests.join(", "));
  const [projectText, setProjectText] = useState(projects.join("\n"));

  const handleFinish = () => {
    const parsedInterests = interestText.split(",").map((s) => s.trim()).filter(Boolean);
    const parsedProjects = projectText.split("\n").map((s) => s.trim()).filter(Boolean);
    onFinish(parsedInterests, parsedProjects);
  };

  return (
    <div>
      <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
        What are you into?
      </h2>
      <p style={{ fontSize: "14px", color: "var(--color-text-muted)", marginBottom: "24px" }}>
        Help Anchorpoint tailor its responses. All data stays local.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
        <Input
          id="onboard-interests"
          label="Interests (comma-separated)"
          value={interestText}
          onChange={(e) => setInterestText(e.target.value)}
          placeholder="e.g. hiking, music, machine learning"
        />
        <TextArea
          id="onboard-projects"
          label="Current projects (one per line)"
          value={projectText}
          onChange={(e) => setProjectText(e.target.value)}
          placeholder={"e.g. Building Anchorpoint\nLearning Rust"}
          rows={3}
        />
      </div>

      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={handleFinish} disabled={isSaving}>
          {isSaving ? "Saving…" : "Get Started"}
        </Button>
      </div>
    </div>
  );
}
