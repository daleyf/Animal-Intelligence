import { apiFetch } from "./client";
import { UserProfile } from "@/types/profile";

export function fetchProfile() {
  return apiFetch<UserProfile>("/profile");
}

export function updateProfile(data: Partial<UserProfile>) {
  return apiFetch<UserProfile>("/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
