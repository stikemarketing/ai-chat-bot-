import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

type SwitchCharacterRequestBody = {
  characterId?: string;
};

const ALLOWED_CHARACTER_IDS = ["luna", "ivy", "sienna"] as const;
type AllowedCharacterId = (typeof ALLOWED_CHARACTER_IDS)[number];

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

function getSafeCharacterId(value: unknown): AllowedCharacterId | null {
  if (typeof value !== "string") {
    return null;
  }

  const characterId = value.trim().toLowerCase();

  if (
    characterId === "luna" ||
    characterId === "ivy" ||
    characterId === "sienna"
  ) {
    return characterId;
  }

  return null;
}

async function deleteCharacterConversationHistory(params: {
  userId: string;
  characterId: AllowedCharacterId;
}) {
  const db = getAdminDb();
  const conversationRef = db
    .collection("conversations")
    .doc(params.userId)
    .collection("characters")
    .doc(params.characterId);
  const messagesRef = conversationRef.collection("messages");

  while (true) {
    const snapshot = await messagesRef.limit(400).get();

    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();

    snapshot.docs.forEach((messageDoc) => {
      batch.delete(messageDoc.ref);
    });

    await batch.commit();

    if (snapshot.size < 400) {
      break;
    }
  }

  await conversationRef.delete();
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          error:
            "The development character switcher is disabled in production.",
        },
        { status: 403 }
      );
    }

    const verifiedUserId = await getVerifiedUserId(request);
    const body = (await request.json()) as SwitchCharacterRequestBody;
    const characterId = getSafeCharacterId(body.characterId);

    if (!characterId) {
      return NextResponse.json(
        { error: "Choose Luna, Ivy, or Sienna." },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const userRef = db.collection("users").doc(verifiedUserId);
    const userSnapshot = await userRef.get();

    if (!userSnapshot.exists) {
      return NextResponse.json(
        { error: "Authenticated user account was not found." },
        { status: 404 }
      );
    }

    await deleteCharacterConversationHistory({
      userId: verifiedUserId,
      characterId,
    });

    await userRef.set(
      {
        selectedCharacter: characterId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      selectedCharacter: characterId,
      conversationCleared: true,
    });
  } catch (error) {
    console.error("Failed to switch development character:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Could not switch development character.";

    const status =
      message.includes("authentication token") ||
      message.includes("Firebase ID token")
        ? 401
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}