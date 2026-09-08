import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";
import {
  enforceServerMessageLimit,
  FREE_DAILY_MESSAGE_LIMIT,
} from "@/lib/serverMessageLimits";

type LimitRequestBody = {
  characterId?: string;
  messageId?: string;
  message?: string;
};

function getBearerToken(request: NextRequest) {
  const authorizationHeader = request.headers.get("authorization") || "";
  const [scheme, token] = authorizationHeader.split(" ");

  return scheme === "Bearer" ? token?.trim() || "" : "";
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        { error: "Missing Firebase authentication token." },
        { status: 401 }
      );
    }

    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const body = (await request.json()) as LimitRequestBody;
    const characterId = body.characterId?.trim().toLowerCase() || "";
    const messageId = body.messageId?.trim() || "";
    const message = body.message?.trim() || "";

    if (
      !["luna", "ivy", "sienna"].includes(characterId) ||
      !messageId ||
      !message
    ) {
      return NextResponse.json(
        { error: "Missing valid message limit details." },
        { status: 400 }
      );
    }

    const result = await enforceServerMessageLimit({
      userId: decodedToken.uid,
      characterId,
      messageId,
      expectedText: message,
      deleteRejectedMessage: true,
    });

    if (!result.allowed) {
      return NextResponse.json(
        {
          ...result,
          error: `Your Free daily allowance of ${FREE_DAILY_MESSAGE_LIMIT} messages has been reached. It resets at midnight in your account timezone.`,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("API /api/chat/limit error:", error);

    const message =
      error instanceof Error ? error.message : "Could not verify message limit.";
    const status = message.includes("Firebase ID token") ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
