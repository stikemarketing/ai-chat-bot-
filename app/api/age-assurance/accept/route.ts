import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import {
  AI_DISCLOSURE_VERSION,
  PRIVACY_VERSION,
  TERMS_VERSION,
} from "@/lib/ageAssurance";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const [scheme, token] = (request.headers.get("authorization") || "").split(" ");
  return scheme === "Bearer" ? token?.trim() || "" : "";
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Authentication Is Required." }, { status: 401 });
    }

    const body = (await request.json()) as {
      adultConfirmed?: boolean;
      termsAccepted?: boolean;
      privacyAccepted?: boolean;
      aiDisclosureAccepted?: boolean;
    };

    if (
      body.adultConfirmed !== true ||
      body.termsAccepted !== true ||
      body.privacyAccepted !== true ||
      body.aiDisclosureAccepted !== true
    ) {
      return NextResponse.json(
        { error: "Every Required Confirmation Must Be Accepted." },
        { status: 400 }
      );
    }

    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const now = FieldValue.serverTimestamp();

    await getAdminDb().collection("users").doc(decodedToken.uid).set(
      {
        adultSelfDeclared: true,
        adultSelfDeclaredAt: now,
        termsAcceptedAt: now,
        termsVersion: TERMS_VERSION,
        privacyAcceptedAt: now,
        privacyVersion: PRIVACY_VERSION,
        aiDisclosureAcceptedAt: now,
        aiDisclosureVersion: AI_DISCLOSURE_VERSION,
        updatedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Age assurance acceptance failed:", error);
    return NextResponse.json(
      { error: "The Account Confirmation Could Not Be Saved." },
      { status: 500 }
    );
  }
}
