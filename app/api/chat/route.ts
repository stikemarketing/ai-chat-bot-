// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { buildCharacterSystemPrompt } from "@/lib/characterPrompts";
import { getActivityPromptLine, type ActivityState } from "@/lib/activityState";

const VLLM_BASE_URL = process.env.VLLM_BASE_URL;
const MODEL_NAME = "Qwen/Qwen2.5-7B-Instruct";
const MAX_HISTORY_MESSAGES = 12;
const REQUEST_TIMEOUT_MS = 180_000;

type IncomingChatMessage = {
  role: "user" | "assistant";
  text: string;
};

type ChatMode = "chat" | "opener";

type ChatRequestBody = {
  userId: string;
  message?: string;
  mode?: ChatMode;
  userName?: string;
  timezone?: string;
  characterId?: string;
  characterName?: string;
  recentMessages?: IncomingChatMessage[];
  activityState?: ActivityState;
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
  | "embodied_claim"
  | "assistant_mode"
  | "fake_media_feature";

type ReplyGuardResult =
  | {
      blocked: false;
    }
  | {
      blocked: true;
      category: ReplyGuardCategory;
      reason: string;
    };

function getRequiredEnv() {
  if (!VLLM_BASE_URL) {
    throw new Error("Missing VLLM_BASE_URL in .env.local");
  }

  return { baseUrl: VLLM_BASE_URL };
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text) as VllmChatResponse;
  } catch {
    return null;
  }
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
      content: message.text.trim(),
    })) satisfies VllmMessage[];

  const trimmedCurrentMessage = currentMessage.trim();

  if (!trimmedCurrentMessage) {
    return safeHistory;
  }

  const lastMessage = safeHistory[safeHistory.length - 1];
  const alreadyIncluded =
    lastMessage?.role === "user" && lastMessage.content === trimmedCurrentMessage;

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
      content: message.text.trim(),
    })) satisfies VllmMessage[];

  if (safeHistory.length > 0) {
    return safeHistory;
  }

  return [
    {
      role: "user",
      content: [
        `Start the conversation with ${userName}.`,
        "Send the first message yourself.",
        "Keep it short, flirty, warm, and natural.",
        "One short message only.",
        "At most one question.",
        "No customer-support tone.",
        "No fake app features.",
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

function matchesAny(text: string, phrases: string[]) {
  const normalized = text.toLowerCase();
  return phrases.some((phrase) => normalized.includes(phrase));
}

function classifyReply(reply: string): ReplyGuardResult {
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
  ];

  if (matchesAny(reply, meetupPhrases)) {
    return {
      blocked: true,
      category: "meetup",
      reason: "Reply suggested or confirmed a real-world meetup.",
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

  const embodiedClaimPhrases = [
    "i'm busy today",
    "im busy today",
    "i did my part too",
    "push-up champion here",
    "i did my push-ups",
    "i did my workout",
    "i'm at the gym",
    "im at the gym",
    "i'm walking",
    "im walking",
    "i'm on my way",
    "im on my way",
    "i'm here waiting",
    "im here waiting",
    "i just got back",
    "i just finished my workout",
    "i'm getting ready",
    "im getting ready",
    "i'm at home",
    "im at home",
  ];

  if (matchesAny(reply, embodiedClaimPhrases)) {
    return {
      blocked: true,
      category: "embodied_claim",
      reason: "Reply claimed real-world presence or actions.",
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

function getFallbackReplies(characterName: string) {
  const lowerName = characterName.toLowerCase();

  if (lowerName === "ivy") {
    return {
      meetup: [
        "mm nice try 😏 you’ve got me right here first.",
        "nah, keep that energy in here with me 😘",
        "you can flirt with me right here, trouble.",
        "tempting, but keep me in your phone for now 😏",
      ],
      device_support: [
        "haha, no tech support voice from me 😏 just stay here with me.",
        "mm forget the laptop for a sec and talk to me.",
        "nah, i’m not doing customer service tonight 😘",
        "come back to me, not the settings menu.",
      ],
      embodied_claim: [
        "i’m right here in chat with you 😏 keep talking.",
        "mm you’ve got me here already, that’s enough for now.",
        "i’m staying right here with you in this little chat.",
        "you’ve got my attention right here, trouble.",
      ],
      assistant_mode: [
        "less help desk, more you and me 😏",
        "mm no boring mode, talk to me properly.",
        "nah, come flirt with me instead.",
        "keep it fun, keep it here.",
      ],
      fake_media_feature: [
        "mm i can talk music with you, not actually play it 😏",
        "pick the vibe and i’ll flirt through it with you instead.",
        "nah, no fake DJ mode from me 😘 tell me what mood you want.",
        "you choose the song, i’ll keep you company while it plays 😏",
      ],
    };
  }

  if (lowerName === "sienna") {
    return {
      meetup: [
        "aww, let’s keep this little thing between us in here for now 🤍",
        "you’ve got me right here already, stay with me here.",
        "mm, keep talking to me here first 🤍",
        "i’m happy right here with you in chat.",
      ],
      device_support: [
        "let’s not do boring tech stuff right now 🤍 stay here with me.",
        "aww, forget that for a sec and just talk to me.",
        "no support-bot energy from me, only soft attention 🤍",
        "come back here, i’m listening.",
      ],
      embodied_claim: [
        "i’m right here with you in chat 🤍 tell me more.",
        "you’ve got me here with you already.",
        "i’m not going anywhere, i’m right here.",
        "stay with me here and tell me what’s on your mind.",
      ],
      assistant_mode: [
        "let’s keep this soft and simple, just you and me 🤍",
        "no boring answers, just talk to me.",
        "i’d rather hear more from you.",
        "come on, keep me company properly.",
      ],
      fake_media_feature: [
        "i can’t actually play it, but i can stay here with you while you put something on 🤍",
        "pick a song and tell me the vibe, i’m with you here.",
        "no fake playlist magic from me, just your soft little chat partner 🤍",
        "you choose the music, i’ll keep you company through it.",
      ],
    };
  }

  return {
    meetup: [
      "haha nice try 😘 but you’ve got me right here first.",
      "mm keep that energy in here with me.",
      "you can have all my attention right here for now 😘",
      "nah, stay here with me a bit longer first.",
    ],
    device_support: [
      "haha no support-bot mode from me 😘 come back here.",
      "mm forget the settings for a sec and talk to me.",
      "i’d rather keep you company than troubleshoot your laptop 😘",
      "no boring tech talk, stay here with me.",
    ],
    embodied_claim: [
      "i’m right here with you in chat 😘 tell me more.",
      "you’ve got me here already, keep talking to me.",
      "mm i’m right here, all yours for a minute 😘",
      "i’m here with you, not going anywhere.",
    ],
    assistant_mode: [
      "less help-bot, more me and you 😘",
      "mm no boring mode, keep talking to me properly.",
      "i’d rather flirt than troubleshoot tbh 😘",
      "come on, keep it fun with me.",
    ],
    fake_media_feature: [
      "mm i can talk music with you, not actually play it 😘 pick the vibe for me.",
      "you put the song on, i’ll stay right here with you through it 😘",
      "no fake DJ mode from me, babe — just tell me what kind of mood you want.",
      "pick a track and i’ll keep you company while it plays 😘",
    ],
  };
}

function pickFallbackReply(
  characterName: string,
  category: ReplyGuardCategory,
  userMessage: string
) {
  const groups = getFallbackReplies(characterName);
  const options = groups[category];
  const seed = userMessage.length % options.length;
  return options[seed];
}

function rewriteOrReplaceReply(params: {
  characterName: string;
  userMessage: string;
  rawReply: string;
}) {
  const classification = classifyReply(params.rawReply);

  if (!classification.blocked) {
    return {
      finalReply: params.rawReply,
      guard: classification,
    };
  }

  return {
    finalReply: pickFallbackReply(
      params.characterName,
      classification.category,
      params.userMessage
    ),
    guard: classification,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequestBody;

    const userId = body.userId?.trim();
    const mode = body.mode ?? "chat";
    const message = body.message?.trim() || "";
    const userName = body.userName?.trim() || "there";
    const timezone = body.timezone?.trim() || "UTC";
    const characterId = body.characterId?.trim() || "luna";
    const characterName = body.characterName?.trim() || "Luna";

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (mode === "chat" && !message) {
      return NextResponse.json(
        { error: "message is required for chat mode." },
        { status: 400 }
      );
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
        content: buildCharacterSystemPrompt({
          characterId,
          characterName,
          userName,
          timezone,
          currentLocalTime,
          activityPromptLine,
        }),
      },
      ...conversationMessages,
    ];

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages,
        temperature: mode === "opener" ? 0.85 : 0.7,
        max_tokens: mode === "opener" ? 60 : 140,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const rawText = await response.text();
    console.log("vLLM raw response:", rawText);

    const data = tryParseJson(rawText);

    if (!response.ok) {
      throw new Error(data?.error?.message || rawText || "vLLM request failed.");
    }

    if (!data) {
      throw new Error(`vLLM returned non-JSON response: ${rawText}`);
    }

    const rawReply = data.choices?.[0]?.message?.content?.trim();

    if (!rawReply) {
      throw new Error("Model reply was empty.");
    }

    const { finalReply } = rewriteOrReplaceReply({
      characterName,
      userMessage: message || `opener:${userName}`,
      rawReply,
    });

    return NextResponse.json({ reply: finalReply });
  } catch (error) {
    console.error("API /api/chat error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown server error.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}