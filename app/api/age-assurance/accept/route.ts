import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import {
  AI_DISCLOSURE_VERSION,
  PRIVACY_VERSION,
  TERMS_VERSION,
} from "@/lib/ageAssurance";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

const ALLOWED_CHARACTERS = ["luna", "ivy", "sienna"];

function getBearerToken(request: NextRequest) {
  const [scheme, token] = (request.headers.get("authorization") || "").split(" ");
  return scheme === "Bearer" ? token?.trim() || "" : "";
}

function getSafeCharacterId(characterId: unknown) {
  return typeof characterId === "string" && ALLOWED_CHARACTERS.includes(characterId)
    ? characterId
    : "luna";
}

function getSafeTimezone(timezone: unknown) {
  return typeof timezone === "string" && timezone.trim()
    ? timezone.trim()
    : "Europe/London";
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
      name?: string;
      email?: string;
      selectedCharacter?: string;
      timezone?: string;
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

    const userRef = getAdminDb().collection("users").doc(decodedToken.uid);
    const existingSnapshot = await userRef.get();

    // Only set the starter profile fields (plan, trialActive, etc.) the very
    // first time this account is confirmed, so the client's Firestore
    // security rules see a complete "free" profile from the start instead of
    // a partial document with no plan field. Re-running this for an
    // already-initialised account (e.g. a retry) must never reset their plan
    // or trial status.
    const starterProfileFields = existingSnapshot.exists
      ? {}
      : {
          id: decodedToken.uid,
          name:
            typeof body.name === "string" && body.name.trim()
              ? body.name.trim().slice(0, 80)
              : "",
          email:
            typeof body.email === "string" && body.email.trim()
              ? body.email.trim().toLowerCase()
              : decodedToken.email || "",
          selectedCharacter: getSafeCharacterId(body.selectedCharacter),
          timezone: getSafeTimezone(body.timezone),
          plan: "free",
          trialActive: true,
          createdAt: now,
        };

    await userRef.set(
      {
        ...starterProfileFields,
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
