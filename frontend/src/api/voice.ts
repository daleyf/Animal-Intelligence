import { apiFetch } from "./client";

export interface VoiceProfile {
  id: string;
  name: string;
  description: string;
  rate: number;
  pitch: number;
  is_custom?: boolean;
}

export interface VoiceSettings {
  enabled: boolean;
  profile: string;
  rate: number;
  pitch: number;
}

export interface CustomVoiceProfile {
  id: string;
  name: string;
  rate: number;
  pitch: number;
  created_at: string | null;
}

export async function getVoiceProfiles(): Promise<VoiceProfile[]> {
  const data = await apiFetch<{ profiles: VoiceProfile[] }>("/voice/profiles");
  return data.profiles;
}

export async function getVoiceSettings(): Promise<VoiceSettings> {
  return apiFetch<VoiceSettings>("/voice/settings");
}

export async function updateVoiceSettings(
  updates: Partial<Omit<VoiceSettings, "profile"> & { profile: string }>
): Promise<VoiceSettings> {
  return apiFetch<VoiceSettings>("/voice/settings", {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export async function createCustomProfile(data: {
  name: string;
  rate: number;
  pitch: number;
}): Promise<CustomVoiceProfile> {
  return apiFetch<CustomVoiceProfile>("/voice/custom-profiles", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteCustomProfile(id: string): Promise<void> {
  await apiFetch<{ deleted: string }>(`/voice/custom-profiles/${id}`, {
    method: "DELETE",
  });
}
