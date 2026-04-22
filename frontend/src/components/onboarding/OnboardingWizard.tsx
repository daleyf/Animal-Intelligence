import { useState } from "react";
import { useUpdateProfile } from "@/hooks/useProfile";
import { StepName } from "./StepName";
import { StepLocation } from "./StepLocation";
import { StepInterests } from "./StepInterests";

interface WizardData {
  name: string;
  home_location: string;
  work_location: string;
  interests: string[];
  projects: string[];
}

interface Props {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({
    name: "",
    home_location: "",
    work_location: "",
    interests: [],
    projects: [],
  });
  const { mutate: save, isPending } = useUpdateProfile();

  const steps = ["Welcome", "Location", "Interests"];

  const handleFinish = (finalData: WizardData) => {
    save(
      { ...finalData, onboarding_done: true },
      { onSuccess: onComplete }
    );
  };

  const handleSkip = () => {
    save({ onboarding_done: true }, { onSuccess: onComplete });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--color-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
      }}
    >
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          padding: "40px",
          maxWidth: "480px",
          width: "90%",
          animation: "fade-in 0.2s ease",
        }}
      >
        {/* Progress indicator */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "32px" }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: "3px",
                borderRadius: "2px",
                background: i <= step ? "var(--color-accent)" : "var(--color-surface-3)",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>

        {/* Step content */}
        {step === 0 && (
          <StepName
            value={data.name}
            onChange={(name) => setData((d) => ({ ...d, name }))}
            onNext={() => setStep(1)}
            onSkip={handleSkip}
          />
        )}
        {step === 1 && (
          <StepLocation
            home={data.home_location}
            onChangeHome={(v) => setData((d) => ({ ...d, home_location: v }))}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <StepInterests
            interests={data.interests}
            projects={data.projects}
            onFinish={(interests, projects) =>
              handleFinish({ ...data, interests, projects })
            }
            onBack={() => setStep(1)}
            isSaving={isPending}
          />
        )}
      </div>
    </div>
  );
}
