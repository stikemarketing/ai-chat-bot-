import { NextRequest, NextResponse } from "next/server";
import {
  isAgeAssuranceEnforced,
  normalizeAdultVerificationStatus,
} from "@/lib/ageAssurance";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const [scheme, token] = (request.headers.get("authorization") || "").split(" ");
  return scheme === "Bearer" ? token?.trim() || "" : "";
}

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Authentication Is Required." }, { status: 401 });
    }

    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const snapshot = await getAdminDb().collection("users").doc(decodedToken.uid).get();
    const data = snapshot.data() || {};

    return NextResponse.json({
      adultVerified: data.adultVerified === true,
      status: normalizeAdultVerificationStatus(data.adultVerificationStatus),
      provider: data.adultVerificationProvider || null,
      enforced: isAgeAssuranceEnforced(),
      providerConfigured: Boolean(process.env.AGECHECKED_API_KEY?.trim()),
    });
  } catch (error) {
    console.error("Age assurance status failed:", error);
    return NextResponse.json(
      { error: "The Age-Check Status Could Not Be Loaded." },
      { status: 500 }
    );
  }
}
