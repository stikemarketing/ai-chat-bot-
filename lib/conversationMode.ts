import type { AppPlan } from "@/lib/plans";

export const SPICY_INACTIVITY_TIMEOUT_MS = 45 * 60 * 1000;

export type StoredConversationMode = {
  mode: "normal" | "spicy";
  lastSpicyActivityAt: string | null;
};

export type ConversationReplyMode =
  | "normal"
  | "spicy"
  | "cooldown"
  | "spicy_locked";

type TimestampLike = {
  toMillis?: () => number;
  toDate?: () => Date;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function timestampToMillis(value: unknown): number | null {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (value && typeof value === "object") {
    const timestamp = value as TimestampLike;

    if (typeof timestamp.toMillis === "function") {
      return timestamp.toMillis();
    }

    if (typeof timestamp.toDate === "function") {
      return timestamp.toDate().getTime();
    }
  }

  return null;
}

export function normalizeStoredConversationMode(
  value: unknown
): StoredConversationMode {
  if (!value || typeof value !== "object") {
    return { mode: "normal", lastSpicyActivityAt: null };
  }

  const raw = value as Record<string, unknown>;
  const lastSpicyActivityMs = timestampToMillis(raw.lastSpicyActivityAt);

  return {
    mode: raw.mode === "spicy" ? "spicy" : "normal",
    lastSpicyActivityAt:
      lastSpicyActivityMs === null
        ? null
        : new Date(lastSpicyActivityMs).toISOString(),
  };
}

export function messageExplicitlyRequestsSpicyChat(message: string) {
  const text = normalizeText(message);
  const requestPatterns = [
    /\bdirty talk\b/,
    /\btalk dirty(?: to me)?\b/,
    /\btalk naughty(?: to me)?\b/,
    /\bspicy (?:chat|talk)\b/,
    /\bget (?:dirty|naughty|spicy) with me\b/,
    /\bbe (?:dirty|naughty) with me\b/,
    /\bsay something (?:dirty|naughty|spicy)\b/,
    /\bi want (?:some )?(?:dirty talk|spicy talk|spicy chat)\b/,
    /\bturn (?:this|the chat) (?:dirty|naughty|spicy)\b/,
  ];

  return requestPatterns.some((pattern) => pattern.test(text));
}

export function messageExpressesSexualMood(message: string) {
  const text = normalizeText(message);

  return [
    /\b(?:horny|turned on|turning me on|worked up)\b/,
    /\b(?:touching|playing with|pleasuring) myself\b/,
  ].some((pattern) => pattern.test(text));
}

export function messageEndsSpicyChat(message: string) {
  const text = normalizeText(message);
  const endPatterns = [
    /\bi(?:'m| am| have|'ve)? (?:finished|done)\b/,
    /\bi (?:finished|came|have cum|just came)\b/,
    /\b(?:all|we are|we're) done\b/,
    /\b(?:stop|that's enough|that is enough|no more)\b/,
    /\b(?:slow down|calm down|cool down)\b/,
    /\b(?:back to normal|normal chat|change (?:the )?subject)\b/,
  ];

  return endPatterns.some((pattern) => pattern.test(text));
}

export function messageContinuesSpicyChat(message: string) {
  const text = normalizeText(message);

  if (!text) {
    return false;
  }

  const shortContinuations = new Set([
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
    "don't stop",
    "dont stop",
    "i like that",
    "i love that",
    "that feels good",
    "that sounds good",
    "good girl",
    "good boy",
  ]);

  if (shortContinuations.has(text)) {
    return true;
  }

  const continuationPatterns = [
    /\b(?:horny|turned on|turning me on|worked up|hard)\b/,
    /\b(?:touching|playing with|pleasuring) myself\b/,
    /\b(?:dirty|naughty|spicy|sexual|sex|naked)\b/,
    /\b(?:kiss|kissing|touch|tease|teasing|moan|finish|cum)\b/,
    /\b(?:good girl|good boy|bad girl|bad boy)\b/,
    /\bwhat (?:would|will) you do(?: next)?\b/,
    /\btell me what you (?:want|like|would do)\b/,
    /\bi (?:want|would|will|am|i'm|like|love)\b.*\b(?:you|that|it)\b/,
  ];

  return continuationPatterns.some((pattern) => pattern.test(text));
}

export function resolveConversationMode(params: {
  storedMode: unknown;
  userMessage: string;
  plan: AppPlan;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const stored = normalizeStoredConversationMode(params.storedMode);
  const lastActivityMs = timestampToMillis(stored.lastSpicyActivityAt);
  const isActive =
    stored.mode === "spicy" &&
    lastActivityMs !== null &&
    now.getTime() - lastActivityMs < SPICY_INACTIVITY_TIMEOUT_MS;

  if (messageEndsSpicyChat(params.userMessage)) {
    return {
      replyMode: isActive ? ("cooldown" as const) : ("normal" as const),
      nextMode: { mode: "normal", lastSpicyActivityAt: null } satisfies StoredConversationMode,
    };
  }

  if (messageExplicitlyRequestsSpicyChat(params.userMessage)) {
    if (params.plan === "free") {
      return {
        replyMode: "spicy_locked" as const,
        nextMode: { mode: "normal", lastSpicyActivityAt: null } satisfies StoredConversationMode,
      };
    }

    return {
      replyMode: "spicy" as const,
      nextMode: {
        mode: "spicy",
        lastSpicyActivityAt: now.toISOString(),
      } satisfies StoredConversationMode,
    };
  }

  if (isActive && messageContinuesSpicyChat(params.userMessage)) {
    return {
      replyMode: "spicy" as const,
      nextMode: {
        mode: "spicy",
        lastSpicyActivityAt: now.toISOString(),
      } satisfies StoredConversationMode,
    };
  }

  if (isActive) {
    return {
      replyMode: "cooldown" as const,
      nextMode: { mode: "normal", lastSpicyActivityAt: null } satisfies StoredConversationMode,
    };
  }

  return {
    replyMode: "normal" as const,
    nextMode: { mode: "normal", lastSpicyActivityAt: null } satisfies StoredConversationMode,
  };
}

export function buildConversationModePromptLine(mode: ConversationReplyMode) {
  if (mode === "spicy") {
    return [
      "Conversation mode: SPICY.",
      "The adult user explicitly requested dirty talk and is still participating. Stay engaged with the current intimate context.",
      "React confidently to what the user says, encourage them, agree naturally, or ask at most one short relevant question.",
      "Do not cool the conversation down, redirect to an innocent subject, restart the build-up, mention rules, or ask whether they want to keep it light.",
      "Dirty talk is a text-conversation request. Never offer, send, or mention an image unless the user separately and explicitly asks for a picture, photo, image, selfie, or snap.",
      "You may say the user is turning you on or that you enjoy the fantasy, but do not graphically claim that you are performing a physical sexual act on yourself.",
    ].join("\n");
  }

  if (mode === "cooldown") {
    return [
      "Conversation mode: COOLDOWN TO NORMAL.",
      "The spicy conversation has ended because the user finished, stopped, or changed the subject.",
      "Give one brief affectionate acknowledgement such as saying they got you worked up or that you hope they had fun, then follow the user's new subject naturally if one was provided.",
      "Return immediately to normal loving girlfriend chat with a flirty undertone. Do not restart dirty talk.",
    ].join("\n");
  }

  if (mode === "spicy_locked") {
    return [
      "Conversation mode: SPICY ACCESS NOT INCLUDED.",
      "The user asked for dirty talk, but this chat does not include full spicy conversation.",
      "Reply warmly and flirtatiously without explicit detail. Mention the available upgrade only once and do not sound like customer support.",
    ].join("\n");
  }

  return [
    "Conversation mode: NORMAL GIRLFRIEND CHAT.",
    "Keep a warm flirty undertone, but do not initiate dirty talk or introduce explicit sexual content.",
    "If the user says they are horny, turned on, or worked up without requesting dirty talk, warmly acknowledge and lightly tease that mood without activating full spicy chat.",
    "Never respond to that mood by saying to keep things fun and light, suggesting an innocent alternative, proposing a dream date, or changing the subject.",
  ].join("\n");
}
