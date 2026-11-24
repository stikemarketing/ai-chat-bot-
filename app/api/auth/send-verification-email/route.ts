import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";
import { sendEmail } from "@/lib/email";
import {
  buildVerificationEmailHtml,
  buildVerificationEmailText,
} from "@/lib/emailTemplates";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const [scheme, token] = (request.headers.get("authorization") || "").split(" ");
  return scheme === "Bearer" ? token?.trim() || "" : "";
}

function getAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!appUrl) {
    throw new Error("Missing NEXT_PUBLIC_APP_URL in environment.");
  }

  return appUrl.replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Authentication Is Required." }, { status: 401 });
    }

    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const email = decodedToken.email;

    if (!email) {
      return NextResponse.json(
        { error: "This Account Has No Email Address On File." },
        { status: 400 }
      );
    }

    const verificationLink = await getAdminAuth().generateEmailVerificationLink(
      email,
      { url: `${getAppUrl()}/auth/action` }
    );

    const displayName =
      typeof decodedToken.name === "string" ? decodedToken.name : undefined;

    const sendResult = await sendEmail({
      to: email,
      subject: "Verify your email — Close Too You",
      text: buildVerificationEmailText({
        verificationLink,
        name: displayName,
      }),
      html: buildVerificationEmailHtml({
        verificationLink,
        name: displayName,
      }),
    });

    if (!sendResult.ok) {
      console.error("Failed to send verification email:", sendResult.error);
      return NextResponse.json(
        { error: "Could Not Send The Verification Email. Please Try Again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("send-verification-email failed:", error);
    return NextResponse.json(
      { error: "Could Not Send The Verification Email. Please Try Again." },
      { status: 500 }
    );
  }
}
