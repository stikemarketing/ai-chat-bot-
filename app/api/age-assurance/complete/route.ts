import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { getVerifyMyAgeVerificationStatus, isVerifyMyAgeConfigured } from "@/lib/verifymyage";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const [scheme, token] = (request.headers.get("authorization") || "").split(" ");
  return scheme === "Bearer" ? token?.trim() || "" : "";
}

// Called by the /age-verification/callback page once the user lands back
// from VerifyMyAge. Never trusts the redirect/verification_id alone -- it
// re-checks the account's own pending verification id before accepting it,
// then asks VerifyMyAge directly for the real status.
export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Authentication Is Required." }, { status: 401 });
    }

    const decodedToken = await getAdminAuth().verifyIdToken(token);

    const body = (await request.json().catch(() => ({}))) as { verificationId?: string };
    const verificationId =
      typeof body.verificationId === "string" ? body.verificationId.trim() : "";

    if (!verificationId) {
      return NextResponse.json({ error: "Missing Verification Id." }, { status: 400 });
    }

    if (!isVerifyMyAgeConfigured()) {
      return NextResponse.json(
        { error: "VerifyMyAge Is Not Connected Yet." },
        { status: 503 }
      );
    }

    const userRef = getAdminDb().collection("users").doc(decodedToken.uid);
    const snapshot = await userRef.get();
    const storedVerificationId = snapshot.data()?.ageVerificationId;

    if (storedVerificationId && storedVerificationId !== verificationId) {
      return NextResponse.json(
        { error: "Verification Id Does Not Match This Account." },
        { status: 403 }
      );
    }

    const result = await getVerifyMyAgeVerificationStatus(verificationId);

    const adultVerified = result.status === "approved";
    const normalizedStatus =
      result.status === "approved"
        ? "verified"
        : result.status === "failed" || result.status === "expired"
          ? "failed"
          : "pending";

    await userRef.set(
      {
        adultVerified,
        adultVerificationStatus: normalizedStatus,
        adultVerificationProvider: "verifymyage",
        ageVerificationUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ adultVerified, status: normalizedStatus });
  } catch (error) {
    console.error("Age assurance completion failed:", error);
    return NextResponse.json(
      { error: "The Age-Check Result Could Not Be Confirmed." },
      { status: 500 }
    );
  }
}
