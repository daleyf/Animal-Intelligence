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
        Used for weather data in your daily report. Optional.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
        <Input
          id="onboard-home"
          label="Home location"
          value={home}
          onChange={(e) => onChangeHome(e.target.value)}
          placeholder="e.g. Pittsburgh,PA,US or London,GB"
          hint="Format: City,StateCode,CountryCode — state code is US only (2-letter abbreviation), country code is ISO 3166 (US, GB, FR…)"
        />
        <Input
          id="onboard-work"
          label="Work/school location"
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
