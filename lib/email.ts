import { Resend } from "resend";

let cachedClient: Resend | null = null;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing env var: RESEND_API_KEY");
  }

  if (!cachedClient) {
    cachedClient = new Resend(apiKey);
  }

  return cachedClient;
}

// Resend's shared sending address that works immediately with no domain
// setup. Once a sending domain is verified in the Resend dashboard, this can
// be swapped for something like "reports@closetooyou.com" for better
// deliverability and branding.
const DEFAULT_FROM_ADDRESS = "Close Too You <onboarding@resend.dev>";

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_ADDRESS?.trim() || DEFAULT_FROM_ADDRESS,
      to: params.to,
      subject: params.subject,
      text: params.text,
      replyTo: params.replyTo,
    });

    if (error) {
      return { ok: false, error: error.message || "Resend rejected the email." };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not send email.",
    };
  }
}
