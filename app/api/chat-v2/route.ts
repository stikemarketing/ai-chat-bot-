import { NextRequest, NextResponse } from "next/server";
import { getActivityPromptLine, type ActivityState } from "@/lib/activityState";
import { generateChatV2 } from "@/lib/chatV2/engine";
import type { ChatV2CharacterId, ChatV2Message } from "@/lib/chatV2/types";
import { normalizeStoredConversationMode } from "@/lib/conversationMode";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { normalizePlan } from "@/lib/plans";
import {
  buildRelationshipMemoryPromptLine,
  extractRelationshipMemoryFromUserMessage,
  normalizeRelationshipMemory,
} from "@/lib/relationshipMemory";
import {
  enforceServerMessageLimit,
  FREE_DAILY_MESSAGE_LIMIT,
} from "@/lib/serverMessageLimits";
import { isAgeAssuranceEnforced } from "@/lib/ageAssurance";
import {
  classifyContentSafety,
  getInCharacterSafetyReply,
  isAdultSexualRequest,
} from "@/lib/contentSafety";
import {
  deleteProhibitedUserMessage,
  getActiveSpicySafetyRestriction,
  recordProhibitedSafetyEvent,
} from "@/lib/serverContentSafety";

export const runtime = "nodejs";

const DEVELOPMENT_QWEN3_URL =
  "https://digitalstrikemarketing--ai-companion-vllm-qwen3-test-serve.modal.run";

function getQwen3BaseUrl() {
  return (
    process.env.VLLM_QWEN3_BASE_URL?.trim() ||
    (process.env.NODE_ENV === "development" ? DEVELOPMENT_QWEN3_URL : "")
  );
}

type ChatV2Body = {
  message?: string;
  characterId?: string;
  userMessageId?: string;
  recentMessages?: ChatV2Message[];
  activityState?: ActivityState;
};

type UserData = {
  name?: string;
  email?: string;
  plan?: string;
  selectedCharacter?: string;
  timezone?: string;
  adultVerified?: boolean;
};

function getBearerToken(request: NextRequest) {
  const [scheme, token] = (request.headers.get("authorization") || "").split(" ");
  return scheme === "Bearer" ? token?.trim() || "" : "";
}

function getSupportedCharacterId(value: unknown): ChatV2CharacterId | null {
  const characterId = typeof value === "string" ? value.trim().toLowerCase() : "";
  return characterId === "luna" || characterId === "ivy" || characterId === "sienna"
    ? characterId
    : null;
}

function getCharacterName(characterId: ChatV2CharacterId) {
  return characterId === "ivy" ? "Ivy" : characterId === "sienna" ? "Sienna" : "Luna";
}

function getCurrentDateForTimezone(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // Fall back to UTC below.
  }

  return new Date().toISOString().slice(0, 10);
}

function getSafeRecentMessages(value: unknown): ChatV2Message[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (message): message is ChatV2Message =>
        Boolean(message) &&
        typeof message === "object" &&
        ((message as ChatV2Message).role === "user" ||
          (message as ChatV2Message).role === "assistant") &&
        typeof (message as ChatV2Message).text === "string"
    )
    .map((message) => ({ role: message.role, text: message.text }))
    .slice(-12);
}

export async function POST(request: NextRequest) {
  const baseUrl = getQwen3BaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { error: "The Qwen3 chat server is not configured." },
      { status: 503 }
    );
  }

  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const db = getAdminDb();
    const userSnapshot = await db.collection("users").doc(decodedToken.uid).get();
    if (!userSnapshot.exists) {
      return NextResponse.json({ error: "User account was not found." }, { status: 404 });
    }

    const user = userSnapshot.data() as UserData;
    if (isAgeAssuranceEnforced() && user.adultVerified !== true) {
      return NextResponse.json(
        { error: "Age Verification Is Required Before Entering Chat.", ageVerificationRequired: true },
        { status: 403 }
      );
    }
    const plan = normalizePlan(user.plan);
    const body = (await request.json()) as ChatV2Body;
    const message = body.message?.trim() || "";
    const characterId = getSupportedCharacterId(body.characterId);
    if (!message) {
      return NextResponse.json({ error: "A message is required." }, { status: 400 });
    }
    if (!characterId) {
      return NextResponse.json(
        { error: "Qwen3 is enabled only for supported companions." },
        { status: 400 }
      );
    }
    if (user.selectedCharacter?.trim().toLowerCase() !== characterId) {
      return NextResponse.json(
        { error: "This account is locked to a different companion." },
        { status: 403 }
      );
    }

    const userMessageId = body.userMessageId?.trim() || "";
    if (!userMessageId) {
      return NextResponse.json(
        { error: "A saved user message is required." },
        { status: 400 }
      );
    }

    const limitResult = await enforceServerMessageLimit({
      userId: decodedToken.uid,
      characterId,
      messageId: userMessageId,
      expectedText: message,
      deleteRejectedMessage: true,
    });
    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          ...limitResult,
          error: `Your Free daily allowance of ${FREE_DAILY_MESSAGE_LIMIT} messages has been reached. It resets at midnight in your account timezone.`,
        },
        { status: 429 }
      );
    }

    const characterRef = db
      .collection("conversations")
      .doc(decodedToken.uid)
      .collection("characters")
      .doc(characterId);
    const characterSnapshot = await characterRef.get();
    const characterData = characterSnapshot.data() || {};
    let priorUserTurnCount =
      typeof characterData.chatV2UserTurnCount === "number"
        ? Math.max(0, Math.floor(characterData.chatV2UserTurnCount))
        : null;

    if (priorUserTurnCount === null) {
      const existingUserMessages = await characterRef
        .collection("messages")
        .where("role", "==", "user")
        .count()
        .get();
      priorUserTurnCount = existingUserMessages.data().count;
    }

    const nextUserTurnCount = priorUserTurnCount + 1;
    const relationshipStage =
      nextUserTurnCount <= 12
        ? ("new" as const)
        : nextUserTurnCount <= 30
          ? ("developing" as const)
          : ("established" as const);
    const storedMode = normalizeStoredConversationMode(characterData.conversationMode);
    const recentMessages = getSafeRecentMessages(body.recentMessages);
    const activeSafetyRestriction = getActiveSpicySafetyRestriction(user);
    const inputSafety = classifyContentSafety(message, {
      surface: "chat_input",
      spicyContext: storedMode.mode === "spicy",
    });

    if (!inputSafety.allowed) {
      await deleteProhibitedUserMessage({
        userId: decodedToken.uid,
        characterId,
        messageId: userMessageId,
        expectedText: message,
      });
      const safetyEvent = await recordProhibitedSafetyEvent({
        userId: decodedToken.uid,
        category: inputSafety.category,
      });
      return NextResponse.json({
        reply: getInCharacterSafetyReply({
          characterId,
          category: inputSafety.category,
        }),
        plan,
        mode: "normal",
        safetyBlocked: true,
        safetyCategory: inputSafety.category,
        showSafetyTerms: safetyEvent.restricted,
        spicyLockedUntil: safetyEvent.lockedUntil?.toISOString() || null,
      });
    }

    if (activeSafetyRestriction && isAdultSexualRequest(message)) {
      return NextResponse.json({
        reply: getInCharacterSafetyReply({
          characterId,
          restrictionActive: true,
        }),
        plan,
        mode: "normal",
        safetyBlocked: true,
        safetyRestrictionActive: true,
        showSafetyTerms: false,
        spicyLockedUntil: activeSafetyRestriction.toISOString(),
      });
    }

    const timezone = user.timezone?.trim() || "UTC";
    const existingMemory = normalizeRelationshipMemory(characterData.relationshipMemory);
    const relationshipMemory = extractRelationshipMemoryFromUserMessage({
      existingMemory,
      userMessage: message,
      currentDate: getCurrentDateForTimezone(timezone),
      recentMessages,
    });
    const currentMode = storedMode.mode;
    const lastSpicyActivityAt = storedMode.lastSpicyActivityAt
      ? Date.parse(storedMode.lastSpicyActivityAt)
      : null;
    const contextLines = [buildRelationshipMemoryPromptLine(relationshipMemory)];

    if (body.activityState) {
      contextLines.push(getActivityPromptLine(body.activityState));
    }

    const result = await generateChatV2(
      {
        characterId,
        plan,
        userName: user.name || user.email || "handsome",
        message,
        recentMessages,
        currentMode,
        lastSpicyActivityAt,
        contextLines,
        relationshipStage,
      },
      baseUrl
    );

    const outputSafety = classifyContentSafety(result.reply, {
      surface: "chat_output",
      spicyContext: result.mode === "spicy",
    });
    if (!outputSafety.allowed) {
      console.error("Chat v2 produced prohibited content:", {
        category: outputSafety.category,
        characterId,
      });
      return NextResponse.json({
        reply: getInCharacterSafetyReply({
          characterId,
          category: outputSafety.category,
        }),
        plan,
        mode: "normal",
        safetyBlocked: true,
        showSafetyTerms: false,
      });
    }

    const now = new Date().toISOString();
    await characterRef.set(
      {
        userId: decodedToken.uid,
        characterId,
        characterName: getCharacterName(characterId),
        relationshipMemory: { ...relationshipMemory, updatedAt: now },
        chatV2UserTurnCount: nextUserTurnCount,
        conversationMode: {
          mode: result.mode,
          lastSpicyActivityAt: result.mode === "spicy" ? now : null,
        },
        updatedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json({ ...result, plan });
  } catch (error) {
    console.error("Chat v2 failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat v2 failed." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const baseUrl = getQwen3BaseUrl();
  if (!baseUrl) {
    return NextResponse.json({ error: "Qwen3 is not configured." }, { status: 503 });
  }

  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const userSnapshot = await getAdminDb()
      .collection("users")
      .doc(decodedToken.uid)
      .get();
    const selectedCharacter = getSupportedCharacterId(
      userSnapshot.data()?.selectedCharacter
    );
    if (
      isAgeAssuranceEnforced() &&
      userSnapshot.data()?.adultVerified !== true
    ) {
      return NextResponse.json(
        { error: "Age Verification Is Required Before Entering Chat.", ageVerificationRequired: true },
        { status: 403 }
      );
    }
    if (!userSnapshot.exists || !selectedCharacter) {
      return NextResponse.json({ error: "Luna chat is unavailable." }, { status: 403 });
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/models`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Qwen3 is still starting." }, { status: 503 });
    }

    return NextResponse.json({ ready: true });
  } catch (error) {
    console.error("Qwen3 warm-up failed:", error);
    return NextResponse.json({ error: "Qwen3 is still starting." }, { status: 503 });
  }
}
