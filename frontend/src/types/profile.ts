export interface UserProfile {
  name: string | null;
  home_location: string | null;
  work_location: string | null;
  interests: string[] | null;
  projects: string[] | null;
  onboarding_done: boolean;
}
