// app/api/good-morning/preferences/route.ts

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { normalizePlan } from "@/lib/plans";

type GoodMorningPreferenceRequestBody = {
  userId?: string;
  enabled?: boolean;
  timezone?: string;
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

function getSafeTimezone(timezone?: string) {
  const cleanTimezone = timezone?.trim();

  if (!cleanTimezone) {
    return "Europe/London";
  }

  try {
    new Intl.DateTimeFormat("en-GB", {
      timeZone: cleanTimezone,
    }).format(new Date());

    return cleanTimezone;
  } catch {
    return "Europe/London";
  }
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
    const body = (await request.json()) as GoodMorningPreferenceRequestBody;

    const verifiedUserId = await getVerifiedUserId(request);
    const enabled = body.enabled === true;
    const characterId = getSafeCharacterId(body.characterId);
    const timezone = getSafeTimezone(body.timezone);

    const adminDb = getAdminDb();
    const userRef = adminDb.collection("users").doc(verifiedUserId);
    const userSnapshot = await userRef.get();

    if (!userSnapshot.exists) {
      return NextResponse.json(
        { ok: false, error: "Authenticated user was not found." },
        { status: 404 }
      );
    }

    const userData = userSnapshot.data() || {};
    const plan = normalizePlan(userData.plan);

    if (enabled && plan === "free") {
      return NextResponse.json(
        {
          ok: false,
          error: "Good morning messages require Pro or Unlimited.",
        },
        { status: 403 }
      );
    }

    await userRef.set(
      {
        goodMorningMessagesEnabled: enabled,
        goodMorningMessageTime: "08:30",
        goodMorningTimezone: timezone,
        goodMorningCharacterId: characterId,
        goodMorningPreferenceUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      enabled,
      goodMorningMessageTime: "08:30",
      goodMorningTimezone: timezone,
      goodMorningCharacterId: characterId,
    });
  } catch (error) {
    console.error("Good morning preference error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown good morning preference error.";

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
