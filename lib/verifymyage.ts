import { createHmac } from "crypto";

// https://verifymy.io/developer-documentation/age-verification-estimation/apis/api-integration/
const DEFAULT_SANDBOX_BASE_URL = "https://sandbox.verifymyage.com";
const DEFAULT_PRODUCTION_BASE_URL = "https://oauth.verifymyage.com";

export type VerifyMyAgeCountry =
  | "au"
  | "br"
  | "gb"
  | "de"
  | "fr"
  | "us"
  | "es"
  | "ie"
  | "kr"
  | "it";

const SUPPORTED_COUNTRIES: VerifyMyAgeCountry[] = [
  "au",
  "br",
  "gb",
  "de",
  "fr",
  "us",
  "es",
  "ie",
  "kr",
  "it",
];

// Close Too You is currently marketed UK/EU-only (see project notes), so an
// unrecognised or missing country header falls back to "gb" rather than
// guessing a market we're not targeting yet.
export function normalizeVerifyMyAgeCountry(
  value: string | null | undefined
): VerifyMyAgeCountry {
  const normalized = (value || "").trim().toLowerCase();
  return (SUPPORTED_COUNTRIES as string[]).includes(normalized)
    ? (normalized as VerifyMyAgeCountry)
    : "gb";
}

export type VerifyMyAgeVerificationStatus =
  | "started"
  | "pending"
  | "approved"
  | "failed"
  | "expired";

export type StartVerificationResult = {
  verificationId: string;
  status: VerifyMyAgeVerificationStatus;
  startVerificationUrl: string | null;
};

export type VerificationStatusResult = {
  id: string;
  status: VerifyMyAgeVerificationStatus;
  approvalMethod: string | null;
};

function getBaseUrl() {
  const explicit = process.env.VERIFYMYAGE_BASE_URL?.trim();
  if (explicit) return explicit;

  return process.env.VERIFYMYAGE_ENVIRONMENT?.trim().toLowerCase() === "production"
    ? DEFAULT_PRODUCTION_BASE_URL
    : DEFAULT_SANDBOX_BASE_URL;
}

function getCredentials() {
  const apiKey = process.env.VERIFYMYAGE_API_KEY?.trim();
  const apiSecret = process.env.VERIFYMYAGE_API_SECRET?.trim();
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
}

export function isVerifyMyAgeConfigured() {
  return getCredentials() !== null;
}

function signHmac(payload: string, apiSecret: string) {
  return createHmac("sha256", apiSecret).update(payload).digest("hex");
}

// NOTE: the docs specify `HMAC-SHA256(request_uri, api_secret)` for GET
// requests without confirming whether `request_uri` means the path alone or
// the full URL with scheme/host. This uses the path (+ query string, if
// any), matching how the POST signature is scoped to just the body. If a
// real GET call ever comes back 401 "unauthorized", this is the first thing
// to double check against Verifymy support.
async function verifyMyAgeFetch(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>
): Promise<Record<string, any>> {
  const credentials = getCredentials();
  if (!credentials) {
    throw new Error("VerifyMyAge Is Not Configured.");
  }

  const baseUrl = getBaseUrl();
  const serializedBody = body ? JSON.stringify(body) : "";
  const signature =
    method === "POST"
      ? signHmac(serializedBody, credentials.apiSecret)
      : signHmac(path, credentials.apiSecret);

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `hmac ${credentials.apiKey}:${signature}`,
      "Content-Type": "application/json",
    },
    body: method === "POST" ? serializedBody : undefined,
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data?.error === "string"
        ? data.error
        : `VerifyMyAge Request Failed (${response.status}).`;
    throw new Error(message);
  }

  return data;
}

export async function startVerifyMyAgeVerification(options: {
  redirectUrl: string;
  country: VerifyMyAgeCountry;
  externalUserId: string;
}): Promise<StartVerificationResult> {
  const businessSettingsId = process.env.VERIFYMYAGE_BUSINESS_SETTINGS_ID?.trim();

  const data = await verifyMyAgeFetch("POST", "/api/v3/verifications", {
    redirect_url: options.redirectUrl,
    country: options.country,
    external_user_id: options.externalUserId,
    ...(businessSettingsId ? { business_settings_id: businessSettingsId } : {}),
  });

  return {
    verificationId: data.verification_id,
    status: data.verification_status,
    startVerificationUrl: data.start_verification_url || null,
  };
}

export async function getVerifyMyAgeVerificationStatus(
  verificationId: string
): Promise<VerificationStatusResult> {
  const data = await verifyMyAgeFetch(
    "GET",
    `/api/v3/verifications/${encodeURIComponent(verificationId)}`
  );

  return {
    id: data.id,
    status: data.status,
    approvalMethod: data.approval_method || null,
  };
}
