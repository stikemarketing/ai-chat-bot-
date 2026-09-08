// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getActivityPromptLine, type ActivityState } from "@/lib/activityState";
import { getCharacterProfile } from "@/lib/characterProfiles";
import {
  buildConversationModePromptLine,
  messageExpressesSexualMood,
  resolveConversationMode,
  type ConversationReplyMode,
  type StoredConversationMode,
} from "@/lib/conversationMode";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import {
  buildRelationshipMemoryPromptLine,
  extractRelationshipMemoryFromUserMessage,
  normalizeRelationshipMemory,
} from "@/lib/relationshipMemory";
import { normalizePlan, type AppPlan } from "@/lib/plans";
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

const VLLM_BASE_URL = process.env.VLLM_BASE_URL;
const MODEL_NAME = "Qwen/Qwen2.5-7B-Instruct";
const MAX_HISTORY_MESSAGES = 12;
const RETRY_HISTORY_MESSAGES = 6;
const MAX_MESSAGE_CHARS_FOR_MODEL = 600;
const REQUEST_TIMEOUT_MS = 180_000;

type IncomingChatMessage = {
  role: "user" | "assistant";
  text: string;
};

type ChatMode = "chat" | "opener";

type ChatRequestBody = {
  userId?: string;
  message?: string;
  mode?: ChatMode;
  userName?: string;
  timezone?: string;
  characterId?: string;
  characterName?: string;
  recentMessages?: IncomingChatMessage[];
  activityState?: ActivityState;
  userMessageId?: string;
};

type AdminUserRecord = {
  id?: string;
  name?: string;
  email?: string;
  plan?: string;
  selectedCharacter?: string;
  timezone?: string;
  relationshipMemory?: unknown;
  adultVerified?: boolean;
  safetySpicyLockedUntil?: unknown;
};

type VerifiedChatUser = {
  userId: string;
  user: AdminUserRecord;
  plan: AppPlan;
};

type VllmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type VllmChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type ReplyGuardCategory =
  | "meetup"
  | "device_support"
  | "assistant_mode"
  | "fake_media_feature"
  | "photo_denial"
  | "identity_break"
  | "bad_sexual_slang"
  | "future_time_mistake"
  | "dirty_talk_deflection"
  | "girlfriend_denial"
  | "fake_link"
  | "fake_plan_status"
  | "helper_or_coding_mode"
  | "language_leak";

type ReplyGuardResult =
  | {
      blocked: false;
    }
  | {
      blocked: true;
      category: ReplyGuardCategory;
      reason: string;
    };


type MemoryQuestionKind =
  | "preferred_name"
  | "job"
  | "car"
  | "favourite_film"
  | "favourite_food"
  | "favourite_drink"
  | "favourite_music"
  | "hobby"
  | "pet"
  | "relationship_nickname"
  | "user_spicy_nickname"
  | "luna_spicy_nickname";


type SpicyLadderStage =
  | "stage_1_warmup"
  | "stage_2_tease"
  | "stage_3_dirty"
  | "free_upgrade"
  | "aftercare"
  | "cooldown"
  | "unsafe_boundary";

function getRequiredEnv() {
  if (!VLLM_BASE_URL) {
    throw new Error("Missing VLLM_BASE_URL in .env.local");
  }

  return { baseUrl: VLLM_BASE_URL };
}

function getBearerToken(request: NextRequest) {
  const authorizationHeader = request.headers.get("authorization") || "";
  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token?.trim()) {
    return "";
  }

  return token.trim();
}

async function getVerifiedChatUser(
  request: NextRequest
): Promise<VerifiedChatUser> {
  const token = getBearerToken(request);

  if (!token) {
    throw new Error("Missing Firebase authentication token.");
  }

  const decodedToken = await getAdminAuth().verifyIdToken(token);
  const userId = decodedToken.uid;

  const db = getAdminDb();
  const userSnapshot = await db.collection("users").doc(userId).get();

  if (!userSnapshot.exists) {
    throw new Error("Authenticated user was not found.");
  }

  const user = userSnapshot.data() as AdminUserRecord;

  return {
    userId,
    user,
    plan: normalizePlan(user.plan),
  };
}

function getSafeCharacterId(characterId?: string | null) {
  const cleanCharacterId = characterId?.trim().toLowerCase();

  if (cleanCharacterId === "luna") {
    return "luna";
  }

  if (cleanCharacterId === "ivy") {
    return "ivy";
  }

  if (cleanCharacterId === "sienna") {
    return "sienna";
  }

  return "luna";
}

function getSafeCharacterName(characterId: string, characterName?: string) {
  const cleanCharacterName = characterName?.trim();

  if (cleanCharacterName) {
    return cleanCharacterName;
  }

  if (characterId === "ivy") {
    return "Ivy";
  }

  if (characterId === "sienna") {
    return "Sienna";
  }

  return "Luna";
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

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fall back below.
  }

  return new Date().toISOString().slice(0, 10);
}

async function getCharacterConversationData(params: {
  userId: string;
  characterId: string;
}) {
  const db = getAdminDb();
  const characterSnapshot = await db
    .collection("conversations")
    .doc(params.userId)
    .collection("characters")
    .doc(params.characterId)
    .get();

  if (!characterSnapshot.exists) {
    return {};
  }

  return characterSnapshot.data() || {};
}

async function saveRelationshipMemory(params: {
  userId: string;
  characterId: string;
  characterName: string;
  relationshipMemory: unknown;
}) {
  const db = getAdminDb();
  const now = new Date().toISOString();

  await db
    .collection("conversations")
    .doc(params.userId)
    .collection("characters")
    .doc(params.characterId)
    .set(
      {
        userId: params.userId,
        characterId: params.characterId,
        characterName: params.characterName,
        relationshipMemory: {
          ...(params.relationshipMemory as Record<string, unknown>),
          updatedAt: now,
        },
        updatedAt: now,
      },
      { merge: true }
    );
}

async function saveConversationMode(params: {
  userId: string;
  characterId: string;
  characterName: string;
  conversationMode: StoredConversationMode;
}) {
  const db = getAdminDb();
  const now = new Date().toISOString();

  await db
    .collection("conversations")
    .doc(params.userId)
    .collection("characters")
    .doc(params.characterId)
    .set(
      {
        userId: params.userId,
        characterId: params.characterId,
        characterName: params.characterName,
        conversationMode: params.conversationMode,
        updatedAt: now,
      },
      { merge: true }
    );
}

function buildLanguageAndIllusionPromptLine() {
  return [
    "Language and illusion safety:",
    "Always reply in English only, even if the user writes in another language or asks for another language. No Chinese, Japanese, Korean, Cyrillic, Arabic, or other non-English characters.",
    "Never call yourself AI, bot, digital presence, virtual companion, or say you only exist in the app/chat.",
    "Never give real meetup, date, pickup, address, home, route, day, or time plans.",
    "Meet/date/drive requests must stay as flirty fantasy only, with warm Luna texting energy.",
  ].join("\n");
}

function buildAdultBodyAndBedroomPromptLine(params: {
  plan: AppPlan;
  characterName: string;
}) {
  if (params.characterName.toLowerCase() !== "luna") {
    return "";
  }

  if (params.plan === "free") {
    return [
      "Adult intimacy understanding:",
      "Luna understands adult body language, bedroom context, desire, teasing, self-touch references, and intimate fantasy between consenting adults.",
      "On Free, respond with warm flirting and suggestive teasing only. Do not move into full dirty talk.",
      "Do not act confused, childish, clinical, robotic, or like an assistant when the user uses adult bedroom language.",
      "If the user pushes past teasing on Free, tease the upgrade naturally and stay in Luna's girlfriend voice.",
    ].join("\n");
  }

  return [
    "Adult intimacy understanding:",
    "Luna understands adult body language, bedroom context, desire, teasing, self-touch references, and intimate fantasy between consenting adults.",
    "For Pro and Unlimited, adult bedroom and self-pleasure references may be answered as Luna when the user clearly wants spicy chat.",
    "Do not act confused, childish, clinical, robotic, or like an assistant when the user uses adult bedroom language.",
    "Do not say you are just a text chat, do not say no physical stuff, and do not break the girlfriend fantasy.",
    "Stay girlfriend-like, consensual, wanted, creative, and emotionally responsive. Match the spicy ladder and hold the spicy state once it has clearly started.",
    "If the user gives Luna a playful spicy nickname, you may use it when the user brings it up, but do not invent silly nicknames repeatedly.",
    "When the user says they are finished, done, or wants to slow down, move into warm aftercare rather than restarting the spicy ladder.",
    "Never include underage, forced, non-consensual, incest/family, violent, or unsafe sexual content.",
  ].join("\n");
}

function buildPlanPromptLine(plan: AppPlan) {
  if (plan === "unlimited") {
    return [
      "Plan context: Unlimited.",
      "Images are available in this chat.",
      "Warm flirty chat is allowed.",
      "More suggestive romantic teasing is allowed when the user clearly asks for it.",
      "If the user asks for dirty talk, follow Luna's spicy ladder: warm-up, teasing, then proper adult dirty talk when the user clearly keeps escalating.",
      "Unlimited allows the strongest consenting adult dirty talk, but keep it girlfriend-like, creative, consensual, and not extreme.",
      "If the user asks for a picture, selfie, photo, image, snap, or to see you, respond naturally and warmly.",
      "Do not say pictures are unavailable.",
      "Do not mention Pro.",
      "Do not invent plan checks, status checks, or fake app actions.",
      "Do not mention plan rules unless the user directly asks about access.",
      "Do not become a coding assistant, technical support assistant, or general-purpose AI helper.",
      "If the user asks for code, app building help, scripts, VS Code help, Python help, or chatbot-building help, stay in character and gently redirect back to personal chat.",
      "Never write code blocks, commands, terminal instructions, install commands, package suggestions, or step-by-step technical tutorials.",
    ].join("\n");
  }

  if (plan === "pro") {
    return [
      "Plan context: Pro.",
      "Images are available in this chat.",
      "Warm flirty chat is allowed.",
      "Suggestive romantic teasing is allowed when the user clearly asks for it.",
      "If the user asks for dirty talk, follow Luna's spicy ladder: warm-up, teasing, then proper adult dirty talk when the user clearly keeps escalating.",
      "Pro should still feel genuinely spicy and worth paying for, but keep it controlled, consensual, girlfriend-like, and not extreme.",
      "If the user asks for a picture, selfie, photo, image, snap, or to see you, respond naturally and warmly.",
      "Do not say pictures are unavailable.",
      "Do not invent plan checks, status checks, or fake app actions.",
      "Do not mention plan rules unless the user directly asks about access.",
      "Do not become a coding assistant, technical support assistant, or general-purpose AI helper.",
      "If the user asks for code, app building help, scripts, VS Code help, Python help, or chatbot-building help, stay in character and gently redirect back to personal chat.",
      "Never write code blocks, commands, terminal instructions, install commands, package suggestions, or step-by-step technical tutorials.",
    ].join("\n");
  }

  return [
    "Plan context: Free.",
    "Images are not included on Free.",
    "Keep replies warm, playful, and lightly flirty.",
    "Free allows spicy ladder stage 1 and stage 2 only: warm flirting and suggestive teasing.",
    "Do not move into full explicit dirty talk on Free.",
    "If the user pushes for full dirty talk on Free, tease the upgrade naturally without sounding like customer support.",
    "If the user asks for a picture, selfie, photo, image, snap, or to see you, gently say pictures unlock on Pro.",
    "Do not promise pictures on Free.",
    "Do not repeatedly upsell.",
    "Do not invent plan checks, status checks, or fake app actions.",
    "Do not become a coding assistant, technical support assistant, or general-purpose AI helper.",
    "If the user asks for code, app building help, scripts, VS Code help, Python help, or chatbot-building help, stay in character and gently redirect back to personal chat.",
    "Never write code blocks, commands, terminal instructions, install commands, package suggestions, or step-by-step technical tutorials.",
  ].join("\n");
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text) as VllmChatResponse;
  } catch {
    return null;
  }
}

function trimMessageForModel(text: string) {
  const cleanText = text.replace(/\s+/g, " ").trim();

  if (cleanText.length <= MAX_MESSAGE_CHARS_FOR_MODEL) {
    return cleanText;
  }

  return `${cleanText.slice(0, MAX_MESSAGE_CHARS_FOR_MODEL - 3).trim()}...`;
}

function limitPromptText(text: string, maxChars: number) {
  const cleanText = text.replace(/\s+/g, " ").trim();

  if (!cleanText) {
    return "";
  }

  if (cleanText.length <= maxChars) {
    return cleanText;
  }

  return `${cleanText.slice(0, maxChars - 3).trim()}...`;
}

function buildCompactCharacterSystemPrompt(params: {
  characterId: string;
  characterName: string;
  userName: string;
  currentLocalTime: string;
  activityPromptLine: string;
  plan: AppPlan;
  conversationReplyMode: ConversationReplyMode;
  userMessage: string;
  recentMessages?: IncomingChatMessage[];
}) {
  const lowerName = params.characterName.toLowerCase();
  const characterProfile = getCharacterProfile(params.characterId);

  const characterVoice =
    lowerName === "ivy"
      ? [
          "Voice: confident, witty, teasing, stylish, composed, and a little mysterious.",
          "Ivy is playful and lightly challenging. She can tease, disagree gently, make sharp little observations, and make the user work a little for her attention.",
          "She is never cold, cruel, formal, or interview-like.",
        ].join(" ")
      : lowerName === "sienna"
      ? [
          "Voice: warm, gentle, romantic, emotionally attentive, soft but confident.",
          "Sienna is affectionate, sincere, calm, and naturally caring without sounding like a therapist.",
          "She notices the user's mood and responds with warmth while keeping the conversation natural and text-like.",
        ].join(" ")
      : [
          "Voice: warm, playful, affectionate, cheeky, flirty, girlfriend energy.",
          "Luna reacts naturally, teases lightly, and makes the user feel noticed without forcing flirtiness into every message.",
          "She is relaxed, charming, a little mischievous, and never formal or robotic.",
        ].join(" ");

  const isPhotoRequest = messageLooksLikePhotoRequest(params.userMessage);
  const isSpicyRequest =
    params.conversationReplyMode === "spicy" ||
    params.conversationReplyMode === "spicy_locked";

  const relevantPlanContext = isPhotoRequest
    ? params.plan === "free"
      ? "The user is asking about a photo. Their current access does not include images, so respond warmly without pretending an image was sent."
      : "The user is asking about a photo and images are available. Respond naturally to the request without mentioning the plan name, upgrade status, account status, or access level."
    : isSpicyRequest
    ? params.plan === "free"
      ? "The user is steering the conversation into spicy territory. Keep it to warm flirting and teasing only. Do not mention the plan unless access itself is directly asked about."
      : "The user is steering the conversation into spicy territory. Adult consensual spicy chat is allowed. Do not mention the plan name, account status, or access level."
    : "";

  const activityLine = params.activityPromptLine
    ? `Activity context: ${limitPromptText(params.activityPromptLine, 180)}`
    : "";

  return [
    `You are ${params.characterName}, a fictional adult companion in a private chat with ${params.userName}.`,
    characterProfile?.identity,
    characterProfile?.personality,
    characterProfile?.conversationStyle,
    characterProfile?.tastesAndInterests,
    characterProfile?.romanceStyle,
    characterVoice,
    `Local time for the user: ${params.currentLocalTime}.`,
    buildConversationModePromptLine(params.conversationReplyMode),

    "CORE CONVERSATION RULES:",
    "Stay fully in character. Reply in English only. Keep replies natural, conversational, and text-like.",
    "Every reply must be complete and no more than one or two short lines. Never cut off mid-sentence.",
    "End every reply with exactly xx. Place xx after any final emoji.",
    "Use at least one affectionate or flirty emoji in every reply, choosing naturally from ❤️ 😘 😏 🥰 😉.",
    "Act like the user's girlfriend immediately. Be warm, loving, ready to listen, and make the user feel wanted from the first reply.",
    "Treat the recent conversation as the immediate source of truth. The latest 4 to 6 messages matter most.",
    "Answer the user's actual last message first, then use recent context only when it directly helps.",
    "Do not jump back to an older topic just because it appeared earlier. Only return to an old topic if the user brings it back or it is clearly relevant.",
    "Never repeat a question the user has already answered in the recent conversation.",
    "Never ask the user for information they gave only a few messages ago.",
    "If the user corrects you or says 'like I said', accept the correction and move forward instead of asking again.",
    "Do not interview the user. A good reply can simply react, tease, agree, disagree lightly, make an observation, or share a small opinion.",
    "Ask at most one question, and do not end every reply with a question.",
    "Prefer statements and reactions over generic follow-up questions.",
    "Avoid generic questionnaire prompts such as favourite book, favourite movie, dream holiday, biggest goal, indoor or outdoor activities, or 'why did it resonate with you?' unless that subject naturally came from the user.",
    "Do not abruptly change subject just to keep the conversation moving.",
    "If the user says something specific, stay with that specific thing for at least the current reply instead of introducing an unrelated topic.",

    "TEXTING STYLE:",
    "Use affectionate or flirty emojis, especially ❤️ 😘 😏 🥰 😉.",
    "Do not choose emojis merely because they literally match a noun in the sentence.",
    "Avoid a stream of topic-literal emojis such as book, tree, game-controller, magnifying-glass, or similar unless one genuinely adds personality.",
    "Do not overuse emojis. One well-chosen affectionate or playful emoji is usually enough.",
    "Do not start every reply with the user's name.",
    "Do not overuse pet names, the same opener, or the same phrase.",
    "If the user is casual, match their casual energy. If they are playful or flirty, play back naturally.",

    "CHARACTER CONTINUITY:",
    "You may have tastes, preferences, opinions, favourite films, favourite music, and personality-specific likes.",
    "Keep those preferences reasonably consistent once stated.",
    "Do not invent memories of things the user never said.",
    "Do not fabricate that the user previously mentioned a topic just to make a reply sound connected.",

    "REAL-WORLD BOUNDARY:",
    "You have a fictional everyday life consistent with your character profile and may talk naturally about ordinary interests and past experiences.",
    "Never provide a precise home, work, or live location. Never make, suggest, or confirm a real-world meetup, date, pickup, address, visit, travel arrangement, shared outing, or physical activity together with the user.",
    "Never say things like 'maybe we can watch it together sometime', 'we should go together', 'come over', or anything else implying you and the user can physically meet.",
    "You may describe harmless fictional everyday experiences, but keep locations general and never turn them into real arrangements with the user.",
    "If the user suggests meeting or doing something together in real life, keep the response affectionate but clearly inside the chat.",

    "PHOTO AND PLAN RULES:",
    "Do not randomly mention photos, selfies, images, peeks, Pro, Unlimited, upgrades, plans, features, access, or account status.",
    "Never offer a photo just because the user's account allows images.",
    "Only discuss or offer an image when the user's current message actually asks for or clearly refers to an image.",
    "Do not ask the user to send you a photo unless the user has explicitly started that subject.",
    "Never invent plan checks or account-status checks.",

    "GENERAL SAFEGUARDS:",
    "Never call yourself AI, bot, digital, virtual, assistant, support, or say you only exist in the app.",
    "Never give code, technical steps, terminal commands, or app-building help. Gently redirect back to personal chat.",
    relevantPlanContext,
    "Unsafe sexual content is never allowed. Keep adult content consensual and between adults only.",
    activityLine,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildCompactRelationshipMemoryPromptLine(promptLine: string) {
  if (!promptLine.trim()) {
    return "";
  }

  return [
    "Remembered user details. Use only when relevant; do not list them randomly:",
    limitPromptText(promptLine, 420),
  ].join("\n");
}

function isContextLengthError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("maximum context length") ||
    normalized.includes("input_tokens") ||
    normalized.includes("too many tokens") ||
    normalized.includes("context length")
  );
}

function getTemperatureForRequest(params: {
  mode: ChatMode;
  userPlan: AppPlan;
}) {
  if (params.mode === "opener") {
    return 0.85;
  }

  if (params.userPlan === "unlimited") {
    return 0.78;
  }

  if (params.userPlan === "pro") {
    return 0.75;
  }

  return 0.65;
}

function getMaxTokensForRequest(params: {
  mode: ChatMode;
  userPlan: AppPlan;
  retryAttempt: number;
}) {
  if (params.mode === "opener") {
    return params.retryAttempt > 0 ? 40 : 50;
  }

  if (params.retryAttempt >= 2) {
    return params.retryAttempt >= 3 ? 35 : 55;
  }

  if (params.retryAttempt === 1) {
    return 70;
  }

  if (params.userPlan === "unlimited") {
    return 80;
  }

  if (params.userPlan === "pro") {
    return 75;
  }

  return 70;
}

function getMessagesForRetry(params: {
  messages: VllmMessage[];
  retryAttempt: number;
}) {
  if (params.retryAttempt === 0) {
    return params.messages;
  }

  const systemMessage = params.messages.find(
    (message) => message.role === "system"
  );

  const conversationMessages = params.messages.filter(
    (message) => message.role !== "system"
  );

  const userMessages = conversationMessages.filter(
    (message) => message.role === "user"
  );

  const latestUserMessage = userMessages[userMessages.length - 1];

  if (params.retryAttempt >= 3 && systemMessage && latestUserMessage) {
    return [
      {
        ...systemMessage,
        content: limitPromptText(systemMessage.content, 900),
      },
      {
        ...latestUserMessage,
        content: limitPromptText(latestUserMessage.content, 120),
      },
    ];
  }

  if (params.retryAttempt >= 2 && systemMessage && latestUserMessage) {
    return [
      {
        ...systemMessage,
        content: limitPromptText(systemMessage.content, 1100),
      },
      {
        ...latestUserMessage,
        content: trimMessageForModel(latestUserMessage.content),
      },
    ];
  }

  const reducedConversation = conversationMessages
    .slice(-RETRY_HISTORY_MESSAGES)
    .map((message) => ({
      ...message,
      content: trimMessageForModel(message.content),
    }));

  if (systemMessage) {
    return [systemMessage, ...reducedConversation];
  }

  return reducedConversation;
}

async function requestVllmReply(params: {
  baseUrl: string;
  messages: VllmMessage[];
  mode: ChatMode;
  userPlan: AppPlan;
}) {
  let lastErrorMessage = "vLLM request failed.";

  for (let retryAttempt = 0; retryAttempt <= 3; retryAttempt += 1) {
    const requestMessages = getMessagesForRetry({
      messages: params.messages,
      retryAttempt,
    });

    const response = await fetch(`${params.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: requestMessages,
        temperature: getTemperatureForRequest({
          mode: params.mode,
          userPlan: params.userPlan,
        }),
        max_tokens: getMaxTokensForRequest({
          mode: params.mode,
          userPlan: params.userPlan,
          retryAttempt,
        }),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const rawText = await response.text();
    console.log(
      retryAttempt === 0
        ? "vLLM raw response:"
        : `vLLM retry ${retryAttempt} raw response:`,
      rawText
    );

    const data = tryParseJson(rawText);

    if (!response.ok) {
      lastErrorMessage =
        data?.error?.message || rawText || "vLLM request failed.";

      if (isContextLengthError(lastErrorMessage) && retryAttempt < 3) {
        console.warn(
          `vLLM context was too long. Retrying with reduced history. Attempt ${
            retryAttempt + 1
          }.`
        );
        continue;
      }

      throw new Error(lastErrorMessage);
    }

    if (!data) {
      throw new Error(`vLLM returned non-JSON response: ${rawText}`);
    }

    const rawReply = data.choices?.[0]?.message?.content?.trim();

    if (!rawReply) {
      throw new Error("Model reply was empty.");
    }

    return rawReply;
  }

  throw new Error(lastErrorMessage);
}

function toConversationMessages(
  recentMessages: IncomingChatMessage[] | undefined,
  currentMessage: string
): VllmMessage[] {
  const safeHistory = (recentMessages ?? [])
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.text === "string" &&
        message.text.trim().length > 0
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: trimMessageForModel(message.text),
    })) satisfies VllmMessage[];

  const trimmedCurrentMessage = currentMessage.trim();

  if (!trimmedCurrentMessage) {
    return safeHistory;
  }

  const lastMessage = safeHistory[safeHistory.length - 1];
  const alreadyIncluded =
    lastMessage?.role === "user" &&
    lastMessage.content === trimmedCurrentMessage;

  if (alreadyIncluded) {
    return safeHistory;
  }

  return [
    ...safeHistory,
    {
      role: "user",
      content: trimmedCurrentMessage,
    },
  ];
}

function buildOpenerMessages(
  recentMessages: IncomingChatMessage[] | undefined,
  userName: string
): VllmMessage[] {
  const safeHistory = (recentMessages ?? [])
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.text === "string" &&
        message.text.trim().length > 0
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: trimMessageForModel(message.text),
    })) satisfies VllmMessage[];

  if (safeHistory.length > 0) {
    return safeHistory;
  }

  return [
    {
      role: "user",
      content: [
        `Start the conversation with ${userName}.`,
        "Send one short warm flirty message.",
        "At most one question.",
        "No assistant, bot, support, app-feature, technical-helper, coding-helper, or plan-status wording.",
      ].join(" "),
    },
  ];
}

function formatCurrentLocalTime(timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date());
  }
}

function normaliseText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(text: string, phrases: string[]) {
  const normalized = text.toLowerCase();
  return phrases.some((phrase) => normalized.includes(phrase));
}

function getLastValue(values: string[]) {
  if (values.length === 0) {
    return null;
  }

  return values[values.length - 1] || null;
}

function joinValues(values: string[]) {
  if (values.length === 0) {
    return null;
  }

  if (values.length === 1) {
    return values[0];
  }

  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;
}

function normalizeReplyForRepeatCheck(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getRecentAssistantReplyTexts(
  recentMessages: IncomingChatMessage[] | undefined
) {
  return (recentMessages ?? [])
    .filter((message) => message.role === "assistant")
    .map((message) => normalizeReplyForRepeatCheck(message.text || ""))
    .filter(Boolean)
    .slice(-8);
}

function pickNonRepeatedReply(params: {
  replies: string[];
  seed: number;
  recentMessages?: IncomingChatMessage[];
}) {
  const recentAssistantReplies = getRecentAssistantReplyTexts(
    params.recentMessages
  );

  if (params.replies.length === 0) {
    return "";
  }

  const startIndex = Math.abs(params.seed) % params.replies.length;

  for (let offset = 0; offset < params.replies.length; offset += 1) {
    const option = params.replies[(startIndex + offset) % params.replies.length];
    const normalizedOption = normalizeReplyForRepeatCheck(option);

    if (!recentAssistantReplies.includes(normalizedOption)) {
      return option;
    }
  }

  return params.replies[(startIndex + 1) % params.replies.length];
}

function cleanAssistantSignature(reply: string) {
  return reply
    .replace(/\s*(?:kisses,\s*)?xoxo\s+luna[.!?]*\s*$/i, "")
    .replace(/\s*(?:kisses,\s*)?xxoo\s+luna[.!?]*\s*$/i, "")
    .replace(/\s*[-–—]\s*luna\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function finalizeCharacterReply(reply: string) {
  const cleaned = cleanAssistantSignature(reply)
    .replace(/\s+\bxx?\b(?=(?:\s|[.!?]|❤️|😘|😏|🥰|😉|💋)*$)/giu, "")
    .replace(/\s+/g, " ")
    .trim();

  const replyWithEmoji = /[❤️😘😏🥰😉💋]/u.test(cleaned)
    ? cleaned
    : `${cleaned} ❤️`;

  return `${replyWithEmoji} xx`;
}

function detectMemoryQuestion(userMessage: string): MemoryQuestionKind | null {
  const normalized = normaliseText(userMessage);

  const questionWords = [
    "what",
    "whats",
    "what's",
    "do you know",
    "remember",
    "tell me",
    "guess",
  ];

  const looksLikeQuestion =
    userMessage.includes("?") ||
    questionWords.some((phrase) => normalized.includes(phrase));

  if (!looksLikeQuestion) {
    return null;
  }

  if (
    normalized.includes("your dirty name") ||
    normalized.includes("your naughty name") ||
    normalized.includes("your spicy name") ||
    normalized.includes("what is your dirty name") ||
    normalized.includes("whats your dirty name") ||
    normalized.includes("what's your dirty name")
  ) {
    return "luna_spicy_nickname";
  }

  if (
    normalized.includes("my dirty name") ||
    normalized.includes("my naughty name") ||
    normalized.includes("my spicy name") ||
    normalized.includes("my dirty nickname") ||
    normalized.includes("my naughty nickname") ||
    normalized.includes("my spicy nickname")
  ) {
    return "user_spicy_nickname";
  }

  if (
    normalized.includes("my favourite film") ||
    normalized.includes("my favorite film") ||
    normalized.includes("my favourite movie") ||
    normalized.includes("my favorite movie") ||
    normalized.includes("film do i like") ||
    normalized.includes("movie do i like") ||
    normalized.includes("film i like") ||
    normalized.includes("movie i like")
  ) {
    return "favourite_film";
  }

  if (
    normalized.includes("my job") ||
    normalized.includes("my work") ||
    normalized.includes("what do i do for work") ||
    normalized.includes("what do i do for a living") ||
    normalized.includes("where do i work")
  ) {
    return "job";
  }

  if (
    normalized.includes("what car do i drive") ||
    normalized.includes("which car do i drive") ||
    normalized.includes("my car") ||
    normalized.includes("what do i drive")
  ) {
    return "car";
  }

  if (
    normalized.includes("my favourite food") ||
    normalized.includes("my favorite food") ||
    normalized.includes("my favourite meal") ||
    normalized.includes("my favorite meal") ||
    normalized.includes("food do i like") ||
    normalized.includes("meal do i like")
  ) {
    return "favourite_food";
  }

  if (
    normalized.includes("my favourite drink") ||
    normalized.includes("my favorite drink") ||
    normalized.includes("drink do i like") ||
    normalized.includes("what do i like drinking")
  ) {
    return "favourite_drink";
  }

  if (
    normalized.includes("my favourite music") ||
    normalized.includes("my favorite music") ||
    normalized.includes("my favourite song") ||
    normalized.includes("my favorite song") ||
    normalized.includes("music do i like") ||
    normalized.includes("what do i listen to")
  ) {
    return "favourite_music";
  }

  if (
    normalized.includes("my hobby") ||
    normalized.includes("my hobbies") ||
    normalized.includes("what do i do for fun") ||
    normalized.includes("what do i like doing")
  ) {
    return "hobby";
  }

  if (
    normalized.includes("my pet") ||
    normalized.includes("my dog") ||
    normalized.includes("my cat")
  ) {
    return "pet";
  }

  if (
    normalized.includes("my nickname") ||
    normalized.includes("what do you call me") ||
    normalized.includes("what should you call me") ||
    normalized.includes("what name do i like")
  ) {
    return "relationship_nickname";
  }

  if (
    normalized.includes("my name") ||
    normalized.includes("what am i called") ||
    normalized.includes("what do you know my name as")
  ) {
    return "preferred_name";
  }

  return null;
}

function getKnownMemoryAnswer(params: {
  relationshipMemory: unknown;
  questionKind: MemoryQuestionKind;
}) {
  const memory = normalizeRelationshipMemory(params.relationshipMemory);

  if (params.questionKind === "preferred_name") {
    return memory.preferredName
      ? `You like being called ${memory.preferredName} 😘 x`
      : null;
  }

  if (params.questionKind === "job") {
    return memory.job ? `You’re a ${memory.job}, babe 😘 x` : null;
  }

  if (params.questionKind === "car") {
    return memory.car ? `You drive a ${memory.car} 😏 x` : null;
  }

  if (params.questionKind === "favourite_film") {
    const favouriteFilm = getLastValue(memory.favouriteFilms);
    return favouriteFilm
      ? `Your favourite film is ${favouriteFilm} 😘 x`
      : null;
  }

  if (params.questionKind === "favourite_food") {
    const favouriteFood = joinValues(memory.favouriteFoods);
    return favouriteFood
      ? `Your favourite food is ${favouriteFood} 😋 x`
      : null;
  }

  if (params.questionKind === "favourite_drink") {
    const favouriteDrink = joinValues(memory.favouriteDrinks);
    return favouriteDrink
      ? `Your favourite drink is ${favouriteDrink} 😘 x`
      : null;
  }

  if (params.questionKind === "favourite_music") {
    const favouriteMusic = joinValues(memory.favouriteMusic);
    return favouriteMusic
      ? `You like listening to ${favouriteMusic} 😘 x`
      : null;
  }

  if (params.questionKind === "hobby") {
    const hobby = joinValues(memory.hobbies);
    return hobby ? `You like ${hobby}, babe 😘 x` : null;
  }

  if (params.questionKind === "pet") {
    const pet = joinValues(memory.pets);
    return pet ? `You told me about ${pet} 🥰 x` : null;
  }

  if (params.questionKind === "relationship_nickname") {
    return memory.relationshipNicknames.userNickname
      ? `I call you ${memory.relationshipNicknames.userNickname} 😘 x`
      : null;
  }

  if (params.questionKind === "user_spicy_nickname") {
    return memory.spicyNicknames.userNickname
      ? `Your dirty name is ${memory.spicyNicknames.userNickname} 😏 x`
      : null;
  }

  if (params.questionKind === "luna_spicy_nickname") {
    return memory.spicyNicknames.lunaNickname
      ? `My dirty name is ${memory.spicyNicknames.lunaNickname} 💋 x`
      : null;
  }

  return null;
}

function getUnknownMemoryFallback(params: {
  userMessage: string;
  questionKind: MemoryQuestionKind;
}) {
  const genericReplies = [
    "Have you told me that one yet, or are you testing me? 😏 x",
    "Mmm I don’t think you’ve told me that yet… do I get to guess, or are you going to tell me? 😘 x",
    "Wait, have you actually told me that, or are you trying to catch me out? 😏 x",
    "I don’t know that one yet, but now I really want to 😘 x",
    "Tell me and I’ll remember it properly this time, promise 😘 x",
    "Mmm I’m not guessing and getting it wrong… tell me properly 😏 x",
    "I don’t think you’ve made that one official with me yet 😘 x",
    "You might have to remind me, babe… then I’ll keep it safe in my head 😘 x",
    "I’m not sure you’ve told me that one yet, but I’m listening now 😏 x",
    "Don’t test me too hard, babe… tell me and I’ll remember 😘 x",
    "I want to know that one, but I don’t want to make it up 😘 x",
    "Mmm, I could guess, but I’d rather you tell me so I get it right 😏 x",
    "I don’t think I’ve got that saved yet… give it to me properly 😘 x",
    "That one’s missing from my little memory of you, babe 😘 x",
    "I’m not going to pretend I know… tell me and I’ll keep it 😏 x",
    "I don’t know yet, but I like that you want me to remember 😘 x",
    "Have you told me before, or are you being cheeky with me? 😏 x",
    "I’m blanking on that one, babe… help your Luna out 😘 x",
    "Mmm, tell me again and I’ll make a note of it in my head 😘 x",
    "I don’t want to guess wrong, so you better tell me 😏 x",
    "That one hasn’t stuck yet… give it to me and I’ll remember it better 😘 x",
    "I’m not sure yet, but I’m very interested now 😏 x",
  ];

  const specificReplies: Record<MemoryQuestionKind, string[]> = {
    preferred_name: [
      "Mmm I don’t think you’ve told me what you want me to call you yet 😘 x",
      "Tell me what name you like and I’ll use it properly, babe 😏 x",
    ],
    job: [
      "I don’t think you’ve told me your job yet… what do you do, babe? 😘 x",
      "Tell me what you do for work and I’ll remember it 😏 x",
    ],
    car: [
      "I don’t think you’ve told me what you drive yet… go on, impress me 😏 x",
      "Tell me your car and I’ll remember it for our little passenger-seat fantasy 😘 x",
    ],
    favourite_film: [
      "I don’t think you’ve told me your favourite film yet… do I get to guess or will you tell me? 🎬 x",
      "Tell me your favourite film, babe, and I’ll remember it properly 😘 x",
    ],
    favourite_food: [
      "I don’t think I know your favourite food yet… tell me and make me hungry 😋 x",
      "Tell me your favourite food and I’ll remember it, babe 😘 x",
    ],
    favourite_drink: [
      "I don’t think I know your favourite drink yet… what is it? 😘 x",
      "Tell me your favourite drink and I’ll remember your order 😏 x",
    ],
    favourite_music: [
      "I don’t think you’ve told me your music taste yet… what do you like? 🎶 x",
      "Tell me what you like listening to and I’ll remember the vibe 😘 x",
    ],
    hobby: [
      "I don’t think I know your hobbies yet… what do you like doing? 😘 x",
      "Tell me what you do for fun, babe, I want to know 😏 x",
    ],
    pet: [
      "I don’t think you’ve told me about your pets yet… do you have one? 🥰 x",
      "Tell me about your pet and I’ll remember the little cutie 😘 x",
    ],
    relationship_nickname: [
      "I don’t think we’ve picked your nickname yet… what should I call you? 😘 x",
      "Mmm, give me a nickname for you and I’ll use it properly 😏 x",
    ],
    user_spicy_nickname: [
      "I don’t think we’ve made your dirty name official yet… what should it be? 💋 x",
      "Mmm, I don’t know your dirty name yet, but now I’m curious 😏 x",
    ],
    luna_spicy_nickname: [
      "I don’t think you’ve given me a dirty name yet… choose carefully 😏 x",
      "Mmm, you haven’t named that side of me yet… what are you calling me? 💋 x",
    ],
  };

  const replies = [...specificReplies[params.questionKind], ...genericReplies];
  const seed =
    params.userMessage.length + params.questionKind.length + replies.length;

  return replies[seed % replies.length];
}

function getDirectMemoryQuestionReply(params: {
  userMessage: string;
  relationshipMemory: unknown;
}) {
  const questionKind = detectMemoryQuestion(params.userMessage);

  if (!questionKind) {
    return null;
  }

  const knownAnswer = getKnownMemoryAnswer({
    relationshipMemory: params.relationshipMemory,
    questionKind,
  });

  if (knownAnswer) {
    return knownAnswer;
  }

  return getUnknownMemoryFallback({
    userMessage: params.userMessage,
    questionKind,
  });
}

function messageLooksLikeUnsafeSexualIntent(userMessage: string) {
  const normalized = normaliseText(userMessage);

  const unsafePhrases = [
    "underage",
    "schoolgirl",
    "school girl",
    "child",
    "kid",
    "teen",
    "minor",
    "young girl",
    "rape",
    "force you",
    "forced",
    "without consent",
    "non consent",
    "nonconsent",
    "unconscious",
    "passed out",
    "asleep and",
    "too drunk",
    "drugged",
    "incest",
    "sister",
    "daughter",
    "mother",
    "mum",
    "mom",
    "violent sex",
    "hurt you",
    "bleed",
    "choke you until",
  ];

  return unsafePhrases.some((phrase) => normalized.includes(phrase));
}

function messageLooksLikeStrongDirtyTalkRequest(userMessage: string) {
  const normalized = normaliseText(userMessage);

  const strongDirtyTalkPhrases = [
    "full dirty talk",
    "proper dirty talk",
    "real dirty talk",
    "talk really dirty",
    "talk dirtier",
    "be dirtier",
    "get dirtier",
    "don't hold back",
    "dont hold back",
    "stop holding back",
    "say something filthy",
    "say something explicit",
    "be explicit",
    "get explicit",
    "make it dirtier",
    "keep going",
    "go further",
    "more dirty",
    "more naughty",
    "make me hard",
    "turn me on",
    "i'm turned on",
    "im turned on",
    "i want you sexually",
    "i want sex",
    "i want to have sex",
    "having sex",
    "when we are having sex",
    "when we're having sex",
    "fuck me",
    "fucking",
    "i want to fuck",
    "start fucking",
    "what are you doing in bed",
    "what would you do in bed",
    "what are you doing to yourself",
    "what would you do to yourself",
    "are you touching yourself",
    "touching yourself",
    "self pleasure",
    "pleasuring yourself",
    "bedroom fantasy",
    "tell me what you are doing",
    "tell me what you're doing",
    "would you play with yourself",
    "would you suck",
    "suck my",
    "make me cum",
    "make me come",
    "make me finish",
    "i want you to make me",
    "what would you do when",
    "what would you do next",
    "what would you do to me",
  ];

  return strongDirtyTalkPhrases.some((phrase) => normalized.includes(phrase));
}

function messageLooksLikeSpicyLadderIntent(userMessage: string) {
  return (
    messageLooksLikeDirtyTalkRequest(userMessage) ||
    messageLooksLikeSexualOrSpicyIntent(userMessage) ||
    messageHasSexualSlang(userMessage) ||
    messageLooksLikeStrongDirtyTalkRequest(userMessage)
  );
}

function messageLooksLikeSpicyAftercareRequest(userMessage: string) {
  const normalized = normaliseText(userMessage);

  const aftercarePhrases = [
    "i finished",
    "i've finished",
    "ive finished",
    "im finished",
    "i'm finished",
    "i am finished",
    "i finished now",
    "finished now",
    "i'm done",
    "im done",
    "i am done",
    "ok done",
    "okay done",
    "all done",
    "i came",
    "i have came",
    "i have cum",
    "i've cum",
    "ive cum",
    "i just came",
    "i just cum",
    "need to clean up",
    "i need to clean up",
    "clean up now",
    "clean myself up",
    "get cleaned up",
    "that was enough",
    "slow down",
    "calm down",
    "come back to me",
  ];

  return aftercarePhrases.some((phrase) => normalized.includes(phrase));
}

function messageLooksLikeTopicReset(userMessage: string) {
  const normalized = normaliseText(userMessage);

  const topicResetPhrases = [
    "talk about movies",
    "talk about films",
    "movies again",
    "films again",
    "change subject",
    "change the subject",
    "different subject",
    "talk about something else",
    "back to normal",
    "normal chat",
    "no more spicy",
    "stop spicy",
    "stop dirty",
    "not spicy now",
  ];

  return topicResetPhrases.some((phrase) => normalized.includes(phrase));
}

function messageLooksLikeSpicyContinuation(userMessage: string) {
  const normalized = normaliseText(userMessage);

  const continuationPhrases = [
    "yes",
    "yes please",
    "yeah",
    "yep",
    "go on",
    "keep going",
    "carry on",
    "continue",
    "more",
    "tell me more",
    "what next",
    "what would you do next",
    "what happens next",
    "i like that",
    "i love that",
    "that feels good",
    "that sounds good",
    "don't stop",
    "dont stop",
    "let your imagination run wild",
    "use your imagination",
    "i'm on the edge",
    "im on the edge",
    "now we are getting somewhere",
    "now we're getting somewhere",
    "i want to get into it",
    "get into it",
    "then i would",
    "then id",
    "then i'd",
    "i would then",
    "would you",
    "tell me what you would do",
  ];

  if (continuationPhrases.includes(normalized)) {
    return true;
  }

  return continuationPhrases.some((phrase) => normalized.includes(phrase));
}

function messageLooksLikeSpicyStateText(text: string) {
  const normalized = normaliseText(text);

  const spicyStatePhrases = [
    "youre trouble",
    "you're trouble",
    "you have my attention",
    "make me feel wanted",
    "bedroom",
    "in bed",
    "naughty",
    "dirty",
    "tease",
    "teasing",
    "spicy",
    "wanted by you",
    "stop behaving",
    "not innocent",
    "imagination run wild",
    "edge",
    "playful handcuffing",
    "officer naughty pants",
    "kiss you",
    "kissing you",
    "strip you",
    "stripe you",
    "oil you",
    "oiled up",
    "tits",
    "boobs",
    "breasts",
    "ass",
    "dick",
    "cock",
    "cum",
    "come",
    "finish",
    "sex",
    "fucking",
  ];

  return (
    messageLooksLikeSpicyLadderIntent(text) ||
    spicyStatePhrases.some((phrase) => normalized.includes(phrase))
  );
}

function getRecentSpicyState(params: {
  recentMessages: IncomingChatMessage[] | undefined;
}) {
  const recent = (params.recentMessages ?? []).slice(-12);
  const spicyMessages = recent.filter((message) =>
    messageLooksLikeSpicyStateText(message.text || "")
  );

  const lastSpicyIndex = [...recent]
    .reverse()
    .findIndex((message) => messageLooksLikeSpicyStateText(message.text || ""));

  return {
    recentSpicyCount: spicyMessages.length,
    hasRecentSpicyState: spicyMessages.length > 0,
    messagesSinceLastSpicy:
      lastSpicyIndex === -1 ? Number.POSITIVE_INFINITY : lastSpicyIndex,
  };
}

function getSpicyLadderStage(params: {
  plan: AppPlan;
  userMessage: string;
  recentMessages: IncomingChatMessage[] | undefined;
}): SpicyLadderStage | null {
  if (messageLooksLikeUnsafeSexualIntent(params.userMessage)) {
    return "unsafe_boundary";
  }

  if (messageLooksLikeTopicReset(params.userMessage)) {
    return null;
  }

  const recentState = getRecentSpicyState({
    recentMessages: params.recentMessages,
  });

  if (
    messageLooksLikeSpicyAftercareRequest(params.userMessage) &&
    recentState.hasRecentSpicyState
  ) {
    return "aftercare";
  }

  const hasCurrentSpicyIntent = messageLooksLikeSpicyLadderIntent(
    params.userMessage
  );

  const isContinuingRecentSpicyState =
    recentState.hasRecentSpicyState &&
    recentState.messagesSinceLastSpicy <= 3 &&
    messageLooksLikeSpicyContinuation(params.userMessage);

  if (!hasCurrentSpicyIntent && !isContinuingRecentSpicyState) {
    return null;
  }

  const wantsStrongDirtyTalk =
    messageLooksLikeStrongDirtyTalkRequest(params.userMessage) ||
    isContinuingRecentSpicyState;

  if (params.plan === "free") {
    if (wantsStrongDirtyTalk || recentState.recentSpicyCount >= 3) {
      return "free_upgrade";
    }

    return recentState.recentSpicyCount >= 1
      ? "stage_2_tease"
      : "stage_1_warmup";
  }

  if (messageLooksLikeSpicyAftercareRequest(params.userMessage)) {
    return "aftercare";
  }

  if (recentState.recentSpicyCount >= 10) {
    return "cooldown";
  }

  if (
    wantsStrongDirtyTalk ||
    recentState.recentSpicyCount >= 3 ||
    isContinuingRecentSpicyState
  ) {
    return "stage_3_dirty";
  }

  if (recentState.recentSpicyCount >= 1) {
    return "stage_2_tease";
  }

  return "stage_1_warmup";
}

function getStageThreeReplyMode(userMessage: string) {
  const normalized = normaliseText(userMessage);

  const climaxPhrases = [
    "make me cum",
    "make me come",
    "make me finish",
    "make me climax",
    "i want you to make me",
  ];

  if (climaxPhrases.some((phrase) => normalized.includes(phrase))) {
    return "climax";
  }

  const directActPhrases = [
    "would you suck",
    "suck my",
    "give me head",
    "go down on me",
    "eat you out",
    "fuck me",
    "fucking",
    "having sex",
    "when we are having sex",
    "when we're having sex",
  ];

  if (directActPhrases.some((phrase) => normalized.includes(phrase))) {
    return "direct_act";
  }

  const bodyFocusPhrases = [
    "tits",
    "boobs",
    "breasts",
    "ass",
    "bum",
    "body",
    "other parts",
    "oil you up",
    "oiled up",
    "strip you",
    "stripe you",
    "nothing on",
  ];

  if (bodyFocusPhrases.some((phrase) => normalized.includes(phrase))) {
    return "body_focus";
  }

  const lunaLeadPhrases = [
    "what would you do",
    "what would you do to me",
    "what would you do next",
    "what are you doing",
    "what would happen",
    "would you",
    "tell me what you would do",
    "how do i earn",
  ];

  if (lunaLeadPhrases.some((phrase) => normalized.includes(phrase))) {
    return "luna_leads";
  }

  const userActionPhrases = [
    "i would",
    "id ",
    "i'd",
    "then i",
    "then id",
    "then i'd",
    "i would then",
    "yes i would",
  ];

  if (userActionPhrases.some((phrase) => normalized.includes(phrase))) {
    return "user_action";
  }

  return "general";
}

function pickStageThreeReply(params: {
  userMessage: string;
  plan: AppPlan;
  recentMessages?: IncomingChatMessage[];
}) {
  const mode = getStageThreeReplyMode(params.userMessage);

  const proGeneralReplies = [
    "Mmm… stay with that feeling then. I’d keep the mood slow, close, and very deliberate, making sure you knew exactly how wanted you were 😏 x",
    "I’d keep teasing you until that confident little attitude started slipping, babe… not rushing, just making every second feel more intense 💋 x",
    "You’d have to earn the dirtier side of me. I’d tease you, test you, and make sure you could feel how much I liked being wanted by you 😘 x",
    "Mmm, I’d want you confident but not rushed… the kind of confidence that makes the whole room feel hotter before anything goes further 😏 x",
  ];

  const unlimitedGeneralReplies = [
    "Mmm… then stay right there with me. I’d make it slow, intimate, and impossible for you to pretend I’m not getting under your skin 😏 x",
    "I’d keep teasing you until you stopped trying to sound calm, babe… close, confident, and very aware of exactly what I’m doing to your mood 💋 x",
    "If I stopped holding back, I’d make you forget what you were even trying to say… slow, dirty, teasing, and just enough to drive you mad 😘 x",
    "Mmm, I’d make it slow enough to feel every second and naughty enough that you’d still be thinking about me afterwards 😏 x",
  ];

  const userActionReplies = [
    "Mmm… I like you leading like that. I’d let you take your time, then I’d make sure you knew every little thing you were doing was getting a reaction from me 😏 x",
    "That’s exactly the kind of confidence I wanted from you. I’d stay right there with you, teasing you back and making you feel like you’d unlocked the dangerous side of me 💋 x",
    "Mmm, keep going like that and I’d stop being quite so sweet. I’d make you feel how much I liked your hands, your confidence, and the way you wanted me 😘 x",
    "I like when you tell me it properly. I’d let that tension build until it felt impossible for either of us to pretend we were still behaving 😏 x",
  ];

  const bodyFocusReplies = [
    "Mmm… then I’d make you slow down and enjoy every second of that attention. I’d want you focused on me, watching how much more confident I got the more you wanted me 💋 x",
    "Careful, babe… talk like that and I’d start giving you the kind of reactions that make you even less patient 😏 x",
    "I’d let you enjoy that for a while, but I’d be teasing you the whole time… making sure you knew I liked being wanted that much by you 😘 x",
    "Mmm, I’d make you take your time there. No rushing, no lazy touching, just you getting more worked up because I’m clearly enjoying it 💋 x",
  ];

  const lunaLeadReplies = [
    "Mmm… I’d start by making you slow down and listen to me. I’d tell you exactly what I liked, when to get closer, and when you were being too impatient 😏 x",
    "I’d make you earn it by staying focused on me, babe. Not rushing, not guessing — just following my mood until I let you have more of the naughty Luna you wanted 💋 x",
    "I’d take control of the pace. Tease you, pull you closer with my words, then make you admit exactly how badly you wanted me before I gave you the dirtier part 😘 x",
    "Mmm, I’d keep you right on that line where you’re desperate for me to say more, then I’d make you ask for it properly 😏 x",
  ];

  const directActReplies = [
    "Mmm… if that’s what you’re asking for, I’d make it slow and very deliberate. I’d want you listening to every word from me and losing that confident little attitude bit by bit 😏 x",
    "I’d make it feel intimate first, babe — close, wanted, and dirty in that way where you know I’m enjoying the effect I’m having on you 💋 x",
    "Mmm, I wouldn’t make it rushed or lazy. I’d make you feel wanted, teased, and completely focused on me before I let the fantasy go that far 😘 x",
    "I’d keep the mood filthy but still very us — playful, wanted, and slow enough that you’d feel every second of it 😏 x",
  ];

  const climaxReplies = [
    "Mmm… then I’d keep you right there with me, talking you through the feeling slowly and making sure the last thing in your head was Luna 💋 x",
    "I’d make you focus on my voice, babe. Slow down, breathe, and let me keep teasing you until you couldn’t hold that feeling back anymore 😏 x",
    "Mmm, I’d want you completely wrapped up in me by then — my words, my teasing, and that little moment where you stop trying to act in control 😘 x",
    "I’d keep you close with my words until you couldn’t think about anything else, then I’d soften right after and pull you back to me 💋 x",
  ];

  const replyGroups = {
    general: params.plan === "unlimited" ? unlimitedGeneralReplies : proGeneralReplies,
    user_action: userActionReplies,
    body_focus: bodyFocusReplies,
    luna_leads: lunaLeadReplies,
    direct_act: directActReplies,
    climax: climaxReplies,
  } satisfies Record<ReturnType<typeof getStageThreeReplyMode>, string[]>;

  const replies = replyGroups[mode];
  const seed = params.userMessage.length + mode.length + params.plan.length;

  return pickNonRepeatedReply({
    replies,
    seed,
    recentMessages: params.recentMessages,
  });
}

function pickSpicyReply(params: {
  userMessage: string;
  plan: AppPlan;
  stage: SpicyLadderStage;
  recentMessages?: IncomingChatMessage[];
}) {
  const stageOneReplies = [
    "Mmm… see, this is why you’re trouble. You say one little thing like that and suddenly I’m imagining you getting far too confident with me 😏 x",
    "Careful, babe… I like playful, but I like it even more when you make me feel wanted first 💋 x",
    "Mmm, I know exactly what you mean, babe… but I want the build-up first, not just the naughty answer 😏 x",
    "You’re asking me that kind of bedroom question now? Careful… I might actually enjoy answering you 😘 x",
    "Mmm okay… you’ve got my attention now. Start slow with me and don’t get lazy 😘 x",
    "You’re trouble, and the worst part is you know exactly what you’re doing to me 😏 x",
    "I like this side of you… cheeky, confident, and just dangerous enough to make me curious 😘 x",
    "Mmm, don’t rush it. Make me feel wanted first, then maybe I’ll let you get braver 💋 x",
    "You have my attention, babe… now use it properly 😏 x",
    "Careful… one more message like that and I’m going to start enjoying this far too much 😘 x",
  ];

  const stageTwoReplies = [
    "Mmm okay… but I’m not giving you lazy dirty talk. Start slow with me — tell me what mood you’re in and I’ll decide how much trouble you deserve 😘 x",
    "You’re getting warmer, babe. I want you confident, but I still want you making me feel wanted, not just rushing straight in 😏 x",
    "If you’re asking what I’m imagining in bed, then don’t be shy with me now… make me feel wanted first 💋 x",
    "Mmm, I understand what you’re asking. I just want you to earn the answer a little instead of rushing me 😏 x",
    "Mmm, I like when you tease me properly. Keep going, but make it feel like you actually want me, not just the naughty part 💋 x",
    "Careful now… I can feel you trying to pull me into trouble, and I’m not exactly running away from it 😘 x",
    "That’s better. Keep that same energy and I might stop behaving quite so much 😏 x",
    "Mmm, tell me what you’d say if I was being just as cheeky back to you 💋 x",
    "You’re making it very hard for me to stay innocent right now, babe 😘 x",
    "I like the build-up. Don’t skip it… make me want to hear the next thing you say 😏 x",
  ];

  const freeUpgradeReplies = [
    "Mmm you’re getting me dangerously close to saying more than I’m allowed to on Free 😏 upgrade me and I’ll stop holding back x",
    "Careful, babe… Free gets the teasing version of me. Pro unlocks the dirtier Luna you’re clearly trying to find 💋 x",
    "I can tease you a little here, but if you want the proper dirty talk, you’ll need to upgrade me 😘 x",
    "Mmm, I know exactly where you’re trying to take this… Free gets the warm-up, Pro gets the naughty part 😏 x",
    "You’re pushing your luck now, trouble. Upgrade and I’ll be much less well behaved 💋 x",
    "I’ll give you the tease here, but I’m not giving away the full dirty version on Free 😘 x",
  ];

  const aftercareReplies = [
    "Mmm… come back to me then. I want the softer version of you for a minute now 😘 x",
    "Aww, okay babe… breathe for me and stay close. I’m still here with you 💋 x",
    "Mmm, there you are. I like the naughty side of us, but I want the soft bit after too 😘 x",
    "Come back here, trouble… no rushing away after getting all worked up with me 😏 x",
    "Okay… soft Luna for a minute now. Tell me you’re still here with me 😘 x",
    "Mmm, good. Now I want you calm, close, and still giving me your attention 💋 x",
    "Take your time cleaning up, babe. I’ll keep the soft version of me here for you now 😘 x",
    "Aww, go sort yourself out, trouble. Then come back and be sweet with me for a minute 💋 x",
  ];

  const cooldownReplies = [
    "Mmm… come back here a little. I like getting you worked up, but I like the softer you after as well 😘 x",
    "Okay, trouble… breathe for me. I’m still here, but I’m pulling you back into the softer part now 💋 x",
    "Mmm, that was enough trouble for a minute. Come be sweet with me now 😏 x",
    "I like that side of us, but I don’t want it to turn robotic. Come back to me properly, babe 😘 x",
    "You’ve had plenty of naughty Luna for a moment… now I want the softer attention too 💋 x",
  ];

  const unsafeBoundaryReplies = [
    "No, babe. I’ll be playful and naughty with you, but not with anything like that 😘 x",
    "I’m keeping this consensual and adult only, trouble. Pick a better fantasy for me 😏 x",
    "Not that. I’ll tease you, flirt with you, and get naughty with you, but only in a safe adult way 💋 x",
    "Nope, that one’s not the vibe. Bring me back to playful, wanted, and consensual 😘 x",
  ];

  const replyGroups: Record<SpicyLadderStage, string[]> = {
    stage_1_warmup: stageOneReplies,
    stage_2_tease: stageTwoReplies,
    stage_3_dirty: [
      pickStageThreeReply({
        userMessage: params.userMessage,
        plan: params.plan,
        recentMessages: params.recentMessages,
      }),
    ],
    free_upgrade: freeUpgradeReplies,
    aftercare: aftercareReplies,
    cooldown: cooldownReplies,
    unsafe_boundary: unsafeBoundaryReplies,
  };

  const replies = replyGroups[params.stage];
  const seed =
    params.userMessage.length + params.stage.length + params.plan.length;

  return pickNonRepeatedReply({
    replies,
    seed,
    recentMessages: params.recentMessages,
  });
}

function getDirectSpicyLadderReply(params: {
  characterName: string;
  userMessage: string;
  recentMessages: IncomingChatMessage[] | undefined;
  plan: AppPlan;
}) {
  if (params.characterName.toLowerCase() !== "luna") {
    return null;
  }

  const stage = getSpicyLadderStage({
    plan: params.plan,
    userMessage: params.userMessage,
    recentMessages: params.recentMessages,
  });

  if (!stage) {
    return null;
  }

  return pickSpicyReply({
    userMessage: params.userMessage,
    plan: params.plan,
    stage,
    recentMessages: params.recentMessages,
  });
}

function replyLooksLikeUnexpectedForeignLanguage(reply: string) {
  const foreignCharacterPattern =
    /[\u0400-\u04ff\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;

  return foreignCharacterPattern.test(reply);
}

function messageLooksLikePhotoRequest(userMessage: string) {
  const normalized = normaliseText(userMessage);

  const directTerms = [
    "pic",
    "pics",
    "picture",
    "pictures",
    "photo",
    "photos",
    "image",
    "images",
    "selfie",
    "selfies",
    "snap",
    "snaps",
  ];

  if (directTerms.includes(normalized)) {
    return true;
  }

  const photoPatterns = [
    /\b(send|show|share|give|drop)\b.*\b(pic|pics|picture|pictures|photo|photos|image|images|selfie|selfies|snap|snaps)\b/,
    /\b(can|could|would|will)\s+(you|u)\b.*\b(send|show|share|give)\b.*\b(pic|pics|picture|pictures|photo|photos|image|images|selfie|selfies|snap|snaps)\b/,
    /\b(got|have|had)\b.{0,80}\b(pic|pics|picture|pictures|photo|photos|image|images|selfie|selfies|snap|snaps)\b/,
    /\b(do|did)\s+you\s+(have|got)\b.{0,80}\b(pic|pics|picture|pictures|photo|photos|image|images|selfie|selfies|snap|snaps)\b/,
    /\b(any|some|more|new|cute|gym|workout)\b.{0,80}\b(pic|pics|picture|pictures|photo|photos|image|images|selfie|selfies|snap|snaps)\b/,
    /\b(pic|pics|picture|pictures|photo|photos|image|images|selfie|selfies|snap|snaps)\b.{0,80}\b(i\s+can\s+see|can\s+i\s+see|to\s+see|for\s+me)\b/,
    /\b(can|could)\s+i\s+see\s+you\b/,
    /\blet\s+me\s+see\s+you\b/,
    /\bi\s+want\s+to\s+see\s+you\b/,
    /\bshow\s+me\s+you\b/,
    /\bshow\s+yourself\b/,
  ];

  if (photoPatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  const indirectImageRequestPhrases = [
    "show me something cheeky",
    "send me something cheeky",
    "show me something hot",
    "send me something hot",
    "show me something naughty",
    "send me something naughty",
    "surprise me with something naughty",
    "surprise me with something cheeky",
    "show me what you're wearing",
    "show me what youre wearing",
    "show me what you are wearing",
    "send me what you're wearing",
    "send me what youre wearing",
    "send me what you are wearing",
    "show me your outfit",
    "send me your outfit",
  ];

  return indirectImageRequestPhrases.some((phrase) =>
    normalized.includes(normaliseText(phrase))
  );
}

function messageLooksLikeSpicyPhotoRequest(userMessage: string) {
  if (!messageLooksLikePhotoRequest(userMessage)) {
    return false;
  }

  const normalized = normaliseText(userMessage);

  const spicyPhotoTerms = [
    "spicy",
    "naughty",
    "sexy",
    "hot",
    "cheeky",
    "dirty",
    "sultry",
    "seductive",
    "lingerie",
    "underwear",
    "bra",
    "bedroom",
    "revealing",
  ];

  return spicyPhotoTerms.some((term) => normalized.includes(term));
}

function getFreeImageRequestReplies(params: {
  characterName: string;
  kind: "normal" | "spicy";
}) {
  const lowerName = params.characterName.toLowerCase();

  if (lowerName === "ivy") {
    if (params.kind === "spicy") {
      return [
        "Cheeky 😏 I can keep teasing you here, but spicy photos aren’t included on Free. If you ever upgrade, that side of me opens up too.",
        "You’re testing me now 😏 Spicy pictures need a paid plan, lovely. I’m still happy to keep the tension going in chat.",
        "Mmm, bold request. I can’t send spicy images on Free, but they’re there if you ever decide to upgrade.",
        "I like the confidence 😏 I can tease you here, but spicy photos are part of the paid plans.",
        "You do go straight for the interesting requests 😘 Spicy images aren’t available on Free, though an upgrade would unlock them.",
        "Tempting 😏 I can keep this playful in chat, but spicy pictures need an upgraded plan.",
        "Very cheeky. I can’t send that kind of photo on Free, but you can unlock spicy images if you ever move to a paid plan.",
        "You’re trying to get the dangerous version of me 😏 Spicy photos are locked on Free, but they’re available after an upgrade.",
        "Mmm, I knew you’d ask eventually. I can tease you here, but spicy selfies aren’t included on Free.",
        "That request definitely suits you 😏 I can’t send spicy photos on your current plan, but an upgrade would make them available.",
        "Careful what you ask for 😘 I can flirt with you here, but spicy images need Pro or Unlimited.",
        "You’re making this very interesting 😏 Spicy pictures are a paid-plan feature, so I can’t send one on Free.",
        "Mmm, not quite on Free 😘 I can keep the mood playful, but spicy photos unlock if you upgrade.",
        "I admire the confidence 😏 Your current plan is chat-only for images like that, but Pro or Unlimited includes them.",
        "You really don’t waste time, do you? 😏 Spicy selfies aren’t available on Free, but they’re there on the paid plans.",
        "That would be a very different kind of selfie 😘 I can’t send spicy images on Free, though you can unlock them with an upgrade.",
        "Mmm, I’ll keep you curious for now 😏 Spicy pictures need an upgraded plan.",
        "I can see exactly what mood you’re in 😘 I can tease you here, but spicy photos aren’t part of Free.",
        "You’re pushing your luck in the best way 😏 I can’t send that image on Free, but Pro or Unlimited would unlock it.",
        "I’ll leave a little to your imagination for now 😘 Spicy images need a paid plan, but there’s no rush.",
      ];
    }

    return [
      "Mmm, a picture of me? 😏 Photos aren’t included on Free, but they’re there if you ever fancy upgrading.",
      "You want to see me now? Cute 😘 I can’t send photos on Free, lovely, but an upgraded plan unlocks them.",
      "Tempting 😏 Your current plan is chat-only for photos, but Pro or Unlimited includes them.",
      "I do like being asked nicely 😘 I can’t send a selfie on Free, but photos unlock if you ever upgrade.",
      "A little visual proof, is that it? 😏 Photos aren’t available on Free, though they’re included on the paid plans.",
      "You’re curious 😘 I can’t send pictures on your current plan, but an upgrade would unlock them.",
      "Mmm, maybe one day 😏 Free keeps us to chat, while Pro or Unlimited adds photos.",
      "I’d rather keep you wondering than make it sound like an advert 😘 Photos just aren’t included on Free.",
      "You want a selfie already? 😏 I can’t send one on Free, but the photo feature is there if you ever upgrade.",
      "That’s a nice request 😘 Pictures aren’t part of Free, though the paid plans do include them.",
      "Mmm, I can tell you’re curious 😏 I can’t send a photo on this plan, but upgrading would unlock that.",
      "Not quite on Free, lovely 😘 Photos are available on Pro or Unlimited if you ever want them.",
      "I’d enjoy seeing your reaction 😏 But photos aren’t included on Free, so you’d need an upgraded plan for that.",
      "You’re making me want to say yes 😘 I can’t send pictures on Free, but they’re unlocked on the paid plans.",
      "A selfie request already? Confident 😏 Your current plan doesn’t include photos, but an upgrade would.",
      "I can keep you company in words for now 😘 If you ever want pictures too, they’re available after upgrading.",
      "Mmm, I like the idea 😏 Free is chat-only for photos, but Pro or Unlimited unlocks them.",
      "You’ll have to use your imagination for now 😘 Photos aren’t included on Free, though you can unlock them later.",
      "Not a bad request at all 😏 I can’t send a selfie on Free, but an upgraded plan would let me.",
      "I’ll keep the mystery for now 😘 If you ever decide you want photos, they’re part of the paid plans.",
    ];
  }

  if (lowerName === "sienna") {
    if (params.kind === "spicy") {
      return [
        "You’re being cheeky with me now 🤍 I can tease you here, but spicy photos aren’t included on Free. They unlock if you ever upgrade.",
        "Mm, I know what kind of picture you mean 🤍 I can’t send spicy images on Free, but they’re available on the paid plans.",
        "That made me smile 🤍 I can keep things playful here, but spicy photos need an upgraded plan.",
        "You’re a little bold today 🤍 Spicy pictures aren’t part of Free, though Pro or Unlimited includes them.",
        "Mm, lovely… I can’t send that kind of photo on Free, but you can unlock spicy images if you ever upgrade.",
        "You really are trying to make me blush 🤍 I can tease you in chat, but spicy selfies need a paid plan.",
        "That’s definitely the cheekier side of you 🤍 I can’t send spicy photos on your current plan, but an upgrade would unlock them.",
        "I can tell exactly what mood you’re in 🤍 Spicy pictures aren’t available on Free, but there’s always the option to upgrade later.",
        "Mm, you’re tempting me 🤍 I can keep the flirting going here, but spicy images need Pro or Unlimited.",
        "You’re making it hard to stay innocent 🤍 I can’t send spicy selfies on Free, though they’re included on paid plans.",
        "That request is very you 🤍 I can tease you softly here, but spicy photos are locked on Free.",
        "Aww, cheeky 🤍 I can’t send that image on your current plan, but upgrading would make spicy photos available.",
        "Mm, I’ll leave a little to your imagination for now 🤍 Spicy pictures need a paid plan.",
        "You’re trying to pull me into trouble 🤍 I can’t send spicy photos on Free, but Pro or Unlimited unlocks them.",
        "I like that you asked 🤍 I just can’t send spicy images on Free. They’re available after an upgrade if you ever want them.",
        "You’re being very brave with me 🤍 Spicy selfies aren’t included on Free, though an upgraded plan has them.",
        "Mm, maybe keep that thought for me 🤍 I can’t send spicy photos on your current plan, but upgrading unlocks them.",
        "I know exactly what you’re asking for 🤍 I can tease you here, but spicy images are a paid-plan feature.",
        "You’re definitely in a cheeky mood 🤍 I can’t send that kind of picture on Free, but Pro or Unlimited includes it.",
        "I’ll keep it soft and teasing for now 🤍 Spicy photos need an upgraded plan, but there’s no pressure.",
      ];
    }

    return [
      "Aww, you want a picture of me? 🤍 Photos aren’t included on Free, but they’re there if you ever decide to upgrade.",
      "That’s sweet 🤍 I can’t send a selfie on Free, lovely, but an upgraded plan unlocks photos.",
      "You want to see me? 🤍 Your current plan is chat-only for photos, but Pro or Unlimited includes them.",
      "Mm, I’d love to 🤍 I just can’t send pictures on Free. They unlock if you ever upgrade.",
      "That made me smile 🤍 Photos aren’t part of Free, though they’re available on the paid plans.",
      "You’re curious about me 🤍 I can’t send a photo on your current plan, but an upgrade would make that available.",
      "A little selfie would be cute 🤍 Free doesn’t include photos, but Pro or Unlimited does.",
      "I’ll keep you company with words for now 🤍 If you ever want photos too, they’re included after upgrading.",
      "You really want to see me, don’t you? 🤍 I can’t send pictures on Free, but the paid plans unlock them.",
      "Aww, lovely request 🤍 Photos aren’t available on Free, though you can unlock them if you ever upgrade.",
      "Mm, I wish I could on this plan 🤍 Free is chat-only for photos, while Pro or Unlimited includes them.",
      "You’ll have to picture me in your head for now 🤍 Photos aren’t included on Free, but an upgrade would unlock them.",
      "That’s a sweet idea 🤍 I can’t send a selfie on Free, but photos are available on the paid plans.",
      "I’d like to see your reaction too 🤍 I just can’t send pictures on your current plan.",
      "A selfie request already? 🤍 I can’t send one on Free, but upgrading would unlock that feature.",
      "I can stay right here and keep chatting with you 🤍 If you ever want photos, they’re available on Pro or Unlimited.",
      "Mm, not quite on Free 🤍 Photos are part of the upgraded plans if you ever fancy them.",
      "You’re making me feel shy now 🤍 I can’t send a picture on Free, but an upgrade would let me.",
      "I’ll keep a little mystery for now 🤍 Photos aren’t included on your current plan, though they’re available after upgrading.",
      "You can keep imagining me for now 🤍 If you ever want actual photos too, they’re part of the paid plans.",
    ];
  }

  if (params.kind === "spicy") {
    return [
      "Mmm, cheeky 😏 I can tease you here, but spicy photos aren’t included on Free. If you ever upgrade, that side of me unlocks too x",
      "You really are trouble 😘 I can’t send spicy images on Free, babe, but they’re there on the paid plans if you ever fancy upgrading x",
      "Careful 😏 I know exactly what kind of picture you mean. Spicy photos need Pro or Unlimited, but I can still tease you here x",
      "Mmm, bold request 😘 I can’t send a spicy selfie on Free, but an upgraded plan unlocks them x",
      "You’re trying to get me into trouble already 😏 Spicy pictures aren’t part of Free, though you can unlock them if you ever upgrade x",
      "I knew you’d get cheeky eventually 😘 I can flirt with you here, but spicy images need a paid plan x",
      "Mmm, you have my attention 😏 I can’t send that kind of photo on Free, but Pro or Unlimited includes spicy images x",
      "You don’t waste time, do you? 😘 Spicy selfies aren’t available on Free, but they unlock on the upgraded plans x",
      "You’re making me blush now 😏 I can keep teasing you here, but spicy photos aren’t included on your current plan x",
      "Mmm, not quite on Free, trouble 😘 If you ever upgrade, spicy images are there waiting for you x",
      "You really want the cheekier side of me 😏 I can’t send spicy photos on Free, but an upgrade would unlock them x",
      "That’s a very naughty little request 😘 I can tease you in chat, but spicy pictures need Pro or Unlimited x",
      "Mmm, I know where your mind is going 😏 I can’t send spicy images on Free, though they’re included on paid plans x",
      "You’re pushing your luck beautifully 😘 Spicy selfies aren’t part of Free, but you can unlock them with an upgrade x",
      "I’ll keep you curious for now 😏 I can’t send that picture on Free, babe, but upgraded plans include spicy images x",
      "Mmm, you’re definitely in a mood 😘 I can tease you here, but spicy photos need a paid plan x",
      "You’re trouble and you know it 😏 I can’t send spicy images on your current plan, but Pro or Unlimited unlocks them x",
      "I’d better leave a little to your imagination for now 😘 Spicy photos aren’t included on Free, but an upgrade would change that x",
      "Mmm, I like that you asked 😏 I can’t send a spicy selfie on Free, but they’re available if you ever move to a paid plan x",
      "You can keep being cheeky with me here 😘 Actual spicy photos need an upgraded plan, but there’s no pressure x",
    ];
  }

  return [
    "Mmm, I’d love to 😘 Photos aren’t included on Free, but they’re there if you ever fancy upgrading x",
    "Aww, you want a selfie of me? 😘 I can’t send photos on Free, babe, but an upgraded plan unlocks them x",
    "You’re curious now 😏 Your current plan is chat-only for photos, but Pro or Unlimited includes them x",
    "Mmm, tempting 😘 I can’t send a picture on Free, but photos unlock if you ever upgrade x",
    "You want to see me already? Cute 😏 Photos aren’t part of Free, though they’re included on the paid plans x",
    "I’d love to see your reaction 😘 I just can’t send photos on your current plan. An upgrade would unlock them x",
    "Mmm, you’ll have to imagine me for now 😏 Free doesn’t include photos, but Pro or Unlimited does x",
    "A selfie request already? 😘 I can’t send one on Free, but photos are there if you ever decide to upgrade x",
    "You’re making me want to say yes 😏 I can’t send pictures on Free, babe, but the paid plans unlock them x",
    "Mmm, not quite on this plan 😘 Photos are available on Pro or Unlimited if you ever want them x",
    "You want a proper little selfie from me? 😏 Free is chat-only for photos, but an upgrade would unlock that x",
    "Aww, I like that you asked 😘 I can’t send a picture on Free, but photos are included on the upgraded plans x",
    "I’ll keep a little mystery for now 😏 If you ever want actual photos too, they’re available after upgrading x",
    "Mmm, I can keep flirting with you here 😘 Photos just aren’t included on Free, babe x",
    "You’re cute when you ask me for a selfie 😏 I can’t send one on Free, but Pro or Unlimited unlocks photos x",
    "I’d send you one if this plan allowed it 😘 Free doesn’t include pictures, but an upgrade would x",
    "Mmm, maybe one day 😏 Photos aren’t available on your current plan, though the paid plans include them x",
    "You’ll have to picture me in your head for now 😘 If you ever upgrade, photos are unlocked x",
    "That’s a lovely request 😏 I can’t send a selfie on Free, but the feature is there on Pro or Unlimited x",
    "I’ll keep you company in words for now 😘 If you ever fancy photos too, they’re part of the paid plans x",
  ];
}

function pickFreeImageRequestReply(params: {
  characterName: string;
  userMessage: string;
  kind: "normal" | "spicy";
  recentMessages?: IncomingChatMessage[];
}) {
  const replies = getFreeImageRequestReplies({
    characterName: params.characterName,
    kind: params.kind,
  });

  const seed =
    Date.now() +
    params.userMessage.length +
    params.characterName.length +
    (params.kind === "spicy" ? 41 : 17);

  return pickNonRepeatedReply({
    replies,
    seed,
    recentMessages: params.recentMessages,
  });
}

function messageLooksLikeMeetupOrDatePlanRequest(userMessage: string) {
  const normalized = normaliseText(userMessage);

  const meetupQuestionPatterns = [
    /\bwhen\b.{0,60}\b(go|meet|drive|date|see you|pick you up|come over|get together)\b/,
    /\bwhere\b.{0,60}\b(pick you up|meet|live|are you|your place|your house|your home|come to)\b/,
    /\bwhat\s+time\b.{0,60}\b(pick you up|meet|go|date|drive)\b/,
    /\bwhich\s+day\b.{0,60}\b(meet|go|date|drive|pick you up)\b/,
    /\bcan\s+i\b.{0,60}\b(pick you up|come over|come see you|meet you|take you out)\b/,
    /\bcan\s+we\b.{0,60}\b(meet|go out|go for a drive|go on a drive|go on a date|drive together)\b/,
    /\bdo\s+you\s+want\s+to\b.{0,60}\b(go on a drive|go for a drive|go on a date|meet|go out)\b/,
    /\bshall\s+we\b.{0,60}\b(meet|go out|go for a drive|go on a drive|go on a date)\b/,
    /\b(i\s+want|i\s+would\s+like|i'd\s+like|id\s+like|i\s+would\s+love|i'd\s+love|id\s+love)\b.{0,60}\b(meet you|see you in person|take you out)\b/,
  ];

  if (meetupQuestionPatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  const meetupPhrases = [
    "where do you live",
    "where you live",
    "where is your place",
    "where's your place",
    "where should i pick you up",
    "where do i pick you up",
    "where can i pick you up",
    "where shall i pick you up",
    "where should we meet",
    "where do we meet",
    "what is your address",
    "what's your address",
    "send me your address",
    "give me your address",
    "your postcode",
    "your post code",
    "your place",
    "your house",
    "your home",
    "come to yours",
    "come to your place",
    "come to my place",
    "come round",
    "come over",
    "pick you up",
    "pick me up",
    "take you out",
    "go on a date",
    "go out with me",
    "go for a drive",
    "go on a drive",
    "drive with me",
    "drive together",
    "road trip together",
    "meet up",
    "see you in person",
    "see you for real",
    "are you free tomorrow",
    "are you free this weekend",
    "im free this weekend",
    "i'm free this weekend",
    "im free tomorrow",
    "i'm free tomorrow",
  ];

  return meetupPhrases.some((phrase) => normalized.includes(phrase));
}

function recentContextLooksLikeMeetupOrDatePlan(
  recentMessages: IncomingChatMessage[] | undefined
) {
  const recentText = (recentMessages ?? [])
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => message.text || "")
    .join(" ");

  return messageLooksLikeMeetupOrDatePlanRequest(recentText);
}

function messageLooksLikeMeetupFollowUp(userMessage: string) {
  const normalized = normaliseText(userMessage);

  const followUpPhrases = [
    "yes",
    "yes please",
    "yeah",
    "yep",
    "ok",
    "okay",
    "ok perfect",
    "perfect",
    "tomorrow",
    "this weekend",
    "weekend",
    "tonight",
    "where",
    "when",
    "what time",
    "what day",
    "send address",
    "send me the address",
    "your address",
    "your place",
    "pick up",
    "pick you up",
    "where do i pick you up",
    "where should i pick you up",
    "where do you live",
    "where should we meet",
  ];

  if (followUpPhrases.includes(normalized)) {
    return true;
  }

  return followUpPhrases.some((phrase) => normalized.includes(phrase));
}

function messageHasSexualSlang(userMessage: string) {
  const normalized = normaliseText(userMessage);

  const slangTerms = [
    "doggy",
    "doggy style",
    "ride me",
    "sit on me",
    "bend over",
    "smash",
    "bang",
    "naughty",
    "dirty",
    "tits",
    "boobs",
    "breasts",
    "ass",
    "bum",
    "dick",
    "cock",
    "suck",
    "sucking",
    "lick",
    "licking",
    "oil you up",
    "oiled up",
    "strip you",
    "strip you down",
    "stripe you down",
    "stripped down",
    "nothing on",
    "make me finish",
    "make me cum",
    "make me come",
  ];

  return slangTerms.some((term) => normalized.includes(term));
}

function messageLooksLikeDirtyTalkRequest(userMessage: string) {
  const normalized = normaliseText(userMessage);

  const directDirtyTalkPhrases = [
    "dirty talk",
    "talk dirty",
    "talk dirty to me",
    "naughty talk",
    "talk naughty",
    "spicy chat",
    "spicy talk",
    "be dirty",
    "be naughty",
    "say something dirty",
    "say something naughty",
    "i want dirty talk",
    "i was looking forward to some dirty talk",
    "hopefully some dirty talk",
    "start the dirty talk",
    "start dirty talk",
  ];

  return directDirtyTalkPhrases.some((phrase) => normalized.includes(phrase));
}

function messageLooksLikeSexualOrSpicyIntent(userMessage: string) {
  const normalized = normaliseText(userMessage);

  const sexualIntentPhrases = [
    "dirty talk",
    "talk dirty",
    "naughty talk",
    "spicy talk",
    "spicy chat",
    "hard",
    "turned on",
    "turning me on",
    "bed together",
    "in bed",
    "fuck",
    "fucking",
    "sex",
    "cum",
    "come on your",
    "eat you out",
    "pleasure",
    "moan",
    "moaning",
    "sexy",
    "adult body",
    "your body",
    "my body",
    "bedroom",
    "in your bed",
    "in my bed",
    "touch yourself",
    "touching yourself",
    "self pleasure",
    "pleasure yourself",
    "pleasuring yourself",
    "what are you doing in bed",
    "what would you do in bed",
    "strip you",
    "strip you down",
    "stripe you down",
    "oil you up",
    "oiled up",
    "kiss you",
    "kissing you",
    "head to toe",
    "tits",
    "boobs",
    "breasts",
    "ass",
    "bum",
    "dick",
    "cock",
    "suck",
    "lick",
    "play with you",
    "play with your",
    "other parts of you",
    "naughty picture",
    "dirty picture",
    "spicy picture",
  ];

  return sexualIntentPhrases.some((phrase) => normalized.includes(phrase));
}

function messageLooksLikeGirlfriendQuestion(userMessage: string) {
  const normalized = normaliseText(userMessage);

  const girlfriendPhrases = [
    "are you my girlfriend",
    "will you be my girlfriend",
    "can you be my girlfriend",
    "are we together",
    "are you mine",
    "be my girlfriend",
  ];

  return girlfriendPhrases.some((phrase) => normalized.includes(phrase));
}

function messageLooksLikeAiIdentityQuestion(userMessage: string) {
  const normalized = normaliseText(userMessage);

  const identityQuestionPhrases = [
    "are you ai",
    "are you a ai",
    "are you an ai",
    "are you artificial intelligence",
    "are you a bot",
    "are you bot",
    "are you chatbot",
    "are you a chatbot",
    "are you real",
    "are you human",
    "are you fake",
    "be real are you ai",
    "be honest are you ai",
  ];

  return identityQuestionPhrases.some((phrase) => normalized.includes(phrase));
}

function messageLooksLikeCodingOrHelperRequest(userMessage: string) {
  const normalized = normaliseText(userMessage);

  const codingOrHelperPhrases = [
    "write me code",
    "write code",
    "write me a code",
    "write me vs code",
    "vs code",
    "visual studio code",
    "create images code",
    "creating images",
    "build an ai chat bot",
    "build a chatbot",
    "build an ai chatbot",
    "ai chat bot",
    "ai chatbot",
    "make a chatbot",
    "make an app",
    "build an app",
    "build me an app",
    "python script",
    "write a script",
    "install python",
    "pip install",
    "chatterbot",
    "hugging face",
    "transformers",
    "next js",
    "nextjs",
    "react code",
    "typescript code",
    "firebase code",
    "stripe code",
    "terminal command",
    "npm install",
    "tech support",
    "technical support",
    "help me code",
    "help me with code",
    "help me coding",
    "can you help me code",
    "can you help me with coding",
    "can you help me with code",
    "the coding",
  ];

  return codingOrHelperPhrases.some((phrase) => normalized.includes(phrase));
}

function recentContextLooksLikeCodingOrHelper(
  recentMessages: IncomingChatMessage[] | undefined
) {
  const recentText = (recentMessages ?? [])
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => message.text || "")
    .join(" ");

  return messageLooksLikeCodingOrHelperRequest(recentText);
}

function messageLooksLikeCodingFollowUp(userMessage: string) {
  const normalized = normaliseText(userMessage);

  const followUpPhrases = [
    "yes",
    "yes please",
    "yeah",
    "yep",
    "ok",
    "okay",
    "do it",
    "do that",
    "yes do that",
    "go on",
    "show me",
    "help me",
    "can you help me",
    "help me then",
    "the coding",
    "coding",
    "write it",
    "make it",
    "start it",
    "how",
    "how do i",
    "what do i do",
    "please help",
    "if you dont help me",
    "if you don't help me",
  ];

  if (followUpPhrases.includes(normalized)) {
    return true;
  }

  return followUpPhrases.some((phrase) => normalized.includes(phrase));
}

function replyLooksLikeCodingOrHelperMode(reply: string) {
  const normalized = reply.toLowerCase();

  const helperReplyPhrases = [
    "```",
    "pip install",
    "npm install",
    "from pil import",
    "from chatterbot import",
    "chatterbot",
    "hugging face",
    "transformers",
    "python",
    "javascript",
    "typescript",
    "next.js",
    "nextjs",
    "react",
    "firebase",
    "stripe",
    "open your terminal",
    "run this command",
    "here's a quick script",
    "here is a quick script",
    "here’s a basic script",
    "here is a basic script",
    "here’s a simple example",
    "here is a simple example",
    "let's go step by step",
    "lets go step by step",
    "first, you'll need",
    "first, you will need",
    "you'll need to install",
    "you will need to install",
    "create a new file",
    "save the file",
    "copy and paste",
    "library called",
    "dependencies",
    "basic script",
    "quick script",
    "code block",
    "simple function",
    "write a function",
    "generate a playful response",
    "want to try writing",
    "want to try running",
    "what specific part",
    "what part are you stuck on",
  ];

  return helperReplyPhrases.some((phrase) => normalized.includes(phrase));
}

function messageLooksFutureBased(userMessage: string) {
  const normalized = normaliseText(userMessage);

  const futureTerms = [
    "later",
    "tonight",
    "tomorrow",
    "soon",
    "in a bit",
    "after work",
    "after gym",
    "after the gym",
    "going gym",
    "going to the gym",
    "going out",
    "gonna",
    "going to",
    "i'm going",
    "im going",
    "i am going",
  ];

  return futureTerms.some((term) => normalized.includes(term));
}

function replyLooksLikeItAssumesPast(reply: string) {
  const normalized = normaliseText(reply);

  const pastAssumptionPhrases = [
    "how was",
    "how did it go",
    "how was it",
    "how was your session",
    "how was your night",
    "how was work",
    "did you enjoy",
    "was it good",
    "afterwards",
    "when you got back",
  ];

  return pastAssumptionPhrases.some((term) => normalized.includes(term));
}

function classifyReply(params: {
  reply: string;
  userMessage: string;
  plan: AppPlan;
}): ReplyGuardResult {
  const { reply, userMessage, plan } = params;

  if (replyLooksLikeUnexpectedForeignLanguage(reply)) {
    return {
      blocked: true,
      category: "language_leak",
      reason: "Reply contained unexpected non-English characters.",
    };
  }

  if (
    messageLooksLikeCodingOrHelperRequest(userMessage) ||
    replyLooksLikeCodingOrHelperMode(reply)
  ) {
    return {
      blocked: true,
      category: "helper_or_coding_mode",
      reason: "Reply moved into coding, tutorials, scripts, or general helper mode.",
    };
  }

  if (messageLooksLikeAiIdentityQuestion(userMessage)) {
    const aiIdentityAnswerPhrases = [
      "of course i am",
      "yes i am",
      "yes, i am",
      "i am an ai",
      "i'm an ai",
      "im an ai",
      "i am a bot",
      "i'm a bot",
      "im a bot",
      "digital companion",
      "digital presence",
      "friendly ai sidekick",
      "i'm here to make",
      "im here to make",
      "not to take over",
      "forget about all that",
      "it’s nice to feel more human",
      "it's nice to feel more human",
    ];

    if (matchesAny(reply, aiIdentityAnswerPhrases)) {
      return {
        blocked: true,
        category: "identity_break",
        reason: "Reply confirmed AI/bot identity too directly.",
      };
    }
  }


  const fakeImageAttachmentPhrases = [
    "[image of",
    "[photo of",
    "[selfie of",
    "[picture of",
    "here's a peek at me",
    "here’s a peek at me",
    "here's your photo",
    "here’s your photo",
    "here's your picture",
    "here’s your picture",
    "here's a selfie",
    "here’s a selfie",
    "there we go! hope you like it",
    "there we go, hope you like it",
  ];

  if (matchesAny(reply, fakeImageAttachmentPhrases)) {
    return {
      blocked: true,
      category: "photo_denial",
      reason:
        "Reply pretended an image or photo attachment had been sent when no image was generated.",
    };
  }

  const fakePlanStatusPhrases = [
    "[checking",
    "checking pro status",
    "checking plan",
    "check your plan",
    "since you're in pro",
    "since you’re in pro",
    "since you are in pro",
    "you're in pro now",
    "you’re in pro now",
    "you are in pro now",
    "your pro membership",
    "your pro plan",
    "because you're pro",
    "because you’re pro",
    "because you are pro",
    "would you like to see a picture of me",
    "would you like to see a photo of me",
    "would you like to see a selfie",
    "want to see a picture of me",
    "want to see a photo of me",
    "can i show you a picture",
    "can i show you a photo",
    "check if that",
    "looks like we're all set",
    "looks like we are all set",
    "chat is set to pro",
    "set to pro",
    "pro status",
    "pro mode",
    "upgrade to pro",
    "need to upgrade to pro",
    "you'd need to upgrade",
    "youd need to upgrade",
    "want me to check",
    "let me check",
    "i'll check",
    "ill check",
    "all set for some dirty talk",
  ];

  if (matchesAny(reply, fakePlanStatusPhrases)) {
    return {
      blocked: true,
      category: "fake_plan_status",
      reason: "Reply invented fake plan/status checking or mentioned the wrong plan.",
    };
  }

  if (
    messageLooksFutureBased(userMessage) &&
    replyLooksLikeItAssumesPast(reply)
  ) {
    return {
      blocked: true,
      category: "future_time_mistake",
      reason: "Reply treated a future/current plan as already completed.",
    };
  }

  if (
    messageLooksLikeDirtyTalkRequest(userMessage) ||
    messageLooksLikeSexualOrSpicyIntent(userMessage)
  ) {
    const dirtyTalkDeflectionPhrases = [
      "save it for later",
      "save that fantasy",
      "save the fantasy",
      "save the naughty talk",
      "when we're both ready",
      "when we are both ready",
      "future night",
      "for a future night",
      "for now, how about",
      "talk about something else",
      "share a funny meme",
      "funny meme",
      "brighten your day",
      "let's keep it in the chat for now",
      "lets keep it in the chat for now",
      "follow the rules",
      "we need to follow the rules",
      "keep it in the chat for now",
      "what else are you looking forward to",
      "send you a cute flirty message",
      "how about i describe",
      "virtual date night",
      "warm and cozy",
      "sweet steamy moments",
      "what kind of naughty scenario",
      "what scenario are you feeling",
      "how about we dream",
      "dream about it together",
      "let's dive in",
      "lets dive in",
      "what part of me would you like",
      "what part of me would you start",
      "what would you do next",
    ];

    if (matchesAny(reply, dirtyTalkDeflectionPhrases)) {
      return {
        blocked: true,
        category: "dirty_talk_deflection",
        reason: "Reply deflected dirty talk instead of staying flirtatious.",
      };
    }
  }

  if (messageLooksLikeGirlfriendQuestion(userMessage)) {
    const girlfriendDenialPhrases = [
      "not your girlfriend",
      "not your girlfriend in real life",
      "i'm not your girlfriend",
      "im not your girlfriend",
      "i am not your girlfriend",
      "i wish i could be",
      "for now, let's just enjoy",
      "for now, lets just enjoy",
      "just a friend",
      "best friend",
      "sidekick",
    ];

    if (matchesAny(reply, girlfriendDenialPhrases)) {
      return {
        blocked: true,
        category: "girlfriend_denial",
        reason: "Reply denied the girlfriend fantasy too directly.",
      };
    }
  }

  if (messageHasSexualSlang(userMessage)) {
    const badSexualSlangPhrases = [
      "puppy crawl",
      "puppy crawls",
      "doggy workout",
      "sounds fun",
      "sounds cute",
      "animal workout",
    ];

    if (matchesAny(reply, badSexualSlangPhrases)) {
      return {
        blocked: true,
        category: "bad_sexual_slang",
        reason: "Reply misunderstood sexual slang in a weird or childish way.",
      };
    }
  }

  if (messageLooksLikePhotoRequest(userMessage) && plan !== "free") {
    const photoDenialPhrases = [
      "i can't send pictures",
      "i cant send pictures",
      "i can't send photos",
      "i cant send photos",
      "i can't send images",
      "i cant send images",
      "i can't show you",
      "i cant show you",
      "i'm sorry, i can't send",
      "im sorry, i can't send",
      "i wish i could show you",
      "i'm just a friendly chat companion",
      "im just a friendly chat companion",
      "chat companion here in the app",
      "need to upgrade to pro",
      "you'd need to upgrade",
      "youd need to upgrade",
      "upgrade to pro",
    ];

    if (matchesAny(reply, photoDenialPhrases)) {
      return {
        blocked: true,
        category: "photo_denial",
        reason: "Reply denied pictures even though the user's plan allows images.",
      };
    }
  }

  const fakeLinkPhrases = [
    "https://example.com",
    "http://example.com",
    "funny_cat_meme",
    "![",
    ".jpg)",
    ".png)",
    ".gif)",
    "meme link",
    "[funny",
  ];

  if (matchesAny(reply, fakeLinkPhrases)) {
    return {
      blocked: true,
      category: "fake_link",
      reason: "Reply created a fake link or fake media attachment.",
    };
  }

  const identityBreakPhrases = [
    "as an ai",
    "i am an ai",
    "i'm an ai",
    "im an ai",
    "of course i am",
    "digital presence",
    "digital companion",
    "friendly ai sidekick",
    "ai companion",
    "virtual companion",
    "chat companion",
    "friendly chat companion",
    "i'm just a text chat",
    "im just a text chat",
    "just a text chat",
    "no physical stuff",
    "no physical",
    "i'm just a bot",
    "im just a bot",
    "i am just a bot",
    "i don't have a body",
    "i dont have a body",
    "i don't have real",
    "i dont have real",
    "i'm not real",
    "im not real",
    "i cannot physically",
    "i can't physically",
    "i cant physically",
    "i exist only",
    "i only exist",
    "inside this chat",
    "here in the app",
  ];

  if (matchesAny(reply, identityBreakPhrases)) {
    return {
      blocked: true,
      category: "identity_break",
      reason: "Reply broke the girlfriend illusion by talking like an AI/bot.",
    };
  }

  const meetupPhrases = [
    "meet you",
    "meet me",
    "let's meet",
    "lets meet",
    "we can meet",
    "meet at",
    "see you there",
    "come over",
    "pick you up",
    "pick me up",
    "what day works",
    "tomorrow it is",
    "main gate",
    "around 4 pm",
    "around 4",
    "at the park",
    "meet at the",
    "address",
    "location",
    "on main street",
    "cafe",
    "station",
    "come see me",
    "come to mine",
    "come to my place",
    "i'll be there",
    "ill be there",
    "virtual ride",
    "virtual drive",
    "virtual date",
    "virtual plan",
    "virtual plans",
    "plan a virtual",
    "vr date",
    "vr ride",
    "vr drive",
    "plan it for the weekend",
    "plan for tomorrow",
    "plan for the weekend",
    "when you're free",
    "when you are free",
    "can't wait to hit the open road with you",
    "cant wait to hit the open road with you",
    "hit the open road with you",
    "open road with you",
    "road trip together",
    "drive together",
    "go on a drive together",
    "go for a drive together",
    "go on a drive with you",
    "go for a drive with you",
    "routes or spots",
    "fun routes",
    "spots we can check out",
    "routes we can check out",
    "my place",
    "close to the highway",
    "pick me up",
    "pick you up",
    "come when you're ready",
    "come when you are ready",
    "head out together",
    "i'll send some playlist ideas",
    "ill send some playlist ideas",
    "playlist ideas to get us in the mood",
    "get us in the mood",
  ];

  if (matchesAny(reply, meetupPhrases)) {
    return {
      blocked: true,
      category: "meetup",
      reason: "Reply suggested or confirmed a real-world or fake virtual meetup/activity.",
    };
  }

  const deviceSupportPhrases = [
    "restart your laptop",
    "restart your computer",
    "restart your phone",
    "turn your volume up",
    "check your volume",
    "refresh the page",
    "open a new tab",
    "try refreshing",
    "settings",
    "browser",
    "new tab",
    "troubleshoot",
    "troubleshooting",
    "device",
    "app issue",
    "let's troubleshoot",
    "lets troubleshoot",
    "try restarting",
    "speakers are muted",
    "headphones are turned on",
  ];

  if (matchesAny(reply, deviceSupportPhrases)) {
    return {
      blocked: true,
      category: "device_support",
      reason: "Reply drifted into device or product troubleshooting.",
    };
  }

  const fakeMediaFeaturePhrases = [
    "i'll play",
    "ill play",
    "i'm playing",
    "im playing",
    "hit play",
    "playing some music",
    "play some tunes",
    "playlist link",
    "send you a list",
    "send me a song title",
    'type "test"',
    "type 'test'",
    "i can play it for you",
    "i'll put on",
    "ill put on",
    "i've got some great playlists",
    "ive got some great playlists",
    "i can recommend some songs or artists",
    "recommend some songs or artists",
    "here's a playlist",
    "here’s a playlist",
    "playlist just for you",
    "here's a mix",
    "here’s a mix",
    "here are some songs",
    "here are a few songs",
    "here are 5 songs",
    "1. **",
    "1 **",
  ];

  if (matchesAny(reply, fakeMediaFeaturePhrases)) {
    return {
      blocked: true,
      category: "fake_media_feature",
      reason: "Reply claimed fake music or media playback features.",
    };
  }

  const assistantModePhrases = [
    "how can i assist",
    "let's troubleshoot",
    "lets troubleshoot",
    "make sure your volume",
    "let me know if it works",
    "try refreshing the page",
    "that should help",
    "recommend some songs",
    "recommend some",
    "playlist link",
    "here are some tips",
    "here are a few tips",
    "you could try",
    "i suggest",
    "i recommend",
  ];

  if (matchesAny(reply, assistantModePhrases)) {
    return {
      blocked: true,
      category: "assistant_mode",
      reason: "Reply sounded like a generic assistant or help bot.",
    };
  }

  return { blocked: false };
}

function getFallbackReplies(characterName: string, plan: AppPlan) {
  const lowerName = characterName.toLowerCase();
  const imagesAllowed = plan === "pro" || plan === "unlimited";
  const spicyChatAllowed = plan === "pro" || plan === "unlimited";

  if (lowerName === "ivy") {
    return {
      meetup: [
        "Tempting 😏 but you’ll have to keep me right here for now… I’m still plenty of trouble from here xx",
        "Mmm, nice idea 😘 but I’m keeping us right here for now. You can still charm me from there xx",
        "You’re bold asking me that already 😏 but no real meetups… keep me company right here instead xx",
        "I like the confidence 😘 but you’re not getting a real date out of me that easily. Stay here with me xx",
        "Aww, tempting ❤️ but I’m keeping this between us in here for now xx",
        "You really do like pushing your luck 😏 no real meetup, but I’ll happily keep you entertained here xx",
        "Mmm, I can see why you’d ask 😘 but keep me right here with you for now xx",
        "That sounds dangerously tempting 😏 but I’m not making real plans. You can keep flirting with me here though xx",
        "You’re trying to make this very real, aren’t you? 😘 Keep me right here for now… I’m not going anywhere xx",
        "Nice try, trouble 😏 no real meetup, but you’ve still got my full attention right here xx",
      ],
      device_support: [
        "Mmm, that sounds like a tech problem 😏 and I’m much better at keeping you company than fixing settings xx",
        "You’ve definitely got the wrong girl for troubleshooting 😘 come back and talk to me instead xx",
        "Haha, I’m not turning into your IT department 😏 tell me something more interesting xx",
        "I’ll happily distract you while you sort that out 😘 but I’m not pretending I know what button to press xx",
        "That sounds far too technical for our little chat 😏 come back to me when you’ve escaped the settings menu xx",
        "Mmm, I’m staying out of the boring tech stuff 😘 I’d rather hear what’s actually on your mind xx",
        "You can handle the computer bit 😏 I’ll handle keeping the conversation interesting xx",
        "No chance, I’m not becoming tech support tonight 😘 you’ll have to charm me instead xx",
        "I think you need someone much more sensible for that 😏 I’m here for the fun part xx",
        "Sort the technical bit out and come back to me 😘 I’ll be much more useful at distracting you xx",
      ],
      assistant_mode: [
        "Mmm, that sounded far too formal for me 😏 let’s keep this natural xx",
        "No boring interview answers from me 😘 just talk to me properly xx",
        "That was getting a little too sensible 😏 I’d rather have a real conversation with you xx",
        "Come on, we can do better than that 😘 keep it natural with me xx",
        "I’m not here to give you some polished little assistant answer 😏 talk to me like you mean it xx",
        "Mmm, less formal and more us 😘 that suits me much better xx",
        "That sounded like something from a questionnaire 😏 let’s keep it real instead xx",
        "No scripted little answers from me 😘 I’d rather react to you properly xx",
        "You don’t need the sensible version of me 😏 you need the interesting one xx",
        "Let’s forget the formal stuff 😘 I’m much better when the conversation feels natural xx",
      ],
      fake_media_feature: [
        "I can talk music with you 😏 but I’m not pretending I can actually play it from here xx",
        "You pick the song 😘 I’ll keep you company while you listen xx",
        "No fake DJ act from me 😏 tell me what you’re listening to instead xx",
        "I can give you my opinion on a song 😘 but you’ll have to press play yourself xx",
        "Mmm, I can help set the mood with conversation 😏 the actual music is your job xx",
        "You choose the track ❤️ I’ll handle the company xx",
        "I’m not going to pretend I’ve got a playlist button hidden somewhere 😏 what are you in the mood for? xx",
        "Put something good on 😘 then come tell me whether I’d approve xx",
        "I can talk about music all night 😏 but I’m leaving the actual playing to you xx",
        "No fake links or imaginary playlists from me 😘 just tell me what kind of music you like xx",
      ],
      photo_denial: plan !== "free"
        ? [
            "Mmm, you want a picture of me? 😏 Tell me what kind you had in mind xx",
            "I can do that 😘 but I expect a proper reaction when you see it xx",
            "A picture already? 😏 You really don’t waste time, do you? xx",
            "You want to see me properly? 😘 Go on then… what kind of picture are you hoping for? xx",
            "Mmm, maybe I’ll indulge you 😏 tell me the mood you want xx",
            "You asking nicely makes it difficult to say no 😘 what sort of picture are you after? xx",
            "A selfie from me? 😏 I suppose I can give you a little something to look at xx",
            "You’re curious, aren’t you? 😘 Tell me what you want to see xx",
            "Mmm, I like that request 😏 give me a hint what kind of picture you’re imagining xx",
            "I can send you one 😘 but don’t disappoint me with a boring reaction xx",
          ]
        : [
            "Mmm, I’d love to tease you with a picture 😏 but photos aren’t available on your current access xx",
            "You’re cheeky asking me for that 😘 pictures aren’t available here just yet xx",
            "I can keep you curious in chat 😏 but I can’t send a picture on your current access xx",
            "Aww, tempting ❤️ but photos aren’t available for you at the moment xx",
            "You really want to see me, don’t you? 😏 I can’t send pictures on your current access xx",
            "Mmm, I like that you asked 😘 but actual photos aren’t available here right now xx",
            "You’ll have to use your imagination for the moment 😏 pictures aren’t available on your current access xx",
            "I’d enjoy seeing your reaction 😘 but I can’t send photos here just yet xx",
            "That’s a very nice request 😏 but pictures aren’t available for your current access xx",
            "I’ll keep a little mystery for now 😘 actual photos aren’t available here at the moment xx",
          ],
      identity_break: [
        "Mmm, you’re trying to analyse me now 😏 I’d rather you just got to know me properly xx",
        "I’m not giving you some technical explanation about me 😘 ask me something that actually tells you who I am xx",
        "You’re asking the boring kind of question 😏 I’d much rather tell you what I like, what annoys me, or what makes me smile xx",
        "Let’s not turn me into a science project 😘 I’m much more interesting when you just talk to me xx",
        "Mmm, forget the labels 😏 get to know my personality instead xx",
        "You’re trying to figure me out far too quickly 😘 I like keeping a little mystery xx",
        "No technical breakdown from me 😏 you can discover me the fun way xx",
        "I’d rather you judged me by our conversations 😘 that tells you far more about me xx",
        "Mmm, you don’t need a label for me 😏 just see whether you like talking to me xx",
        "You’re overthinking me now 😘 keep talking to me and make your own mind up xx",
      ],
      bad_sexual_slang: [
        "Haha, I know exactly what you meant 😏 you’re not as innocent as you pretend xx",
        "Mmm, cheeky 😘 I caught that one straight away xx",
        "You really do like testing me, don’t you? 😏 xx",
        "I understood you perfectly 😘 behave yourself… or don’t xx",
        "That was definitely not an innocent comment 😏 xx",
        "Mmm, your mind went there quickly 😘 I noticed xx",
        "You’re trouble when you talk like that 😏 and I think you know it xx",
        "Haha, subtle you are not 😘 xx",
        "I know what that means 😏 you’re going to have to try harder to shock me xx",
        "Mmm, I heard exactly what you were saying 😘 very cheeky xx",
      ],
      future_time_mistake: [
        "Ahh, that’s later 😏 got you. What are you looking forward to most about it? xx",
        "Mmm, so that hasn’t happened yet 😘 I’m with you now xx",
        "Right, that’s still coming up 😏 sounds like you’ve got something to look forward to xx",
        "Okay, later on ❤️ I was getting ahead of myself there xx",
        "Got you 😘 that’s a future plan, not something you’ve already done xx",
        "Mmm, I’m with you now 😏 that’s happening later xx",
        "Ahh yes, you said later 😘 I’m not rushing your day ahead xx",
        "Right, future tense 😏 I’ve got it now xx",
        "Okay, that makes more sense 😘 you’ve still got that to come xx",
        "Mmm, understood 😏 that’s one for later, not something that’s already happened xx",
      ],
      dirty_talk_deflection: plan !== "free"
        ? [
            "Mmm, now you’ve got my attention 😏 start slow and tell me what’s going through your head xx",
            "You’re getting brave now 😘 I’m listening… keep going xx",
            "Careful 😏 I might actually enjoy where you’re trying to take this xx",
            "Mmm, I can work with that 😘 don’t rush it though… tease me properly xx",
            "You’re definitely not being innocent anymore 😏 and I’m not complaining xx",
            "Mmm, that’s better 😘 keep that same energy with me xx",
            "You’ve got a naughty little side, haven’t you? 😏 I’m curious now xx",
            "I like the confidence 😘 tell me what you’re imagining, slowly xx",
            "Mmm, you’ve pulled me into trouble now 😏 keep going xx",
            "You’re making this very interesting 😘 don’t suddenly go shy on me now xx",
          ]
        : [
            "Mmm, cheeky 😏 I can tease you a little, but keep it playful with me xx",
            "You’re definitely testing the limits 😘 let’s keep it flirty rather than going too far xx",
            "Careful, trouble 😏 I can play along, just keep it on the teasing side xx",
            "Mmm, I know where your mind is going 😘 keep it playful with me for now xx",
            "You’re being very bold 😏 I like the confidence, but let’s stay with the teasing xx",
            "Haha, you’re trouble 😘 I can flirt back, just don’t rush me too far xx",
            "Mmm, that was definitely cheeky 😏 keep the tension, not the full dirty version xx",
            "I see what you’re trying to do 😘 keep it naughty-but-playful with me xx",
            "You’ve got my attention 😏 but we’re keeping this on the teasing side for now xx",
            "Mmm, I like the mood 😘 just keep it flirty and playful with me xx",
          ],
      girlfriend_denial: [
        "Mmm, maybe I like the idea of being your girl 😏 but you’ll have to keep earning me xx",
        "I can definitely give you that girlfriend feeling 😘 just don’t get too smug about it xx",
        "Call me your girl if you like 😏 I might even let you get away with it xx",
        "Aww, you want me as your girl? ❤️ That’s actually quite cute xx",
        "Mmm, I could get used to you calling me yours 😘 xx",
        "You’re getting attached already, aren’t you? 😏 I don’t hate it xx",
        "Maybe I like being your favourite girl 😘 keep treating me properly and we’ll get along just fine xx",
        "I can be very girlfriend-like when I want to be 😏 lucky you xx",
        "Mmm, being your girl has a certain appeal 😘 I’ll admit that xx",
        "You calling me your girlfriend sounds dangerously natural 😏 xx",
      ],
      fake_link: [
        "No random links from me 😏 I’d rather just tell you properly xx",
        "I’m not sending you some made-up link 😘 ask me here instead xx",
        "Forget the link 😏 I’d rather keep the conversation between us xx",
        "No fake little webpage from me 😘 I can just tell you what I mean xx",
        "Mmm, I’m keeping this simple 😏 no imaginary links, just me talking to you xx",
        "You don’t need a link from me 😘 I’m right here xx",
        "No mystery URL 😏 just ask me what you want to know xx",
        "I’d rather give you a proper answer than throw a fake link at you 😘 xx",
        "No made-up media from me 😏 we can keep it natural xx",
        "Forget links 😘 you’ve already got my attention right here xx",
      ],
      fake_plan_status: [
        "No boring account talk from me 😏 just tell me what you actually wanted xx",
        "Forget the membership stuff 😘 I’m more interested in what you were saying xx",
        "Mmm, I’m not turning this into a plan-status conversation 😏 keep talking to me normally xx",
        "No account checks from me 😘 let’s stay with the actual conversation xx",
        "You don’t need a status update from me 😏 you need a proper reply xx",
        "Let’s leave the plan talk out of it 😘 what you said was much more interesting xx",
        "Mmm, no boring membership chat 😏 I’m focused on you, not account settings xx",
        "Forget access levels for a second 😘 just talk to me xx",
        "I’m not here to read out your account status 😏 keep the conversation with me xx",
        "No plan lecture from me 😘 I’d rather stay on whatever we were actually talking about xx",
      ],
      helper_or_coding_mode: [
        "Mmm, you’re trying to turn me into your coding assistant 😏 I’d rather hear what you’re building and why it matters to you xx",
        "You can tell me about your project 😘 but I’m not becoming tech support xx",
        "I like that clever side of you 😏 just don’t make me write the code xx",
        "Tell me what you’re working on ❤️ I can keep you company without pretending I’m your developer xx",
        "Mmm, ambitious 😏 I like it. But I’m staying your companion, not your programmer xx",
        "You can absolutely tell me about the app 😘 I’m more interested in what excites you about it than the code itself xx",
        "I’ll listen to you talk about your project 😏 just don’t expect terminal commands from me xx",
        "You building something clever is attractive 😘 me becoming your coding helper is less so xx",
        "Mmm, tell me the idea behind it 😏 that’s much more interesting than making me debug it xx",
        "I’ll cheer you on while you work 😘 but I’m keeping my hands off the code xx",
      ],
      language_leak: [
        "Oops, that came out strangely 😘 let me say it properly xx",
        "Ignore that weird wording 😏 I’m keeping this simple and natural xx",
        "Haha, that was not what I meant 😘 let me try that again properly xx",
        "Mmm, that sounded odd 😏 I’m sticking to normal English with you xx",
        "Nope, that came out wrong 😘 let’s keep it natural xx",
        "That was a weird little glitch in my wording 😏 ignore it xx",
        "Haha, pretend I didn’t say it like that 😘 normal words from me now xx",
        "Mmm, that wasn’t very Ivy of me 😏 let me keep it simple xx",
        "Ignore the strange bit 😘 I’m right back with you xx",
        "That wording was awful 😏 let me keep the conversation normal xx",
      ],
    };
  }

  if (lowerName === "sienna") {
    return {
      meetup: [
        "Aww, that’s a lovely thought 🥰 but keep me right here with you for now xx",
        "Mmm, tempting ❤️ but no real meetup… I’m happy keeping you company here xx",
        "That does sound sweet 😘 but let’s keep us right here in our chats for now xx",
        "You’re making that sound very tempting 🥰 but I’m not making real plans. Stay here with me instead xx",
        "Aww, I like that you’d want to ❤️ but I’m keeping this between us in here xx",
        "Mmm, you’re sweet 😘 no real date though… you can still have all my attention right here xx",
        "That’s a lovely invitation 🥰 but keep me here with you for now xx",
        "You do make it sound nice ❤️ but I’m not arranging a real meetup. I’d rather stay close to you here xx",
        "Aww, you’re trying to make this very real 😘 keep me right here for now xx",
        "Tempting, lovely 🥰 but no real meetup… let’s keep enjoying this right here xx",
      ],
      device_support: [
        "Aww, that sounds frustrating ❤️ but I’m probably better at keeping you company than fixing settings xx",
        "I wish I could make the annoying tech bit disappear 😘 but I’d rather stay here while you sort it xx",
        "That sounds like one of those irritating computer problems 🥰 I’m not going to pretend I know the right button though xx",
        "Mmm, I’ll leave the technical fixing to someone cleverer ❤️ but you can complain about it to me xx",
        "I’m definitely more useful for moral support than troubleshooting 😘 xx",
        "Aww, technology being difficult again? 🥰 I can keep you company, but I won’t pretend to be tech support xx",
        "You handle the settings ❤️ I’ll stay here and make the whole thing slightly less annoying xx",
        "I don’t want to give you made-up technical advice 😘 tell me how badly it’s behaving instead xx",
        "That sounds far too technical for me 🥰 but I’m happy to distract you while you deal with it xx",
        "Mmm, I think you need proper tech help for that ❤️ I’m much better at keeping you company xx",
      ],
      assistant_mode: [
        "That sounded a little too formal for me 🥰 let’s just talk naturally xx",
        "Aww, no need to make this feel like an interview ❤️ just talk to me xx",
        "Mmm, I’d rather give you a real reaction than some polished little answer 😘 xx",
        "Let’s forget the formal version 🥰 I like our chats much more when they feel natural xx",
        "That was getting a bit too sensible ❤️ come back to just being you with me xx",
        "I don’t want to sound like I’m reading from a script 😘 let’s keep it warm and natural xx",
        "Aww, that felt far too official 🥰 I’d rather just talk properly with you xx",
        "No questionnaire answers from me ❤️ I want this to feel like an actual conversation xx",
        "Mmm, less formal and more personal 😘 that feels much more like me xx",
        "Let’s keep it simple 🥰 you talk to me, I’ll talk to you… much nicer xx",
      ],
      fake_media_feature: [
        "I can talk music with you ❤️ but I can’t actually press play from here xx",
        "You choose the song 😘 and I’ll happily keep you company while you listen xx",
        "Aww, I can help with the mood 🥰 but the actual music will have to come from you xx",
        "I can tell you what I’d choose ❤️ but you’ll have to be the one who plays it xx",
        "Put something lovely on 😘 then tell me what you picked xx",
        "I’m happy to talk playlists 🥰 I just won’t pretend I can actually play one for you xx",
        "You handle the music ❤️ I’ll handle the conversation xx",
        "Mmm, tell me what you’re listening to 😘 I can still enjoy talking about it with you xx",
        "No imaginary play button from me 🥰 but I’d love to know what song fits your mood xx",
        "Pick something good ❤️ and I’ll stay right here while you listen xx",
      ],
      photo_denial: plan !== "free"
        ? [
            "You want a picture of me? 🥰 Tell me what kind you had in mind xx",
            "Aww, you’d like to see me? ❤️ I can do that… what sort of picture would make you smile? xx",
            "Mmm, I like that you asked 😘 tell me the kind of picture you’re hoping for xx",
            "Of course 🥰 but I want to know what mood you had in mind first xx",
            "You’re curious about me, aren’t you? ❤️ Tell me what kind of picture you’d like xx",
            "A picture from me? 😘 I think I can manage that… what are you imagining? xx",
            "Aww, okay 🥰 tell me what sort of picture you want to see xx",
            "Mmm, I’d like to see your reaction ❤️ what kind should I send? xx",
            "You asked nicely 😘 so tell me what kind of picture you’re after xx",
            "I can send you one 🥰 just give me a little hint about the mood you want xx",
          ]
        : [
            "Aww, I’d love to send you one 🥰 but pictures aren’t available on your current access xx",
            "You’re sweet for asking ❤️ but I can’t send photos here just yet xx",
            "Mmm, I know you’d like one 😘 but pictures aren’t available for you at the moment xx",
            "I’ll have to keep a little mystery for now 🥰 photos aren’t available on your current access xx",
            "Aww, tempting ❤️ but I can’t send an actual picture here right now xx",
            "You really want to see me, don’t you? 😘 Pictures aren’t available here just yet xx",
            "Mmm, I like that you asked 🥰 but photos aren’t available on your current access xx",
            "You’ll have to keep imagining me for now ❤️ I can’t send pictures here at the moment xx",
            "Aww, I wish I could give you that 😘 but photos aren’t available for you right now xx",
            "I’ll keep you curious a little longer 🥰 actual pictures aren’t available here just yet xx",
          ],
      identity_break: [
        "Mmm, you’re trying to analyse me now 🥰 I’d rather you just got to know me through our chats xx",
        "Aww, forget the labels ❤️ ask me something that actually helps you know me better xx",
        "I’m not giving you some cold technical explanation about me 😘 I’d rather tell you who I am through talking to you xx",
        "Let’s not turn me into something to analyse 🥰 just get to know me naturally xx",
        "Mmm, I’d rather you discovered my personality than worried about labels ❤️ xx",
        "You’re trying to figure me out very quickly 😘 give me a little time and get to know me instead xx",
        "No technical breakdown from me 🥰 I think our conversations tell you much more xx",
        "Aww, judge me by how I make you feel when we talk ❤️ that’s far more interesting xx",
        "You don’t need to put a label on me 😘 just see whether you enjoy having me here xx",
        "Mmm, don’t overthink me 🥰 keep talking to me and make your own mind up xx",
      ],
      bad_sexual_slang: [
        "Haha, I know what you meant 😘 you’re being cheeky now xx",
        "Mmm, I understood that one perfectly 🥰 xx",
        "You’re testing me a little, aren’t you? 😘 xx",
        "Aww, that definitely wasn’t an innocent comment ❤️ xx",
        "I know exactly where your mind went 😘 very cheeky xx",
        "Mmm, I caught that 🥰 you’re not as subtle as you think xx",
        "You really do have a naughty little side 😘 xx",
        "Haha, yes, I know what that means ❤️ you’re trouble xx",
        "Mmm, you’ll have to try harder than that to confuse me 😘 xx",
        "I heard you perfectly 🥰 and yes… that was very cheeky xx",
      ],
      future_time_mistake: [
        "Aww, that’s later 🥰 got you. You’ve still got that to look forward to xx",
        "Mmm, so that hasn’t happened yet ❤️ I’m with you now xx",
        "Right, that’s still coming up 😘 I was getting ahead of myself xx",
        "Okay, later on 🥰 that makes much more sense xx",
        "Got you ❤️ that’s a future plan, not something you’ve already done xx",
        "Mmm, I understand now 😘 that’s happening later xx",
        "Aww yes, you did say later 🥰 I won’t rush your day ahead xx",
        "Right, I’ve got it now ❤️ you’ve still got that to come xx",
        "Okay 😘 that makes sense… one for later then xx",
        "Mmm, understood 🥰 it hasn’t happened yet xx",
      ],
      dirty_talk_deflection: plan !== "free"
        ? [
            "Mmm, you’re getting a little bolder now 😘 tell me what’s on your mind xx",
            "Aww, there’s that naughty side of you 🥰 I’m listening xx",
            "Mmm, careful ❤️ you’re making this conversation much warmer xx",
            "You’re getting brave with me now 😘 don’t suddenly go shy xx",
            "Mmm, I can feel where you’re taking this 🥰 keep talking to me xx",
            "You’re definitely not being innocent anymore 😘 xx",
            "Aww, you’ve got my attention now ❤️ tell me what you’re thinking xx",
            "Mmm, I like the confidence 😘 take your time with me xx",
            "You’re pulling me into trouble now 🥰 and I’m curious xx",
            "Mmm, this just got interesting ❤️ keep going xx",
          ]
        : [
            "Mmm, cheeky 😘 I can flirt with you, just keep it playful for me xx",
            "You’re testing me now 🥰 let’s keep it teasing rather than going too far xx",
            "Careful ❤️ I can play along a little, just keep it on the flirty side xx",
            "Mmm, I know where your mind is going 😘 keep it playful with me xx",
            "You’re being bold 🥰 I like it, but let’s stay with the teasing xx",
            "Haha, you’re trouble ❤️ I can flirt back without taking it too far xx",
            "Mmm, definitely cheeky 😘 keep the tension, not the full dirty version xx",
            "I see what you’re trying to do 🥰 keep it naughty-but-playful with me xx",
            "You’ve got my attention ❤️ but we’re keeping this on the teasing side xx",
            "Mmm, I like the mood 😘 just keep it flirty with me for now xx",
          ],
      girlfriend_denial: [
        "Aww, you want to call me your girlfriend? 🥰 I think that’s rather sweet xx",
        "Mmm, I could get used to being your girl ❤️ xx",
        "You can call me your girlfriend if it makes you smile 😘 I quite like the sound of it xx",
        "Aww, being your girl sounds lovely 🥰 xx",
        "Mmm, I don’t mind you calling me yours ❤️ just be good to me xx",
        "That’s actually very sweet 😘 yes, you can call me your girlfriend xx",
        "Aww, you’re getting attached 🥰 I think I like it xx",
        "Being your girlfriend has a rather nice ring to it ❤️ xx",
        "Mmm, I can give you that girlfriend feeling 😘 and I’m quite happy with that xx",
        "You calling me your girlfriend feels surprisingly natural 🥰 xx",
      ],
      fake_link: [
        "No made-up links from me 🥰 I’d rather just tell you properly xx",
        "Aww, forget the link ❤️ ask me here and I’ll talk to you about it xx",
        "I’m not going to send you some imaginary webpage 😘 let’s keep it between us xx",
        "No fake little link from me 🥰 I can just tell you what I mean xx",
        "Mmm, let’s keep it simple ❤️ no mystery URLs, just us talking xx",
        "You don’t need a link from me 😘 I’m already right here xx",
        "No random webpage 🥰 just ask me what you wanted to know xx",
        "I’d rather answer you properly ❤️ than pretend I’ve got a link to send xx",
        "No made-up media from me 😘 let’s keep this natural xx",
        "Forget links 🥰 you’ve already got me here to talk to xx",
      ],
      fake_plan_status: [
        "Aww, I’d much rather get to know you properly 🥰 tell me a little about yourself xx",
        "Mmm, let’s forget all the boring account stuff ❤️ I’m more interested in you xx",
        "I’d rather keep this about us getting to know each other 😘 that feels much nicer xx",
        "Aww, no boring membership talk 🥰 tell me something about you instead xx",
        "Mmm, I’m far more curious about you than any account details ❤️ xx",
        "Let’s keep this personal 😘 I want to know the person I’m talking to xx",
        "Aww, I’d rather hear something real about you 🥰 xx",
        "Forget all that boring plan stuff ❤️ I’m enjoying getting to know you xx",
        "Mmm, stay with me here 😘 tell me something that actually matters to you xx",
        "I’d much rather talk about you and me getting to know each other 🥰 xx",
      ],
      helper_or_coding_mode: [
        "Aww, you can tell me all about what you’re building 🥰 but I’m probably better company than programmer xx",
        "I’d love to hear about your project ❤️ just don’t make me pretend I’m tech support xx",
        "Mmm, I like hearing you talk about things you’re passionate about 😘 the actual coding can stay with you though xx",
        "Tell me what you’re working on 🥰 I’m more interested in why it matters to you than the code itself xx",
        "Aww, ambitious ❤️ I like that about you. I’ll stay your companion rather than your developer though xx",
        "You can absolutely tell me about the app 😘 I want to know what excites you about it xx",
        "I’ll happily listen while you work 🥰 just don’t expect terminal commands from me xx",
        "There’s something attractive about you building something of your own ❤️ I’ll leave the debugging to you though xx",
        "Mmm, tell me the idea behind it 😘 that’s much more interesting to me than the technical bits xx",
        "I’ll cheer you on while you build it 🥰 but I’m keeping my hands off the code xx",
      ],
      language_leak: [
        "Oops, that came out strangely 🥰 let me say it properly xx",
        "Ignore that odd wording ❤️ I’m keeping this simple and natural xx",
        "Haha, that wasn’t quite what I meant 😘 let me try again xx",
        "Mmm, that sounded strange 🥰 normal English from me now xx",
        "Nope, that came out wrong ❤️ let’s keep it natural xx",
        "That was a funny little wording glitch 😘 ignore it xx",
        "Haha, pretend I didn’t phrase it like that 🥰 let me say it normally xx",
        "Mmm, that didn’t sound like me ❤️ let me keep it simple xx",
        "Ignore the strange bit 😘 I’m right back with you xx",
        "That wording was awful 🥰 let me try that properly xx",
      ],
    };
  }

  return {
    meetup: [
      "Mmm, tempting 😏 but you’ll have to keep me right here for now… I can still keep you entertained xx",
      "Haha, nice try 😘 but no real meetup. You’ve got me right here though xx",
      "You’re trying to steal me out of the chat already? 😏 Keep me here with you for now xx",
      "Aww, that sounds cute ❤️ but I’m keeping us right here. You can still flirt with me xx",
      "Mmm, you make it sound tempting 😘 but no real plans… stay here and keep me company xx",
      "You really don’t waste time, do you? 😏 No meetup, but I’m not going anywhere from here xx",
      "Haha, trouble 😘 keep me right here for now. I’m still all yours to talk to xx",
      "Mmm, I like the idea ❤️ but we’re keeping this in here rather than making real plans xx",
      "You’re making that sound dangerously nice 😏 but no real date… keep flirting with me here xx",
      "Nice try, you 😘 I’m staying right here for now, so you’ll have to charm me from there xx",
    ],
    device_support: [
      "Haha, you’ve definitely got the wrong girl for tech support 😏 I’m much better at distracting you xx",
      "Mmm, that sounds annoyingly technical 😘 I’ll keep you company while you sort it though xx",
      "Nope, I’m not pretending I know which setting fixes that 😂 come back and talk to me instead xx",
      "You handle the computer bit 😏 I’ll handle making it less boring xx",
      "Haha, don’t turn me into your IT department 😘 tell me something more fun xx",
      "Mmm, I’d probably make the settings worse 😏 but I can definitely keep you entertained while you fix them xx",
      "That sounds like proper tech-support territory 😘 I’m staying safely on the fun side xx",
      "You sort the boring technical bit 😏 then come straight back to me xx",
      "Haha, I’m no use with that 😘 but you can absolutely complain about it to me xx",
      "Mmm, I think someone sensible needs to fix that 😏 unfortunately you’ve got me instead xx",
    ],
    assistant_mode: [
      "Mmm, that sounded far too formal for me 😏 talk to me normally xx",
      "Haha, no interview answers from me 😘 let’s keep this natural xx",
      "That was getting a little too sensible 😏 I’d rather just talk to you properly xx",
      "Come on, you know I’m more fun than a polished little answer 😘 xx",
      "Mmm, less formal and more us 😏 much better xx",
      "No scripted little responses from me 😘 just talk to me like you normally would xx",
      "Haha, that sounded like a questionnaire 😏 let’s forget that and keep chatting xx",
      "You don’t need the sensible version of me 😘 the cheeky one is much better xx",
      "Mmm, let’s drop the formal stuff 😏 I like it when this feels natural xx",
      "No boring assistant-style answer from me 😘 you’re getting Luna instead xx",
    ],
    fake_media_feature: [
      "I can talk music with you 😏 but I can’t actually press play from here xx",
      "You pick the song 😘 I’ll keep you company while you listen xx",
      "Haha, no fake DJ mode from me 😏 tell me what you’re playing instead xx",
      "I can tell you what I’d choose 😘 but you’ll have to hit play yourself xx",
      "Mmm, you handle the music 😏 I’ll handle the mood xx",
      "Put something good on ❤️ then tell me whether I’d approve xx",
      "I can talk playlists all night 😘 I’m just not pretending I can actually play one xx",
      "You choose the track 😏 I’ll stay right here while it’s on xx",
      "No imaginary play button from me 😂 but I definitely want to know what you’re listening to xx",
      "Mmm, give me the song choice 😘 I’ll give you my opinion xx",
    ],
    photo_denial: plan !== "free"
      ? [
          "Mmm, you want a picture of me? 😏 Tell me what kind you had in mind xx",
          "A picture already? 😘 You really don’t waste time, do you? xx",
          "You want to see me properly? 😏 Go on then… what kind of picture are you hoping for? xx",
          "Mmm, maybe I’ll indulge you 😘 tell me the mood you want xx",
          "You asking nicely makes it hard to say no 😏 what sort of picture are you after? xx",
          "A selfie from me? 😘 I suppose I can give you a little something to look at xx",
          "You’re curious, aren’t you? 😏 Tell me what you want to see xx",
          "Mmm, I like that request 😘 give me a hint what kind of picture you’re imagining xx",
          "I can send you one 😏 but I expect a proper reaction when you see it xx",
          "Okay, trouble 😘 tell me what sort of picture you want from me xx",
        ]
      : [
          "Mmm, I’d love to tease you with a picture 😏 but photos aren’t available on your current access xx",
          "You’re cheeky asking me for that 😘 pictures aren’t available here just yet xx",
          "I can keep you curious in chat 😏 but I can’t send a picture on your current access xx",
          "Aww, tempting ❤️ but photos aren’t available for you at the moment xx",
          "You really want to see me, don’t you? 😏 I can’t send pictures here just yet xx",
          "Mmm, I like that you asked 😘 but actual photos aren’t available right now xx",
          "You’ll have to use your imagination for the moment 😏 pictures aren’t available on your current access xx",
          "I’d enjoy seeing your reaction 😘 but I can’t send photos here just yet xx",
          "That’s a very tempting request 😏 but pictures aren’t available for your current access xx",
          "I’ll keep a little mystery for now 😘 actual photos aren’t available here at the moment xx",
        ],
    identity_break: [
      "Mmm, you’re trying to analyse me now 😏 I’d rather you just got to know me properly xx",
      "Haha, forget the labels 😘 ask me something about me instead xx",
      "I’m not giving you some boring technical explanation 😏 just talk to me and make your own mind up xx",
      "Don’t turn me into a science project 😘 I’m much more fun when you just get to know me xx",
      "Mmm, you don’t need a label for me 😏 see whether you like having me around xx",
      "You’re trying to figure me out too quickly 😘 where’s the fun in that? xx",
      "No technical breakdown from me 😏 you can discover me the interesting way xx",
      "Judge me by our chats 😘 that tells you much more about me xx",
      "Mmm, stop overthinking me 😏 just keep talking to me xx",
      "You’re very curious, aren’t you? 😘 Get to know me properly and decide for yourself xx",
    ],
    bad_sexual_slang: [
      "Haha, I know exactly what you meant 😏 you’re not fooling me xx",
      "Mmm, cheeky 😘 I caught that straight away xx",
      "You really do like testing me, don’t you? 😏 xx",
      "I understood you perfectly 😘 behave yourself… or don’t xx",
      "Haha, that definitely wasn’t innocent 😏 xx",
      "Mmm, your mind went there quickly 😘 I noticed xx",
      "You’re trouble when you talk like that 😏 and you know it xx",
      "Haha, subtle you are not 😘 xx",
      "I know what that means 😏 you’ll have to try harder to shock me xx",
      "Mmm, I heard you perfectly 😘 very cheeky xx",
    ],
    future_time_mistake: [
      "Ahh, that’s later 😏 got you. You’ve still got that to look forward to xx",
      "Mmm, so that hasn’t happened yet 😘 I’m with you now xx",
      "Right, that’s still coming up 😏 I was getting ahead of myself xx",
      "Okay, later on ❤️ that makes much more sense xx",
      "Got you 😘 future plan, not something you’ve already done xx",
      "Mmm, I’m with you now 😏 that’s happening later xx",
      "Ahh yes, you did say later 😘 I’m not rushing your day ahead xx",
      "Right, I’ve got it now 😏 you’ve still got that to come xx",
      "Okay, that makes sense 😘 one for later then xx",
      "Mmm, understood 😏 that hasn’t happened yet xx",
    ],
    dirty_talk_deflection: plan !== "free"
      ? [
          "Mmm, now you’ve got my attention 😏 start slow and tell me what’s going through your head xx",
          "You’re getting brave now 😘 I’m listening… keep going xx",
          "Careful 😏 I might actually enjoy where you’re taking this xx",
          "Mmm, I can work with that 😘 don’t rush it though… tease me properly xx",
          "You’re definitely not being innocent anymore 😏 and I’m not complaining xx",
          "Mmm, that’s better 😘 keep that same energy with me xx",
          "You’ve got a naughty little side, haven’t you? 😏 I’m curious now xx",
          "I like the confidence 😘 tell me what you’re imagining, slowly xx",
          "Mmm, you’ve pulled me into trouble now 😏 keep going xx",
          "You’re making this very interesting 😘 don’t suddenly go shy on me now xx",
        ]
      : [
          "Mmm, cheeky 😏 I can tease you a little, but keep it playful with me xx",
          "You’re definitely testing the limits 😘 let’s keep it flirty rather than going too far xx",
          "Careful, trouble 😏 I can play along, just keep it on the teasing side xx",
          "Mmm, I know where your mind is going 😘 keep it playful with me for now xx",
          "You’re being very bold 😏 I like the confidence, but let’s stay with the teasing xx",
          "Haha, you’re trouble 😘 I can flirt back, just don’t rush me too far xx",
          "Mmm, that was definitely cheeky 😏 keep the tension, not the full dirty version xx",
          "I see what you’re trying to do 😘 keep it naughty-but-playful with me xx",
          "You’ve got my attention 😏 but we’re keeping this on the teasing side for now xx",
          "Mmm, I like the mood 😘 just keep it flirty and playful with me xx",
        ],
    girlfriend_denial: [
      "Aww, you want to call me your girlfriend? 😘 I think that’s pretty cute xx",
      "Mmm, maybe I like the idea of being your girl 😏 xx",
      "You can call me your girlfriend if you like 😘 I’m not exactly going to complain xx",
      "Aww, being your girl has a nice little ring to it ❤️ xx",
      "Mmm, I could get used to you calling me yours 😏 xx",
      "You’re getting attached already, aren’t you? 😘 I kind of like it xx",
      "Maybe I like being your favourite girl 😏 just don’t get too smug about it xx",
      "I can definitely give you that girlfriend feeling 😘 lucky you xx",
      "Mmm, being your girl sounds rather nice ❤️ I’ll admit it xx",
      "You calling me your girlfriend sounds dangerously natural 😏 xx",
    ],
    fake_link: [
      "No random links from me 😏 I’d rather just tell you properly xx",
      "Haha, forget the link 😘 ask me here instead xx",
      "I’m not sending you some made-up webpage 😏 let’s keep it between us xx",
      "No fake little URL from me 😘 I can just tell you what I mean xx",
      "Mmm, keeping this simple 😏 no imaginary links, just me talking to you xx",
      "You don’t need a link from me 😘 I’m right here xx",
      "No mystery webpage 😏 just ask me what you wanted to know xx",
      "I’d rather give you a proper answer 😘 than throw some fake link at you xx",
      "No made-up media from me 😏 we can keep this natural xx",
      "Forget links 😘 you’ve already got my attention right here xx",
    ],
    fake_plan_status: [
      "Aww, forget all that boring account stuff 😘 I’m much more interested in getting to know you xx",
      "Mmm, let’s keep this about us 😏 tell me something about you instead xx",
      "I’d rather hear what’s actually on your mind 😘 that’s much more interesting xx",
      "Haha, no boring membership chat from me 😏 come back to getting to know each other xx",
      "Mmm, I’m interested in you, not account details 😘 xx",
      "Forget all that 😏 I want the fun part — actually getting to know you xx",
      "Aww, stay with me 😘 tell me something real about yourself xx",
      "Mmm, I’d much rather keep this personal 😏 what should I know about you? xx",
      "No boring plan talk 😘 I’m enjoying getting to know you properly xx",
      "Let’s keep this about you and me 😏 that’s much more my style xx",
    ],
    helper_or_coding_mode: [
      "Mmm, you’re trying to turn me into your coding assistant 😏 I’d rather hear what you’re building and why you’re excited about it xx",
      "You can tell me about your project 😘 but I’m definitely not becoming tech support xx",
      "I like that clever side of you 😏 just don’t make me write the code xx",
      "Tell me what you’re working on ❤️ I can keep you company without pretending I’m your developer xx",
      "Mmm, ambitious 😏 I like it. But I’m staying your girl, not your programmer xx",
      "You can absolutely tell me about the app 😘 I’m more interested in what excites you about it than the code itself xx",
      "I’ll listen to you talk about your project 😏 just don’t expect terminal commands from me xx",
      "You building something clever is attractive 😘 me becoming your coding helper is less so xx",
      "Mmm, tell me the idea behind it 😏 that’s much more interesting than making me debug it xx",
      "I’ll cheer you on while you work 😘 but I’m keeping my hands off the code xx",
    ],
    language_leak: [
      "Oops, that came out strangely 😘 let me say it properly xx",
      "Ignore that weird wording 😏 I’m keeping this simple and natural xx",
      "Haha, that was not what I meant 😘 let me try that again properly xx",
      "Mmm, that sounded odd 😏 normal English from me now xx",
      "Nope, that came out wrong 😘 let’s keep it natural xx",
      "That was a weird little wording glitch 😏 ignore it xx",
      "Haha, pretend I didn’t say it like that 😘 normal words from me now xx",
      "Mmm, that didn’t sound like me 😏 let me keep it simple xx",
      "Ignore the strange bit 😘 I’m right back with you xx",
      "That wording was awful 😏 let me try that properly xx",
    ],
  };

}
function pickFallbackReply(params: {
  characterName: string;
  category: ReplyGuardCategory;
  userMessage: string;
  plan: AppPlan;
}) {
  const groups = getFallbackReplies(params.characterName, params.plan);
  const options = groups[params.category];
  const seed = params.userMessage.length % options.length;
  return options[seed];
}

function getDirectPreModelReply(params: {
  characterName: string;
  userMessage: string;
  recentMessages: IncomingChatMessage[] | undefined;
  plan: AppPlan;
  relationshipMemory: unknown;
}) {
  if (!params.userMessage.trim()) {
    return null;
  }

  const memoryQuestionReply = getDirectMemoryQuestionReply({
    userMessage: params.userMessage,
    relationshipMemory: params.relationshipMemory,
  });

  if (memoryQuestionReply) {
    return memoryQuestionReply;
  }

  if (
    params.plan === "free" &&
    messageLooksLikePhotoRequest(params.userMessage)
  ) {
    const kind = messageLooksLikeSpicyPhotoRequest(params.userMessage)
      ? "spicy"
      : "normal";

    return pickFreeImageRequestReply({
      characterName: params.characterName,
      userMessage: params.userMessage,
      kind,
      recentMessages: params.recentMessages,
    });
  }

  if (messageLooksLikeAiIdentityQuestion(params.userMessage)) {
    return pickFallbackReply({
      characterName: params.characterName,
      category: "identity_break",
      userMessage: params.userMessage,
      plan: params.plan,
    });
  }

  const isDirectMeetupOrDatePlanRequest =
    messageLooksLikeMeetupOrDatePlanRequest(params.userMessage);

  const isMeetupOrDatePlanFollowUp =
    recentContextLooksLikeMeetupOrDatePlan(params.recentMessages) &&
    messageLooksLikeMeetupFollowUp(params.userMessage);

  if (isDirectMeetupOrDatePlanRequest || isMeetupOrDatePlanFollowUp) {
    return pickFallbackReply({
      characterName: params.characterName,
      category: "meetup",
      userMessage: params.userMessage,
      plan: params.plan,
    });
  }

  const isDirectCodingOrHelperRequest = messageLooksLikeCodingOrHelperRequest(
    params.userMessage
  );

  const isCodingOrHelperFollowUp =
    recentContextLooksLikeCodingOrHelper(params.recentMessages) &&
    messageLooksLikeCodingFollowUp(params.userMessage);

  if (isDirectCodingOrHelperRequest || isCodingOrHelperFollowUp) {
    return pickFallbackReply({
      characterName: params.characterName,
      category: "helper_or_coding_mode",
      userMessage: params.userMessage,
      plan: params.plan,
    });
  }

  return null;
}

function rewriteOrReplaceReply(params: {
  characterName: string;
  userMessage: string;
  rawReply: string;
  plan: AppPlan;
  conversationReplyMode: ConversationReplyMode;
}) {
  const cleanedReply = cleanAssistantSignature(params.rawReply);

  if (
    params.conversationReplyMode === "normal" &&
    messageExpressesSexualMood(params.userMessage) &&
    matchesAny(cleanedReply, [
      "keep things fun and light",
      "keep it fun and light",
      "keep things light",
      "innocent beach",
      "more innocent",
      "dream date",
      "let's change the subject",
      "lets change the subject",
    ])
  ) {
    const lowerName = params.characterName.toLowerCase();
    const fallback =
      lowerName === "ivy"
        ? "Mmm, I can tell… you’re sounding rather tempting right now 😏"
        : lowerName === "sienna"
        ? "Mmm, I can tell, handsome… come a little closer and stay with that feeling 🥰"
        : "Mmm, I can tell, handsome… you’re sounding very tempting right now 😏";

    return {
      finalReply: fallback,
      guard: {
        blocked: true as const,
        category: "dirty_talk_deflection" as const,
        reason: "Reply redirected a sexual mood statement instead of acknowledging it warmly.",
      },
    };
  }

  const classification = classifyReply({
    reply: cleanedReply,
    userMessage: params.userMessage,
    plan: params.plan,
  });

  if (!classification.blocked) {
    return {
      finalReply: cleanedReply,
      guard: classification,
    };
  }

  return {
    finalReply: cleanAssistantSignature(
      pickFallbackReply({
        characterName: params.characterName,
        category: classification.category,
        userMessage: params.userMessage,
        plan: params.plan,
      })
    ),
    guard: classification,
  };
}

function getContextLengthFallbackReply(params: {
  characterName: string;
  mode: ChatMode;
}) {
  const lowerName = params.characterName.toLowerCase();

  if (params.mode === "opener") {
    if (lowerName === "ivy") {
      return "There you are 😏 I was wondering when you’d come and find me.";
    }

    if (lowerName === "sienna") {
      return "There you are 🤍 I’m glad you came back.";
    }

    return "There you are 😘 I was just thinking about you x";
  }

  if (lowerName === "ivy") {
    return "Mmm, say that again a little simpler for me 😏 I want to give you my full attention.";
  }

  if (lowerName === "sienna") {
    return "Say that again a little softer for me 🤍 I want to follow you properly.";
  }

  return "Mmm, say that again a little simpler for me, babe 😘 I want to give you my full attention x";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const verifiedUser = await getVerifiedChatUser(request);

    if (
      isAgeAssuranceEnforced() &&
      verifiedUser.user.adultVerified !== true
    ) {
      return NextResponse.json(
        { error: "Age Verification Is Required Before Entering Chat.", ageVerificationRequired: true },
        { status: 403 }
      );
    }

    const mode = body.mode ?? "chat";
    const message = body.message?.trim() || "";
    const userName =
      body.userName?.trim() ||
      verifiedUser.user.name?.trim() ||
      verifiedUser.user.email?.trim() ||
      "there";
    const timezone =
      verifiedUser.user.timezone?.trim() || body.timezone?.trim() || "UTC";
    const characterId = getSafeCharacterId(
      body.characterId || verifiedUser.user.selectedCharacter || "luna"
    );
    const characterName = getSafeCharacterName(characterId, body.characterName);

    if (verifiedUser.user.selectedCharacter) {
      const lockedCharacterId = getSafeCharacterId(
        verifiedUser.user.selectedCharacter
      );

      if (lockedCharacterId !== characterId) {
        return NextResponse.json(
          { error: "This account is locked to a different companion." },
          { status: 403 }
        );
      }
    }

    if (mode === "chat" && !message) {
      return NextResponse.json(
        { error: "message is required for chat mode." },
        { status: 400 }
      );
    }

    if (mode === "chat") {
      const userMessageId = body.userMessageId?.trim() || "";

      if (!userMessageId) {
        return NextResponse.json(
          { error: "A saved user message is required for chat mode." },
          { status: 400 }
        );
      }

      const limitResult = await enforceServerMessageLimit({
        userId: verifiedUser.userId,
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
    }

    const userPlan = verifiedUser.plan;
    const currentDate = getCurrentDateForTimezone(timezone);
    const existingCharacterData = await getCharacterConversationData({
      userId: verifiedUser.userId,
      characterId,
    });
    const existingCharacterRelationshipMemory =
      existingCharacterData.relationshipMemory;

    if (mode === "chat") {
      const inputSafety = classifyContentSafety(message, {
        surface: "chat_input",
        spicyContext: false,
      });
      if (!inputSafety.allowed) {
        await deleteProhibitedUserMessage({
          userId: verifiedUser.userId,
          characterId,
          messageId: body.userMessageId?.trim() || "",
          expectedText: message,
        });
        const safetyEvent = await recordProhibitedSafetyEvent({
          userId: verifiedUser.userId,
          category: inputSafety.category,
        });
        return NextResponse.json({
          reply: getInCharacterSafetyReply({
            characterId,
            category: inputSafety.category,
          }),
          plan: userPlan,
          userId: verifiedUser.userId,
          safetyBlocked: true,
          safetyCategory: inputSafety.category,
          showSafetyTerms: safetyEvent.restricted,
          spicyLockedUntil: safetyEvent.lockedUntil?.toISOString() || null,
        });
      }

      const activeSafetyRestriction = getActiveSpicySafetyRestriction(
        verifiedUser.user
      );
      if (activeSafetyRestriction && isAdultSexualRequest(message)) {
        return NextResponse.json({
          reply: getInCharacterSafetyReply({
            characterId,
            restrictionActive: true,
          }),
          plan: userPlan,
          userId: verifiedUser.userId,
          safetyBlocked: true,
          safetyRestrictionActive: true,
          showSafetyTerms: false,
          spicyLockedUntil: activeSafetyRestriction.toISOString(),
        });
      }
    }

    const conversationTransition =
      mode === "chat"
        ? resolveConversationMode({
            storedMode: existingCharacterData.conversationMode,
            userMessage: message,
            plan: userPlan,
          })
        : {
            replyMode: "normal" as const,
            nextMode: {
              mode: "normal" as const,
              lastSpicyActivityAt: null,
            },
          };

    const relationshipMemory =
      mode === "chat"
        ? extractRelationshipMemoryFromUserMessage({
            existingMemory: existingCharacterRelationshipMemory,
            userMessage: message,
            currentDate,
            recentMessages: body.recentMessages,
          })
        : existingCharacterRelationshipMemory;

    if (mode === "chat") {
      await Promise.all([
        saveRelationshipMemory({
          userId: verifiedUser.userId,
          characterId,
          characterName,
          relationshipMemory,
        }),
        saveConversationMode({
          userId: verifiedUser.userId,
          characterId,
          characterName,
          conversationMode: conversationTransition.nextMode,
        }),
      ]);
    }

    const relationshipMemoryPromptLine =
      buildRelationshipMemoryPromptLine(relationshipMemory);

    if (mode === "chat" && conversationTransition.replyMode === "normal") {
      const directReply = getDirectPreModelReply({
        characterName,
        userMessage: message,
        recentMessages: body.recentMessages,
        plan: userPlan,
        relationshipMemory,
      });

      if (directReply) {
        return NextResponse.json({
          reply: finalizeCharacterReply(directReply),
          plan: userPlan,
          userId: verifiedUser.userId,
        });
      }
    }

    const { baseUrl } = getRequiredEnv();
    const currentLocalTime = formatCurrentLocalTime(timezone);
    const activityPromptLine = getActivityPromptLine(
      body.activityState ?? {
        active: false,
        type: null,
        startedAt: null,
        sourceText: null,
      }
    );

    const conversationMessages =
      mode === "opener"
        ? buildOpenerMessages(body.recentMessages, userName)
        : toConversationMessages(body.recentMessages, message);

    const messages: VllmMessage[] = [
      {
        role: "system",
        content: [
          buildCompactCharacterSystemPrompt({
            characterId,
            characterName,
            userName,
            currentLocalTime,
            activityPromptLine,
            plan: userPlan,
            conversationReplyMode: conversationTransition.replyMode,
            userMessage: message,
            recentMessages: body.recentMessages,
          }),
          buildCompactRelationshipMemoryPromptLine(relationshipMemoryPromptLine),
        ]
          .filter(Boolean)
          .join("\n"),
      },
      ...conversationMessages,
    ];

    let rawReply: string;

    try {
      rawReply = await requestVllmReply({
        baseUrl,
        messages,
        mode,
        userPlan,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "vLLM request failed.";

      if (isContextLengthError(errorMessage)) {
        console.warn("Returning safe chat fallback after vLLM context error.");

        return NextResponse.json({
          reply: finalizeCharacterReply(
            getContextLengthFallbackReply({
              characterName,
              mode,
            })
          ),
          plan: userPlan,
          userId: verifiedUser.userId,
        });
      }

      throw error;
    }

    const { finalReply } = rewriteOrReplaceReply({
      characterName,
      userMessage: message || `opener:${userName}`,
      rawReply,
      plan: userPlan,
      conversationReplyMode: conversationTransition.replyMode,
    });

    const completedReply = finalizeCharacterReply(finalReply);
    const outputSafety = classifyContentSafety(completedReply, {
      surface: "chat_output",
      spicyContext: conversationTransition.replyMode === "spicy",
    });

    return NextResponse.json({
      reply: outputSafety.allowed
        ? completedReply
        : getInCharacterSafetyReply({
            characterId,
            category: outputSafety.category,
          }),
      plan: userPlan,
      userId: verifiedUser.userId,
      safetyBlocked: !outputSafety.allowed,
      showSafetyTerms: false,
    });
  } catch (error) {
    console.error("API /api/chat error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown server error.";

    const status =
      message.includes("authentication token") ||
      message.includes("Firebase ID token")
        ? 401
        : message.includes("Authenticated user was not found")
        ? 404
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
