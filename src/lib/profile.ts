export const PROFILES = ["dev", "lead"] as const;
export type Profile = (typeof PROFILES)[number];

export const DEFAULT_PROFILE: Profile = "dev";
export const PROFILE_COOKIE = "cr_profile";
const PROFILE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const PROFILE_LABELS: Record<Profile, string> = {
  dev: "Dev",
  lead: "Líder",
};

export const PROFILE_HOME: Record<Profile, string> = {
  dev: "/",
  lead: "/lideranca",
};

export function parseProfile(value: string | null | undefined): Profile {
  return value === "lead" ? "lead" : DEFAULT_PROFILE;
}

export function persistProfile(profile: Profile) {
  document.cookie = `${PROFILE_COOKIE}=${profile}; path=/; max-age=${PROFILE_COOKIE_MAX_AGE}; samesite=lax`;
}
