// Branded HTML email templates, built with inline styles and a table-based
// layout so they render consistently across email clients (Gmail, Apple
// Mail, Outlook, etc.) rather than relying on modern CSS those clients strip
// out. Colors match the app's own brand (see app/auth/action/page.tsx and
// app/signup/page.tsx): warm pink-white background, deep red accent, white
// rounded card.

const BRAND_BG = "#f7eeee";
const BRAND_RED = "#b10f38";
const BRAND_RED_DARK = "#8f0c2d";
const BRAND_TEXT = "#111111";
const BRAND_MUTED = "#6b6b6b";

export function buildVerificationEmailHtml(params: {
  verificationLink: string;
  name?: string;
}): string {
  const greetingName = params.name?.trim() ? params.name.trim() : "there";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify your email</title>
  </head>
  <body style="margin:0; padding:0; background-color:${BRAND_BG}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND_BG}; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#ffffff; border-radius:24px; overflow:hidden; border:1px solid rgba(193,18,63,0.12);">
            <tr>
              <td style="height:6px; background-color:${BRAND_RED}; line-height:6px; font-size:6px;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:40px 36px 32px 36px; text-align:center;">
                <div style="width:56px; height:56px; line-height:56px; border-radius:999px; background-color:#fff1f4; color:${BRAND_RED}; font-size:26px; font-weight:600; margin:0 auto 20px auto; text-align:center;">
                  &#10003;
                </div>
                <h1 style="margin:0 0 12px 0; font-size:22px; line-height:1.3; color:${BRAND_TEXT}; font-weight:700;">
                  Verify your email
                </h1>
                <p style="margin:0 0 4px 0; font-size:15px; line-height:1.6; color:${BRAND_TEXT};">
                  Hi ${escapeHtml(greetingName)},
                </p>
                <p style="margin:0 0 28px 0; font-size:15px; line-height:1.6; color:${BRAND_TEXT};">
                  Thanks for joining Close Too You. Click the button below to verify
                  your email address and finish setting up your account.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px auto;">
                  <tr>
                    <td align="center" style="border-radius:999px; background-color:${BRAND_RED};">
                      <a
                        href="${params.verificationLink}"
                        target="_blank"
                        style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:999px; background-color:${BRAND_RED};"
                      >
                        Verify my email
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 4px 0; font-size:13px; line-height:1.6; color:${BRAND_MUTED};">
                  Or paste this link into your browser:
                </p>
                <p style="margin:0; font-size:13px; line-height:1.6; word-break:break-all;">
                  <a href="${params.verificationLink}" target="_blank" style="color:${BRAND_RED_DARK};">${params.verificationLink}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px 28px 36px; border-top:1px solid rgba(17,17,17,0.06); text-align:center;">
                <p style="margin:0; font-size:12px; line-height:1.6; color:${BRAND_MUTED};">
                  If you didn't create an account with Close Too You, you can safely
                  ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildVerificationEmailText(params: {
  verificationLink: string;
  name?: string;
}): string {
  const greetingName = params.name?.trim() ? params.name.trim() : "there";

  return [
    `Hi ${greetingName},`,
    "",
    "Thanks for joining Close Too You. Verify your email address using the link below to finish setting up your account:",
    "",
    params.verificationLink,
    "",
    "If you didn't create an account with Close Too You, you can safely ignore this email.",
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
