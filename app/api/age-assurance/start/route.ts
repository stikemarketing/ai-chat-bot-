import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import {
  isVerifyMyAgeConfigured,
  normalizeVerifyMyAgeCountry,
  startVerifyMyAgeVerification,
} from "@/lib/verifymyage";

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

    const decodedToken = await getAdminAuth().verifyIdToken(token);

    if (!isVerifyMyAgeConfigured()) {
      return NextResponse.json(
        {
          error:
            "VerifyMyAge Is Not Connected Yet. Add The API Credentials Before Enabling Live Age Verification.",
          setupRequired: true,
        },
        { status: 503 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      source?: string;
      character?: string;
    };

    // These come back intact on the redirect (Verifymy docs confirm query
    // strings survive the round trip), so the callback page can send the
    // user to the right place without needing its own state store.
    const callbackUrl = new URL("/age-verification/callback", request.nextUrl.origin);
    if (body.source === "app" || body.source === "web") {
      callbackUrl.searchParams.set("source", body.source);
    }
    if (typeof body.character === "string" && body.character.trim()) {
      callbackUrl.searchParams.set("character", body.character.trim());
    }

    const country = normalizeVerifyMyAgeCountry(request.headers.get("x-vercel-ip-country"));

    const result = await startVerifyMyAgeVerification({
      redirectUrl: callbackUrl.toString(),
      country,
      externalUserId: decodedToken.uid,
    });

    const userRef = getAdminDb().collection("users").doc(decodedToken.uid);

    if (result.status === "approved") {
      // Some methods (e.g. a background check) can approve instantly with
      // no user interaction at all -- no redirect needed in that case.
      await userRef.set(
        {
          adultVerified: true,
          adultVerificationStatus: "verified",
          adultVerificationProvider: "verifymyage",
          ageVerificationId: result.verificationId,
          ageVerificationUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return NextResponse.json({ verified: true });
    }

    await userRef.set(
      {
        adultVerificationStatus: "pending",
        adultVerificationProvider: "verifymyage",
        ageVerificationId: result.verificationId,
        ageVerificationStartedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (!result.startVerificationUrl) {
      return NextResponse.json(
        { error: "VerifyMyAge Did Not Return A Secure Link." },
        { status: 502 }
      );
    }

    return NextResponse.json({ redirectUrl: result.startVerificationUrl });
  } catch (error) {
    console.error("Age assurance start failed:", error);
    return NextResponse.json(
      { error: "The Private Age Check Could Not Be Started." },
      { status: 500 }
    );
  }
}
