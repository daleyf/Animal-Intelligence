import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
}

export function StepName({ value, onChange, onNext, onSkip }: Props) {
  return (
    <div>
      <div style={{ fontSize: "28px", marginBottom: "8px" }}>⚓</div>
      <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>
        Welcome to Anchorpoint
      </h2>
      <p style={{ fontSize: "14px", color: "var(--color-text-muted)", marginBottom: "28px" }}>
        Your private AI assistant. Everything stays on your machine — no cloud, no data sharing.
        Let's personalize your experience.
      </p>

      <div style={{ marginBottom: "24px" }}>
        <Input
          id="onboard-name"
          label="What should I call you?"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your name"
          autoFocus
        />
      </div>

      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Skip setup
        </Button>
        <Button onClick={onNext}>
          Next →
        </Button>
      </div>
    </div>
  );
}
