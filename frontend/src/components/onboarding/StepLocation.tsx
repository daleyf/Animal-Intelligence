import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Props {
  home: string;
  work: string;
  onChangeHome: (v: string) => void;
  onChangeWork: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepLocation({ home, work, onChangeHome, onChangeWork, onNext, onBack }: Props) {
  return (
    <div>
      <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
        Where are you based?
      </h2>
      <p style={{ fontSize: "14px", color: "var(--color-text-muted)", marginBottom: "24px" }}>
        Used for weather and commute data in morning reports. Optional.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
        <Input
          id="onboard-home"
          label="Home location"
          value={home}
          onChange={(e) => onChangeHome(e.target.value)}
          placeholder="e.g. Pittsburgh, PA"
        />
        <Input
          id="onboard-work"
          label="Work or school location"
          value={work}
          onChange={(e) => onChangeWork(e.target.value)}
          placeholder="e.g. University of Pittsburgh"
        />
      </div>

      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={onNext}>Next →</Button>
      </div>
    </div>
  );
}
