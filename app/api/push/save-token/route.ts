// app/api/push/save-token/route.ts

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { normalizePlan } from "@/lib/plans";

type SavePushTokenRequestBody = {
  userId?: string;
  token?: string;
  characterId?: string;
};

const allowedCharacterIds = ["luna", "ivy", "sienna"];

function getSafeCharacterId(characterId?: string) {
  const cleanCharacterId = characterId?.trim().toLowerCase();

  if (cleanCharacterId && allowedCharacterIds.includes(cleanCharacterId)) {
    return cleanCharacterId;
  }

  return "luna";
}

function getSafeToken(token?: string) {
  const cleanToken = token?.trim();

  if (!cleanToken) {
    return "";
  }

  return cleanToken;
}

function getBearerToken(request: NextRequest) {
  const authorizationHeader = request.headers.get("authorization") || "";
  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token?.trim()) {
    return "";
  }

  return token.trim();
}

async function getVerifiedUserId(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    throw new Error("Missing Firebase authentication token.");
  }

  const decodedToken = await getAdminAuth().verifyIdToken(token);

  if (!decodedToken.uid) {
    throw new Error("Firebase authentication token did not include a user ID.");
  }

  return decodedToken.uid;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SavePushTokenRequestBody;

    const verifiedUserId = await getVerifiedUserId(request);
    const token = getSafeToken(body.token);
    const characterId = getSafeCharacterId(body.characterId);

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Push token is required." },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    const userRef = adminDb.collection("users").doc(verifiedUserId);
    const userSnapshot = await userRef.get();

    if (!userSnapshot.exists) {
      return NextResponse.json(
        { ok: false, error: "Authenticated user was not found." },
        { status: 404 }
      );
    }

    const plan = normalizePlan(userSnapshot.data()?.plan);

    if (plan === "free") {
      return NextResponse.json(
        {
          ok: false,
          error: "Hourly companion notifications require Pro or Unlimited.",
        },
        { status: 403 }
      );
    }

    const pushTokenRef = userRef.collection("pushTokens").doc(token);
    const batch = adminDb.batch();

    batch.set(
      userRef,
      {
        pushNotificationsEnabled: true,
        hourlyMessagesEnabled: true,
        lastPushTokenSavedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    batch.set(
      pushTokenRef,
      {
        token,
        characterId,
        enabled: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        userAgent: request.headers.get("user-agent") || "",
      },
      { merge: true }
    );

    await batch.commit();

    return NextResponse.json({
      ok: true,
      message: "Push token saved and hourly companion notifications enabled.",
    });
  } catch (error) {
    console.error("Save push token error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown save push token error.";

    const status =
      message.includes("authentication token") ||
      message.includes("Firebase ID token")
        ? 401
        : message.includes("Authenticated user was not found")
        ? 404
        : 500;

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status }
    );
  }
}
