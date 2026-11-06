import { ENABLE_LEAD_VIEW } from "@/lib/features";

export const PROFILES = ["dev", "lead"] as const;
export type Profile = (typeof PROFILES)[number];

/** Perfis que a interface oferece. Com a visão de líder desligada, só Dev. */
export const UI_PROFILES: readonly Profile[] = ENABLE_LEAD_VIEW ? PROFILES : ["dev"];

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

export function normalizeProfile(profile: Profile): Profile {
  return ENABLE_LEAD_VIEW || profile === "dev" ? profile : DEFAULT_PROFILE;
}

export function parseProfile(value: string | null | undefined): Profile {
  return normalizeProfile(value === "lead" ? "lead" : DEFAULT_PROFILE);
}

export function persistProfile(profile: Profile) {
  document.cookie = `${PROFILE_COOKIE}=${profile}; path=/; max-age=${PROFILE_COOKIE_MAX_AGE}; samesite=lax`;
}
