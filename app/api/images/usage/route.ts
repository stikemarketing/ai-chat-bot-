import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import {
  getImageUsageDocId,
  IMAGE_DAILY_LIMITS,
  normalizeImagePlan,
} from "@/lib/imageEntitlements";

type ImageUsageRecord = {
  normalImagesToday?: number;
  spicyImagesToday?: number;
};

type ImageUsageUser = {
  plan?: string;
  timezone?: string;
};

function getBearerToken(request: NextRequest) {
  const authorizationHeader = request.headers.get("authorization") || "";
  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token?.trim()) {
    return "";
  }

  return token.trim();
}

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        { error: "Missing Firebase authentication token." },
        { status: 401 }
      );
    }

    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const db = getAdminDb();
    const userRef = db.collection("users").doc(decodedToken.uid);
    const userSnapshot = await userRef.get();

    if (!userSnapshot.exists) {
      return NextResponse.json(
        { error: "Authenticated user was not found." },
        { status: 404 }
      );
    }

    const user = userSnapshot.data() as ImageUsageUser;
    const plan = normalizeImagePlan(user.plan);
    const limits = IMAGE_DAILY_LIMITS[plan];
    const usageDocId = getImageUsageDocId(new Date(), user.timezone);
    const usageSnapshot = await userRef
      .collection("imageUsage")
      .doc(usageDocId)
      .get();
    const usage = usageSnapshot.exists
      ? (usageSnapshot.data() as ImageUsageRecord)
      : {};
    const normalUsed = Math.max(usage.normalImagesToday || 0, 0);
    const spicyUsed = Math.max(usage.spicyImagesToday || 0, 0);

    return NextResponse.json({
      plan,
      normalRemaining:
        limits.includedNormalImages === null
          ? null
          : Math.max(limits.includedNormalImages - normalUsed, 0),
      spicyRemaining:
        limits.includedSpicyImages === null
          ? null
          : Math.max(limits.includedSpicyImages - spicyUsed, 0),
    });
  } catch (error) {
    console.error("Failed to load image usage:", error);

    return NextResponse.json(
      { error: "Failed to load image usage." },
      { status: 500 }
    );
  }
}
