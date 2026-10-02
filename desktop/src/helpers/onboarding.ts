export type OnboardingStep = "welcome" | "join" | "create" | "done";

export function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function savePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Setup remains usable when local storage is unavailable. */
  }
}

export const ONBOARDING_KEY = "amp.onboarding.v1";
export const WORKSPACE_KEY = "amp.workspace.v1";

export function readOnboardingStep(): OnboardingStep {
  const saved = readPreference(ONBOARDING_KEY);
  return saved === "join" || saved === "create" || saved === "done"
    ? saved
    : "welcome";
}
