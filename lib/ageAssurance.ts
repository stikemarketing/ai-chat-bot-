export const TERMS_VERSION = "2026-08-22";
export const PRIVACY_VERSION = "2026-08-22";
export const AI_DISCLOSURE_VERSION = "2026-08-22";

export type AdultVerificationStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "failed";

export function normalizeAdultVerificationStatus(
  value: unknown
): AdultVerificationStatus {
  if (value === "pending" || value === "verified" || value === "failed") {
    return value;
  }

  return "not_started";
}

export function isAdultVerified(value: unknown) {
  return value === true;
}

export function isAgeAssuranceEnforced() {
  const configuredValue = process.env.AGE_ASSURANCE_ENFORCED?.trim();

  if (configuredValue === "true") return true;
  if (configuredValue === "false") return false;

  return process.env.NODE_ENV === "production";
}
