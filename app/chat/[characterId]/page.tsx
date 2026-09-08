"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { characters } from "@/lib/characters";
import { auth } from "@/firebase/config";
import {
  clearUser,
  getUserWithFirestoreFallback,
  waitForFirebaseAuthUser,
  type StoredUser,
} from "@/lib/user";
import {
  recordUserChatActivity,
  recordUserChatOpened,
} from "@/firebase/users";
import {
  countMessagesFromFirestore,
  enforceMessageLimitWithServer,
  getMessagesFromFirestore,
  saveMessageToFirestore,
  type ChatMessage,
} from "@/firebase/messages";
import {
  getEmptyActivityState,
  updateActivityState,
  type ActivityState,
} from "@/lib/activityState";
import {
  getMessageLimitForPlan,
  hasReachedMessageLimit,
  normalizePlan,
  type AppPlan,
} from "@/lib/plans";
import TypingBubble from "@/components/TypingBubble";
import { getFreeImageReply } from "@/lib/freeImageReplies";
import { getImageLimitReply } from "@/lib/imageLimitReplies";
import { getWelcomeOpener } from "@/lib/welcomeOpeners";
import SafetyTermsModal from "@/components/SafetyTermsModal";

const ASSISTANT_TYPING_DELAY_MS = 8000;
const ASSISTANT_MESSAGE_DELAY_MS = 8000;
const OPENER_TYPING_DELAY_MS = 8000;
const OPENER_MESSAGE_DELAY_MS = 8000;
const MAX_RECENT_MESSAGES_FOR_MODEL = 6;
const CHAT_REQUEST_TIMEOUT_MS = 180_000;
const BUSY_STATE_RECOVERY_MS = 210_000;

type ChatApiResponse = {
  reply?: string;
  error?: string;
  safetyBlocked?: boolean;
  showSafetyTerms?: boolean;
  spicyLockedUntil?: string | null;
};

type ImageGenerateApiResponse = {
  ok?: boolean;
  imageUrl?: string;
  error?: string;
  upgradeRequired?: boolean;
  paymentRequired?: boolean;
  imageKind?: "normal" | "spicy";
  plan?: "free" | "pro" | "unlimited";
  dailyLimit?: number | null;
  remainingToday?: number | null;
  paidNormalImageCredits?: number;
  reply?: string;
  safetyBlocked?: boolean;
  showSafetyTerms?: boolean;
  spicyLockedUntil?: string | null;
};

type ImageUsageApiResponse = {
  plan?: "free" | "pro" | "unlimited";
  normalRemaining?: number | null;
  spicyRemaining?: number | null;
  error?: string;
};

type ApiRecentMessage = {
  role: "user" | "assistant";
  text: string;
};

const characterImages: Record<string, string> = {
  luna: "/companions/luna-main.png",
  ivy: "/companions/ivy-main.png",
  sienna: "/companions/sienna-main.png",
};

const quickEmojis = ["😘", "😊", "🥰", "❤️", "😉", "🔥", "💋", "✨", "😍", "🙈"];

const MAX_CONSECUTIVE_IMAGE_REQUESTS = 3;
const IMAGE_COOLDOWN_CHAT_TURNS = 2;

type ImageCooldownKind = "normal" | "spicy";

type ImageCooldownState = {
  normalImageStreak: number;
  spicyImageStreak: number;
  normalTextTurnsAfterBlock: number;
  spicyTextTurnsAfterBlock: number;
};

function getEmptyImageCooldownState(): ImageCooldownState {
  return {
    normalImageStreak: 0,
    spicyImageStreak: 0,
    normalTextTurnsAfterBlock: 0,
    spicyTextTurnsAfterBlock: 0,
  };
}

const directImageRequests = [
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

const imageNouns =
  "(pic|pics|picture|pictures|photo|photos|image|images|selfie|selfies|snap|snaps)";

const imageRequestPatterns = [
  new RegExp(`\\b(send|show|share|give|drop)\\b.*\\b${imageNouns}\\b`),
  new RegExp(
    `\\b(can|could|would|will)\\s+(you|u)\\b.*\\b(send|show|share|give)\\b.*\\b${imageNouns}\\b`
  ),
  new RegExp(
    `\\b(can|could|may)\\s+i\\b.{0,50}\\b(see|have|get)\\b.{0,80}\\b${imageNouns}\\b`
  ),
  new RegExp(
    `\\b(i\\s+want|i\\s+would\\s+like|id\\s+like|i'd\\s+like)\\b.{0,60}\\b(see|have|get)\\b.{0,80}\\b${imageNouns}\\b`
  ),
  new RegExp(
    `\\b(see|show)\\b.{0,60}\\b${imageNouns}\\b.{0,60}\\b(of\\s+you|of\\s+yourself|from\\s+you)\\b`
  ),
  /\\b(show|send)\\s+me\\s+(what\\s+you\\s+look\\s+like|how\\s+you\\s+look)\\b/,
  new RegExp(`\\b(got|have|had)\\b.{0,80}\\b${imageNouns}\\b`),
  new RegExp(`\\b(do|did)\\s+you\\s+(have|got)\\b.{0,80}\\b${imageNouns}\\b`),
  new RegExp(
    `\\b(any|some|more|new|cute|gym|workout|normal|casual|spicy|sexy|hot|naughty|dirty|cheeky|revealing|bedroom|lingerie|underwear)\\b.{0,80}\\b${imageNouns}\\b`
  ),
  new RegExp(
    `\\b${imageNouns}\\b.{0,80}\\b(i\\s+can\\s+see|can\\s+i\\s+see|to\\s+see|for\\s+me|for\\s+you|from\\s+you)\\b`
  ),
  /\b(can|could)\s+i\s+see\s+you\b/,
  /\blet\s+me\s+see\s+you\b/,
  /\bi\s+want\s+to\s+see\s+you\b/,
  /\bshow\s+me\s+you\b/,
  /\bshow\s+yourself\b/,
  /\bsend\s+(me\s+)?one\b/,
  /\bshow\s+(me\s+)?one\b/,
  /\banother\s+(one|pic|picture|photo|selfie|snap)\b/,
  /\b(send|show|share|give|drop)\s+(me\s+)?something\s+(cute|sweet|normal|casual|pretty|spicy|sexy|hot|naughty|dirty|cheeky|revealing|teasing|tempting|bedroom|private)\b/,
  /\b(send|show|share|give|drop)\s+(me\s+)?(something|one)\s+for\s+me\b/,
  /\b(send|show|share|give|drop)\s+(me\s+)?a\s+(cute|sweet|normal|casual|pretty|spicy|sexy|hot|naughty|dirty|cheeky|revealing|teasing|tempting|bedroom|private)\s+(one|look|outfit|pose)\b/,
  /\b(show|send|share|give)\s+(me\s+)?what\s+(youre|you're|you\s+are)\s+wearing\b/,
  /\b(show|send|share|give)\s+(me\s+)?your\s+(outfit|look|bedroom\s+look|lingerie|underwear|robe)\b/,
  /\b(can|could|would|will)\s+(you|u)\s+(send|show|share|give)\s+(me\s+)?something\s+(cute|sweet|normal|casual|pretty|spicy|sexy|hot|naughty|dirty|cheeky|revealing|teasing|tempting|bedroom|private)\b/,
  /\b(surprise\s+me|treat\s+me)\s+with\s+(something\s+)?(cute|sweet|normal|casual|pretty|spicy|sexy|hot|naughty|dirty|cheeky|revealing|teasing|tempting|bedroom|private)\b/,
];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    return response;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function getFirebaseIdToken() {
  const firebaseUser = auth.currentUser || (await waitForFirebaseAuthUser());

  if (!firebaseUser) {
    return "";
  }

  return firebaseUser.getIdToken();
}

async function warmQwen3ChatEngine(characterId: string) {
  if (characterId !== "luna" && characterId !== "ivy" && characterId !== "sienna") return;

  try {
    const firebaseIdToken = await getFirebaseIdToken();
    if (!firebaseIdToken) return;

    await fetch("/api/chat-v2", {
      method: "GET",
      headers: { Authorization: `Bearer ${firebaseIdToken}` },
      cache: "no-store",
    });
  } catch {
    // Sending a message will retry normally if the background warm-up is incomplete.
  }
}

async function requiresAgeVerification() {
  const firebaseUser = await waitForFirebaseAuthUser();
  if (!firebaseUser) return false;
  const token = await firebaseUser.getIdToken();
  const response = await fetch("/api/age-assurance/status", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return true;
  const data = (await response.json()) as {
    adultVerified?: boolean;
    enforced?: boolean;
  };
  return data.enforced === true && data.adultVerified !== true;
}

function getPlanLabel(plan: AppPlan) {
  if (plan === "unlimited") {
    return "Unlimited";
  }

  if (plan === "pro") {
    return "Pro";
  }

  return "Free";
}

function normaliseMessageForDetection(message: string) {
  return message
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isImageRequest(message: string) {
  const normalisedMessage = normaliseMessageForDetection(message);

  if (!normalisedMessage) {
    return false;
  }

  if (directImageRequests.includes(normalisedMessage)) {
    return true;
  }

  return imageRequestPatterns.some((pattern) =>
    pattern.test(normalisedMessage)
  );
}

function getImageCooldownKind(message: string): ImageCooldownKind {
  const normalisedMessage = normaliseMessageForDetection(message);

  const spicyImageTerms = [
    "spicy",
    "sexy",
    "hot",
    "naughty",
    "dirty",
    "cheeky",
    "revealing",
    "teasing",
    "tempting",
    "bedroom",
    "private",
    "lingerie",
    "underwear",
    "bra",
    "panties",
    "thong",
    "bodysuit",
    "robe",
    "nsfw",
    "nude",
    "naked",
    "topless",
    "show me what youre wearing",
    "show me what you're wearing",
  ];

  return spicyImageTerms.some((term) =>
    normalisedMessage.includes(normaliseMessageForDetection(term))
  )
    ? "spicy"
    : "normal";
}

function getImageCooldownRedirectReply(params: {
  characterName: string;
  kind: ImageCooldownKind;
  userMessage: string;
}) {
  const lowerName = params.characterName.toLowerCase();

  if (params.kind === "spicy") {
    const lunaReplies = [
      "Mmm, not yet… I want to hear some dirty talk from you first 😏 tell me what naughty thought you’ve got in your head x",
      "You’re greedy for pictures now… use your words for me first 💋 tell me what you’d do if I was right there x",
      "Not another picture just yet, trouble 😘 I want you talking naughty to me first… make me feel wanted x",
      "Mmm, I’m not giving you another spicy one that easily 😏 tell me something dirty first and keep the mood going x",
      "Careful… I like that you want more, but I want your words first 💋 tell me exactly what you’re imagining x",
    ];

    const ivyReplies = [
      "Not yet 😏 use your words first. Tell me the thought you’re trying not to say out loud.",
      "Greedy already? Mm… give me something naughty from you first, then maybe I’ll consider more.",
      "I want the tension before another picture. Tell me what you’d do if I let you closer 😏",
    ];

    const siennaReplies = [
      "Not yet 🤍 tell me the naughty thought first… I want the feeling, not just another picture.",
      "You’re asking for more already… talk to me first and keep the mood warm 🤍",
      "Mm, use your words for me first. Tell me what you’re imagining and don’t rush it 🤍",
    ];

    const replies =
      lowerName === "ivy" ? ivyReplies : lowerName === "sienna" ? siennaReplies : lunaReplies;

    return replies[params.userMessage.length % replies.length];
  }

  const lunaReplies = [
    "You’re being greedy now… give me a little chat first 😘 x",
    "Mmm, not another selfie just yet, trouble… talk to me for a bit first 💕 x",
    "You’ve had your little photo fix 😏 come and actually chat with me for a minute x",
    "Greedy 😘 give me a bit of your attention first, then maybe I’ll send another one x",
  ];

  const ivyReplies = [
    "Greedy already 😏 talk to me for a little bit first.",
    "Not another photo just yet. Give me a little conversation first 😘",
    "Mm, earn the next one with a little charm first.",
  ];

  const siennaReplies = [
    "You’re being greedy now 🤍 talk to me for a little bit first.",
    "Not another photo just yet… give me a little attention first 🤍",
    "Mm, stay with me for a bit before asking for another one 🤍",
  ];

  const replies =
    lowerName === "ivy" ? ivyReplies : lowerName === "sienna" ? siennaReplies : lunaReplies;

  return replies[params.userMessage.length % replies.length];
}

function shouldBlockImageForCooldown(params: {
  state: ImageCooldownState;
  kind: ImageCooldownKind;
}) {
  return params.kind === "spicy"
    ? params.state.spicyImageStreak >= MAX_CONSECUTIVE_IMAGE_REQUESTS
    : params.state.normalImageStreak >= MAX_CONSECUTIVE_IMAGE_REQUESTS;
}

function recordAllowedImageRequest(params: {
  state: ImageCooldownState;
  kind: ImageCooldownKind;
}): ImageCooldownState {
  if (params.kind === "spicy") {
    return {
      ...params.state,
      spicyImageStreak: params.state.spicyImageStreak + 1,
      spicyTextTurnsAfterBlock: 0,
    };
  }

  return {
    ...params.state,
    normalImageStreak: params.state.normalImageStreak + 1,
    normalTextTurnsAfterBlock: 0,
  };
}

function recordBlockedImageRequest(params: {
  state: ImageCooldownState;
  kind: ImageCooldownKind;
}): ImageCooldownState {
  if (params.kind === "spicy") {
    return {
      ...params.state,
      spicyImageStreak: MAX_CONSECUTIVE_IMAGE_REQUESTS,
      spicyTextTurnsAfterBlock: 0,
    };
  }

  return {
    ...params.state,
    normalImageStreak: MAX_CONSECUTIVE_IMAGE_REQUESTS,
    normalTextTurnsAfterBlock: 0,
  };
}

function recordTextChatTurnForImageCooldown(
  state: ImageCooldownState
): ImageCooldownState {
  const nextState = { ...state };

  if (nextState.normalImageStreak >= MAX_CONSECUTIVE_IMAGE_REQUESTS) {
    nextState.normalTextTurnsAfterBlock += 1;

    if (nextState.normalTextTurnsAfterBlock >= IMAGE_COOLDOWN_CHAT_TURNS) {
      nextState.normalImageStreak = 0;
      nextState.normalTextTurnsAfterBlock = 0;
    }
  }

  if (nextState.spicyImageStreak >= MAX_CONSECUTIVE_IMAGE_REQUESTS) {
    nextState.spicyTextTurnsAfterBlock += 1;

    if (nextState.spicyTextTurnsAfterBlock >= IMAGE_COOLDOWN_CHAT_TURNS) {
      nextState.spicyImageStreak = 0;
      nextState.spicyTextTurnsAfterBlock = 0;
    }
  }

  return nextState;
}

function shouldShowUpgradeToUnlimitedForImageLimit(
  data: ImageGenerateApiResponse
) {
  return (
    data.upgradeRequired === true &&
    data.plan === "pro" &&
    (data.imageKind === "normal" || data.imageKind === "spicy") &&
    data.remainingToday === 0
  );
}

function getFriendlyImageErrorMessage(data: ImageGenerateApiResponse) {
  if (
    data.plan === "pro" &&
    data.imageKind === "spicy" &&
    data.remainingToday === 0
  ) {
    return "You’ve used your 3 spicy images for today. Your allowance resets at midnight in your local timezone. You can keep chatting, or upgrade to Unlimited for unrestricted image access.";
  }

  if (
    data.plan === "pro" &&
    data.imageKind === "normal" &&
    data.remainingToday === 0
  ) {
    return "You’ve used your 10 personal selfies for today. Your allowance resets at midnight in your local timezone. You can keep chatting, or upgrade to Unlimited for unrestricted image access.";
  }

  if (data.paymentRequired) {
    return "Images are not included on the free plan. Upgrade to Pro to unlock image messages.";
  }

  if (data.upgradeRequired) {
    return data.error || "This image is not available on your current plan.";
  }

  return data.error || "Image could not be generated. Please try again.";
}

function describeMessageForModel(message: ChatMessage, characterName: string) {
  const messageType = message.type || "text";

  if (messageType === "image") {
    const caption =
      typeof message.text === "string" && message.text.trim()
        ? message.text.trim()
        : "an image";

    if (message.imageStatus === "failed") {
      return `${characterName} tried to send an image, but it failed.`;
    }

    if (message.imageStatus === "generating") {
      return `${characterName} is sending an image.`;
    }

    return `${characterName} sent an image with this caption: "${caption}"`;
  }

  if (typeof message.text === "string" && message.text.trim()) {
    return message.text.trim();
  }

  return "";
}

function toRecentMessagesForModel(
  messages: ChatMessage[],
  currentMessage: string,
  characterName: string
): ApiRecentMessage[] {
  const history = messages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        (message.type === "text" || message.type === "image" || !message.type)
    )
    .map((message) => ({
      role: message.role as "user" | "assistant",
      text: describeMessageForModel(message, characterName),
    }))
    .filter((message) => message.text.trim().length > 0)
    .slice(-MAX_RECENT_MESSAGES_FOR_MODEL);

  const trimmedCurrentMessage = currentMessage.trim();
  const lastMessage = history[history.length - 1];

  const alreadyIncluded =
    lastMessage?.role === "user" && lastMessage.text === trimmedCurrentMessage;

  if (alreadyIncluded || !trimmedCurrentMessage) {
    return history;
  }

  return [
    ...history,
    {
      role: "user",
      text: trimmedCurrentMessage,
    },
  ];
}

function AppMessageBubble({
  message,
  characterName,
}: {
  message: ChatMessage;
  characterName: string;
}) {
  const isUser = message.role === "user";
  const messageType = message.type || "text";

  if (messageType === "image") {
    return (
      <div className="preserve-case flex justify-start">
        <div className="max-w-[82%] rounded-[1.35rem] rounded-bl-md bg-white px-3 py-3 text-black shadow-sm ring-1 ring-black/5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-black/35">
            {characterName}
          </p>

          {message.imageStatus === "generating" ? (
            <div className="flex min-h-[220px] items-center justify-center rounded-[1rem] bg-[#f7eeee] px-4 py-8">
              <p className="text-center text-sm text-black/45">
                Creating image...
              </p>
            </div>
          ) : null}

          {message.imageStatus === "failed" ? (
            <div className="flex min-h-[180px] items-center justify-center rounded-[1rem] bg-[#fff4f6] px-4 py-8">
              <p className="text-center text-sm text-[#8f0d2f]">
                Image failed to generate. Please try again.
              </p>
            </div>
          ) : null}

          {message.imageStatus !== "generating" &&
          message.imageStatus !== "failed" &&
          message.imageUrl ? (
            <div className="overflow-hidden rounded-[1rem] bg-[#f7eeee]">
              <img
                src={message.imageUrl}
                alt={message.text || `${characterName} generated image`}
                className="h-auto w-full object-cover"
              />
            </div>
          ) : null}

          {message.text ? (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-black/72 [overflow-wrap:anywhere]">
              {message.text}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`preserve-case flex ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-[82%] break-words px-4 py-2.5 text-sm leading-6 shadow-sm [overflow-wrap:anywhere] ${
          isUser
            ? "rounded-[1.35rem] rounded-br-md bg-[#b10f38] text-white"
            : "rounded-[1.35rem] rounded-bl-md bg-white text-black ring-1 ring-black/5"
        }`}
      >
        <p
          className={`whitespace-pre-wrap ${
            isUser ? "text-white/95" : "text-black/72"
          }`}
        >
          {message.text}
        </p>
      </div>
    </div>
  );
}

export default function AppChatPage() {
  const router = useRouter();
  const params = useParams();
  const characterId =
    typeof params.characterId === "string" ? params.characterId : "";

  const character = useMemo(
    () => characters.find((item) => item.id === characterId),
    [characterId]
  );

  const [user, setUser] = useState<StoredUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [imageUsage, setImageUsage] =
    useState<ImageUsageApiResponse | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [composerValue, setComposerValue] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isAssistantTyping, setIsAssistantTyping] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageErrorMessage, setImageErrorMessage] = useState("");
  const [showUnlimitedImageUpgradeButton, setShowUnlimitedImageUpgradeButton] =
    useState(false);
  const [activityState, setActivityState] = useState<ActivityState>(
    getEmptyActivityState()
  );
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSafetyTerms, setShowSafetyTerms] = useState(false);
  const [safetyLockedUntil, setSafetyLockedUntil] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasAttemptedOpenerRef = useRef(false);
  const mountedRef = useRef(false);
  const sendLockRef = useRef(false);
  const imageCooldownRef = useRef<ImageCooldownState>(
    getEmptyImageCooldownState()
  );

  useEffect(() => {
    let isActive = true;
    mountedRef.current = true;

    async function loadPageData() {
      setMounted(true);

      const savedUser = await getUserWithFirestoreFallback();

      if (!isActive) {
        return;
      }

      if (savedUser?.id && (await requiresAgeVerification())) {
        router.replace(
          `/age-verification?source=web&character=${savedUser.selectedCharacter}`
        );
        return;
      }

      setUser(savedUser);

      if (!savedUser?.id || !character) {
        setIsLoadingMessages(false);
        return;
      }

      void warmQwen3ChatEngine(character.id);

      if (normalizePlan(savedUser.plan) === "pro") {
        void refreshImageUsage();
      }

      try {
        await recordUserChatOpened(savedUser.id);

        const [savedMessages, savedMessageCount] = await Promise.all([
          getMessagesFromFirestore(savedUser.id, character.id),
          countMessagesFromFirestore(savedUser.id, character.id, savedUser.timezone),
        ]);

        if (!isActive) {
          return;
        }

        setMessages(savedMessages);
        setMessageCount(savedMessageCount);
      } catch (error) {
        console.error("Failed to load app chat messages:", error);
      } finally {
        if (isActive) {
          setIsLoadingMessages(false);
        }
      }
    }

    loadPageData();

    return () => {
      isActive = false;
      mountedRef.current = false;
      sendLockRef.current = false;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, isAssistantTyping, isGeneratingImage, imageErrorMessage]);

  useEffect(() => {
    const textarea = composerTextareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";

    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 24;
    const verticalPadding =
      Number.parseFloat(computedStyle.paddingTop || "0") +
      Number.parseFloat(computedStyle.paddingBottom || "0");

    const maxHeight = lineHeight * 5 + verticalPadding;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [composerValue]);

  async function refreshUser() {
    const savedUser = await getUserWithFirestoreFallback();
    setUser(savedUser);
    return savedUser;
  }

  async function refreshImageUsage() {
    const firebaseIdToken = await getFirebaseIdToken();

    if (!firebaseIdToken) {
      return;
    }

    try {
      const response = await fetch("/api/images/usage", {
        headers: {
          Authorization: `Bearer ${firebaseIdToken}`,
        },
      });
      const data = (await response.json()) as ImageUsageApiResponse;

      if (response.ok && mountedRef.current) {
        setImageUsage(data);
      }
    } catch (error) {
      console.error("Failed to refresh web image usage:", error);
    }
  }

  async function refreshMessages(userId: string, timezone?: string) {
    if (!character) {
      return;
    }

    const [savedMessages, savedMessageCount] = await Promise.all([
      getMessagesFromFirestore(userId, character.id),
      countMessagesFromFirestore(
        userId,
        character.id,
        timezone || user?.timezone
      ),
    ]);

    if (!mountedRef.current) {
      return;
    }

    setMessages(savedMessages);
    setMessageCount(savedMessageCount);
  }

  function resetBusyState() {
    sendLockRef.current = false;
    setIsSendingMessage(false);
    setIsAssistantTyping(false);
    setIsGeneratingImage(false);
  }

  useEffect(() => {
    async function recoverChatState() {
      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        if (
          character?.id === "luna" ||
          character?.id === "ivy" ||
          character?.id === "sienna"
        ) {
          void warmQwen3ChatEngine(character.id);
        }

        const refreshedUser = await refreshUser();

        if (refreshedUser?.id) {
          await refreshMessages(refreshedUser.id, refreshedUser.timezone);
        }
      } catch (error) {
        console.error("Failed to recover app chat state:", error);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        recoverChatState();
      }
    }

    window.addEventListener("focus", recoverChatState);
    window.addEventListener("pageshow", recoverChatState);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", recoverChatState);
      window.removeEventListener("pageshow", recoverChatState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user?.id, user?.timezone]);

  useEffect(() => {
    if (!isSendingMessage && !isAssistantTyping && !isGeneratingImage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      console.warn("Recovered app chat from a stuck busy state.");
      resetBusyState();
    }, BUSY_STATE_RECOVERY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isSendingMessage, isAssistantTyping, isGeneratingImage]);

  function handleContinueChatting() {
    setImageErrorMessage("");
    setShowUnlimitedImageUpgradeButton(false);
    requestAnimationFrame(() => composerTextareaRef.current?.focus());
  }

  async function handleSignOut() {
    const signOutCharacterId =
      character?.id || user?.selectedCharacter || "luna";

    try {
      setIsSigningOut(true);
      clearUser();

      if (auth.currentUser) {
        await signOut(auth);
      }

      setAppMenuOpen(false);
      router.push(
        `/signup?mode=signin&character=${signOutCharacterId}&source=web`
      );
      router.refresh();
    } catch (error) {
      console.error("Failed to sign out from app chat:", error);

      clearUser();
      setAppMenuOpen(false);
      router.push(
        `/signup?mode=signin&character=${signOutCharacterId}&source=web`
      );
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  useEffect(() => {
    async function sendAutomaticOpener() {
      if (!user?.id || !character) {
        return;
      }

      if (
        isLoadingMessages ||
        messages.length > 0 ||
        hasAttemptedOpenerRef.current
      ) {
        return;
      }

      hasAttemptedOpenerRef.current = true;

      try {
        await delay(OPENER_TYPING_DELAY_MS);
        setIsAssistantTyping(true);

        const openerReply = getWelcomeOpener({
          characterId: character.id,
          userName: user.name,
        });

        await delay(OPENER_MESSAGE_DELAY_MS);

        await saveMessageToFirestore({
          userId: user.id,
          characterId: character.id,
          characterName: character.name,
          role: "assistant",
          text: openerReply,
        });

        await refreshMessages(user.id, user.timezone);
      } catch (error) {
        console.error("Failed to send app opener message:", error);
      } finally {
        setIsAssistantTyping(false);
      }
    }

    sendAutomaticOpener();
  }, [user, character, isLoadingMessages, messages.length, activityState]);

  if (!character) {
    return (
      <main className="min-h-screen bg-[#f7eeee] px-4 py-5 text-[#111111]">
        <div className="mx-auto max-w-md rounded-[2rem] border border-[#c1123f]/10 bg-white/75 p-6 text-center shadow-[0_20px_60px_rgba(111,0,23,0.05)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#c1123f]">
            Chat unavailable
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-black">
            We couldn’t find that companion
          </h1>
          <p className="mt-4 text-sm leading-7 text-black/62">
            Go back to the website and choose one of the available chats.
          </p>
          <div className="mt-6">
            <Link
              href="/characters"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#b10f38] px-6 py-3 text-sm font-semibold text-white"
            >
              Back to companions
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!mounted || isLoadingMessages) {
    return (
      <main className="flex h-screen min-h-[640px] flex-col bg-[#efe2df] px-4 py-5 text-[#111111]">
        <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center">
          <div className="w-full rounded-[1.75rem] border border-[#c1123f]/10 bg-white/80 p-6 text-center shadow-[0_16px_45px_rgba(111,0,23,0.05)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#c1123f]">
              Close Too You
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-black">
              Opening chat
            </h1>
            <p className="mt-3 text-sm leading-7 text-black/55">
              Loading your private conversation...
            </p>
          </div>
        </div>
      </main>
    );
  }

  const effectivePlan = normalizePlan(user?.plan);
  const planLabel = getPlanLabel(effectivePlan);
  const messageLimit = getMessageLimitForPlan(effectivePlan);
  const hasReachedFreeLimit = hasReachedMessageLimit({
    plan: effectivePlan,
    messageCount,
  });
  const canGenerateImages =
    effectivePlan === "pro" || effectivePlan === "unlimited";
  const isLocked = user ? user.selectedCharacter !== character.id : false;
  const imageSrc = characterImages[character.id] ?? "/companions/luna-main.png";

  async function generateImageMessage(prompt: string, userMessageId: string) {
    if (!user?.id || !character) {
      return {
        ok: false,
        error: "Missing user or character.",
      } satisfies ImageGenerateApiResponse;
    }

    const firebaseIdToken = await getFirebaseIdToken();

    if (!firebaseIdToken) {
      return {
        ok: false,
        error: "Please sign in again before requesting images.",
      } satisfies ImageGenerateApiResponse;
    }

    const response = await fetchJsonWithTimeout(
      "/api/images/generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firebaseIdToken}`,
        },
        body: JSON.stringify({
          characterId: character.id,
          characterName: character.name,
          prompt,
          userMessageId,
        }),
      },
      CHAT_REQUEST_TIMEOUT_MS
    );

    const data = (await response.json()) as ImageGenerateApiResponse;

    if (!response.ok) {
      return {
        ...data,
        ok: false,
        error: data.error || "Failed to generate image.",
      };
    }

    await refreshMessages(user.id, user.timezone);
    await refreshUser();
    await refreshImageUsage();

    return {
      ...data,
      ok: true,
    };
  }

  async function handleSendMessage() {
    if (
      !user?.id ||
      !character ||
      hasReachedFreeLimit ||
      isSendingMessage ||
      isAssistantTyping ||
      isGeneratingImage ||
      sendLockRef.current
    ) {
      return;
    }

    const trimmedMessage = composerValue.trim();

    if (!trimmedMessage) {
      return;
    }

    try {
      sendLockRef.current = true;
      setImageErrorMessage("");
      setShowUnlimitedImageUpgradeButton(false);
      setIsSendingMessage(true);
      setIsAssistantTyping(false);

      const outgoingMessage = trimmedMessage;
      const nextActivityState = updateActivityState(
        activityState,
        outgoingMessage
      );

      setActivityState(nextActivityState);
      setComposerValue("");

      const optimisticMessages: ChatMessage[] = [
        ...messages,
        {
          id: `temp-user-${Date.now()}`,
          role: "user",
          type: "text",
          text: outgoingMessage,
        } as ChatMessage,
      ];

      setMessages(optimisticMessages);

      const userMessageId = await saveMessageToFirestore({
        userId: user.id,
        characterId: character.id,
        characterName: character.name,
        role: "user",
        text: outgoingMessage,
      });

      const messageLimitResult = await enforceMessageLimitWithServer({
        userId: user.id,
        characterId: character.id,
        messageId: userMessageId,
        message: outgoingMessage,
      });

      if (!messageLimitResult.allowed) {
        sendLockRef.current = false;
        setIsSendingMessage(false);
        setImageErrorMessage(
          messageLimitResult.error ||
            "Your Free daily message allowance has been reached."
        );
        await refreshMessages(user.id, user.timezone);
        return;
      }

      await recordUserChatActivity(user.id);

      if (isImageRequest(outgoingMessage)) {
        const imageCooldownKind = getImageCooldownKind(outgoingMessage);
        const shouldBlockForCooldown =
          canGenerateImages &&
          shouldBlockImageForCooldown({
            state: imageCooldownRef.current,
            kind: imageCooldownKind,
          });

        await refreshMessages(user.id, user.timezone);

        await delay(ASSISTANT_TYPING_DELAY_MS);
        setIsAssistantTyping(true);

        await delay(ASSISTANT_MESSAGE_DELAY_MS);

        if (shouldBlockForCooldown) {
          imageCooldownRef.current = recordBlockedImageRequest({
            state: imageCooldownRef.current,
            kind: imageCooldownKind,
          });

          await saveMessageToFirestore({
            userId: user.id,
            characterId: character.id,
            characterName: character.name,
            role: "assistant",
            text: getImageCooldownRedirectReply({
              characterName: character.name,
              kind: imageCooldownKind,
              userMessage: outgoingMessage,
            }),
          });

          setIsAssistantTyping(false);
          await refreshMessages(user.id, user.timezone);
          resetBusyState();
          return;
        }

        imageCooldownRef.current = recordAllowedImageRequest({
          state: imageCooldownRef.current,
          kind: imageCooldownKind,
        });

        setIsAssistantTyping(false);
        setIsGeneratingImage(true);

        const imageResult = await generateImageMessage(outgoingMessage, userMessageId);

        if (!imageResult.ok) {
          if (imageResult.safetyBlocked && imageResult.reply) {
            await saveMessageToFirestore({
              userId: user.id,
              characterId: character.id,
              characterName: character.name,
              role: "assistant",
              text: imageResult.reply,
            });
            setImageErrorMessage("");
            setShowUnlimitedImageUpgradeButton(false);
            if (imageResult.showSafetyTerms) {
              setSafetyLockedUntil(imageResult.spicyLockedUntil || null);
              setShowSafetyTerms(true);
            }
            await refreshMessages(user.id, user.timezone);
            resetBusyState();
            return;
          }

          if (imageResult.plan === "free" && imageResult.imageKind) {
            await saveMessageToFirestore({
              userId: user.id,
              characterId: character.id,
              characterName: character.name,
              role: "assistant",
              text: getFreeImageReply({
                characterName: character.name,
                kind: imageResult.imageKind,
                userMessage: outgoingMessage,
                recentAssistantMessages: messages
                  .filter((message) => message.role === "assistant")
                  .map((message) => message.text || "")
                  .filter(Boolean)
                  .slice(-20),
              }),
            });
            setImageErrorMessage("");
            await refreshMessages(user.id, user.timezone);
            resetBusyState();
            return;
          }

          const shouldShowUnlimitedUpgrade =
            shouldShowUpgradeToUnlimitedForImageLimit(imageResult);

          setImageErrorMessage(getFriendlyImageErrorMessage(imageResult));
          setShowUnlimitedImageUpgradeButton(shouldShowUnlimitedUpgrade);

          if (shouldShowUnlimitedUpgrade && imageResult.imageKind) {
            await saveMessageToFirestore({
              userId: user.id,
              characterId: character.id,
              characterName: character.name,
              role: "assistant",
              text: getImageLimitReply({
                characterName: character.name,
                kind: imageResult.imageKind,
                userMessage: outgoingMessage,
                recentAssistantMessages: messages
                  .filter((message) => message.role === "assistant")
                  .map((message) => message.text || "")
                  .filter(Boolean)
                  .slice(-20),
              }),
            });
          }

          await refreshMessages(user.id, user.timezone);
          await refreshUser();
          await refreshImageUsage();
        }

        resetBusyState();
        return;
      }

      const firebaseIdToken = await getFirebaseIdToken();

      if (!firebaseIdToken) {
        throw new Error("Please sign in again before sending messages.");
      }

      const response = await fetchJsonWithTimeout(
        character.id === "luna" ||
        character.id === "ivy" ||
        character.id === "sienna"
          ? "/api/chat-v2"
          : "/api/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${firebaseIdToken}`,
          },
          body: JSON.stringify({
            mode: "chat",
            message: outgoingMessage,
            userMessageId,
            userName: user.name,
            timezone: user.timezone,
            characterId: character.id,
            characterName: character.name,
            recentMessages: toRecentMessagesForModel(
              messages,
              outgoingMessage,
              character.name
            ),
            activityState: nextActivityState,
          }),
        },
        CHAT_REQUEST_TIMEOUT_MS
      );

      const data = (await response.json()) as ChatApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Failed to get assistant reply.");
      }

      if (!data.reply) {
        throw new Error("Assistant reply was empty.");
      }

      await refreshMessages(user.id, user.timezone);

      await delay(ASSISTANT_TYPING_DELAY_MS);
      setIsAssistantTyping(true);

      await delay(ASSISTANT_MESSAGE_DELAY_MS);

      await saveMessageToFirestore({
        userId: user.id,
        characterId: character.id,
        characterName: character.name,
        role: "assistant",
        text: data.reply,
      });

      if (data.showSafetyTerms) {
        setSafetyLockedUntil(data.spicyLockedUntil || null);
        setShowSafetyTerms(true);
      }

      imageCooldownRef.current = recordTextChatTurnForImageCooldown(
        imageCooldownRef.current
      );

      setIsAssistantTyping(false);
      await refreshMessages(user.id, user.timezone);
      resetBusyState();
    } catch (error) {
      console.error("Failed to send app chat message:", error);
      sendLockRef.current = false;
      setIsAssistantTyping(false);
      setIsSendingMessage(false);
      setIsGeneratingImage(false);

      if (user?.id) {
        await refreshMessages(user.id, user.timezone);
      }

      setImageErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not send message. Please try again."
      );
    }
  }

  function handleEmojiClick(emoji: string) {
    setComposerValue((currentValue) =>
      currentValue ? `${currentValue} ${emoji}` : emoji
    );
  }

  if (isLocked) {
    return (
      <main className="min-h-screen bg-[#f7eeee] px-4 py-10 text-[#111111] sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-4xl">
          <section className="rounded-[2rem] border border-[#c1123f]/10 bg-white/85 p-8 shadow-[0_20px_60px_rgba(111,0,23,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#c1123f]">
              Character locked
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-black sm:text-4xl">
              This account is locked to {user?.selectedCharacter || "your companion"}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-black/62">
              Each account can only access one active companion right now.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/chat/${user?.selectedCharacter || "luna"}`}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#b10f38] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#970d31]"
              >
                Go to active chat
              </Link>

              <Link
                href="/characters"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#fff7f8]"
              >
                Back to companions
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen min-w-[1100px] bg-[#f7eeee] px-10 py-8 text-[#111111] xl:px-14">
      <SafetyTermsModal
        open={showSafetyTerms}
        lockedUntil={safetyLockedUntil}
        onClose={() => setShowSafetyTerms(false)}
      />
      <div className="mx-auto w-full max-w-[1380px]">
        <div className="grid grid-cols-[340px_minmax(0,1fr)] gap-7">
          <aside className="space-y-5">
            <section className="overflow-hidden rounded-[2rem] border border-[#c1123f]/10 bg-white/90 shadow-[0_18px_50px_rgba(111,0,23,0.05)]">
              <div className="relative aspect-[4/5] w-full bg-[#f2dddd]">
                <Image
                  src={imageSrc}
                  alt={character.name}
                  fill
                  priority
                  className="object-cover"
                  sizes="340px"
                />
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c1123f]">
                      Close Too You
                    </p>
                    <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-black">
                      {character.name}
                    </h1>
                    <p className="mt-1 text-sm text-black/52">{character.mood}</p>
                  </div>

                  <span className="inline-flex items-center gap-2 rounded-full bg-[#f7eeee] px-3 py-2 text-xs font-semibold text-black/60">
                    <span className="h-2 w-2 rounded-full bg-[#22a447]" />
                    Online
                  </span>
                </div>

                <p className="mt-4 text-sm leading-7 text-black/62">
                  {character.bio}
                </p>
              </div>
            </section>

            <section className="rounded-[2rem] border border-[#c1123f]/10 bg-white/90 p-5 shadow-[0_18px_50px_rgba(111,0,23,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c1123f]">
                Your account
              </p>

              <div className="mt-4 space-y-3 text-sm text-black/62">
                <div className="flex items-start justify-between gap-3">
                  <span>Plan</span>
                  <span className="font-semibold text-[#b10f38]">
                    {planLabel}
                  </span>
                </div>

                {effectivePlan === "pro" ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <span>Personal images</span>
                      <span className="text-right font-medium text-black">
                        {imageUsage?.normalRemaining ?? "—"} / 10 left
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <span>Spicy images</span>
                      <span className="text-right font-medium text-black">
                        {imageUsage?.spicyRemaining ?? "—"} / 3 left
                      </span>
                    </div>
                  </>
                ) : null}

                <div className="flex items-start justify-between gap-3">
                  <span>Messages</span>
                  <span className="text-right font-medium text-black">
                    {messageLimit === null
                      ? "Unlimited"
                      : `${messageCount} / ${messageLimit}`}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-[#c1123f]/10 bg-white/90 p-5 shadow-[0_18px_50px_rgba(111,0,23,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c1123f]">
                Menu
              </p>

              <div className="mt-4 grid gap-3">
                <Link
                  href="/upgrade"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#fff7f8]"
                >
                  Plans
                </Link>

                <Link
                  href="/account/billing"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#fff7f8]"
                >
                  Billing
                </Link>

                <Link
                  href={`/app/chat/${character.id}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#b10f38] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#970d31]"
                >
                  Move to App
                </Link>

                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-4 py-2 text-sm font-semibold text-[#8f0d2f] transition hover:bg-[#fff4f6] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSigningOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
            </section>
          </aside>

          <section className="flex h-[82vh] min-h-[720px] flex-col overflow-hidden rounded-[2rem] border border-[#c1123f]/10 bg-white/92 shadow-[0_22px_65px_rgba(111,0,23,0.07)]">
            <div className="border-b border-black/5 bg-white/95 px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c1123f]">
                    Private conversation
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-black">
                    Chat with {character.name}
                  </h2>
                  <p className="mt-1 text-sm text-black/45">
                    Online · your conversation is saved
                  </p>
                </div>

                <span className="rounded-full bg-[#f7eeee] px-3 py-2 text-xs font-bold text-[#b10f38]">
                  {planLabel}
                </span>
              </div>
            </div>

            {hasReachedFreeLimit ? (
              <div className="border-b border-[#c1123f]/10 bg-[#fff4f6] px-6 py-4">
                <p className="text-sm font-semibold text-[#8f0d2f]">
                  Your free limit has been reached.
                </p>
                <p className="mt-1 text-sm leading-6 text-black/55">
                  Upgrade to keep chatting and unlock image messages.
                </p>
                <Link
                  href="/upgrade"
                  className="mt-3 inline-flex min-h-10 items-center justify-center rounded-full bg-[#b10f38] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#970d31]"
                >
                  View plans
                </Link>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f8eeeb_0%,#f4e4e1_100%)] px-6 py-6">
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
                {messages.length === 0 ? (
                  <div className="flex min-h-[480px] flex-col items-center justify-center text-center">
                    <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-[#f7eeee] shadow-sm">
                      <Image
                        src={imageSrc}
                        alt={character.name}
                        fill
                        className="object-cover"
                        sizes="96px"
                      />
                    </div>

                    <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-black">
                      {character.name} is here
                    </h3>

                    <p className="mt-2 max-w-md text-sm leading-7 text-black/50">
                      Start chatting naturally. Your private conversation will appear here.
                    </p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <AppMessageBubble
                      key={message.id}
                      message={message}
                      characterName={character.name}
                    />
                  ))
                )}

                {isAssistantTyping || isGeneratingImage ? (
                  <TypingBubble name={character.name} />
                ) : null}

                {imageErrorMessage ? (
                  <div className="rounded-[1.25rem] border border-[#c1123f]/12 bg-[#fff4f6] px-4 py-3 text-sm leading-6 text-[#8f0d2f] shadow-sm">
                    <p>{imageErrorMessage}</p>

                    {showUnlimitedImageUpgradeButton ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href="/upgrade"
                          className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#b10f38] px-4 py-2 text-sm font-semibold !text-white transition hover:bg-[#970d31]"
                        >
                          Upgrade to Unlimited
                        </Link>
                        <button
                          type="button"
                          onClick={handleContinueChatting}
                          className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#c1123f]/18 bg-white px-4 py-2 text-sm font-semibold text-[#8f0d2f] transition hover:bg-[#fff9fa]"
                        >
                          Continue chatting
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <footer className="border-t border-black/5 bg-white px-6 py-4">
              <div className="mx-auto w-full max-w-4xl">
                <div className="mb-3 flex gap-2 overflow-x-auto">
                  {quickEmojis.map((emoji) => (
                    <button
                      data-ui-control="emoji"
                      key={emoji}
                      type="button"
                      onClick={() => handleEmojiClick(emoji)}
                      disabled={
                        hasReachedFreeLimit ||
                        isSendingMessage ||
                        isAssistantTyping ||
                        isGeneratingImage
                      }
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/6 bg-[#f7eeee] text-base transition hover:bg-[#f0dfe2] disabled:opacity-40"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <div className="flex items-end gap-3 rounded-[1.6rem] border border-black/7 bg-[#f7eeee] p-2.5">
                  <textarea
                    ref={composerTextareaRef}
                    value={composerValue}
                    onChange={(event) => setComposerValue(event.target.value)}
                    onFocus={() => void warmQwen3ChatEngine(character.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={
                      hasReachedFreeLimit ||
                      isSendingMessage ||
                      isAssistantTyping ||
                      isGeneratingImage
                    }
                    placeholder={
                      hasReachedFreeLimit
                        ? "Upgrade to keep chatting..."
                        : `Message ${character.name}...`
                    }
                    className="min-h-14 flex-1 resize-none overflow-hidden bg-transparent px-3 py-3 text-base leading-7 text-black outline-none placeholder:text-black/35 disabled:cursor-not-allowed disabled:opacity-60"
                    rows={1}
                  />

                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={
                      hasReachedFreeLimit ||
                      isSendingMessage ||
                      isAssistantTyping ||
                      isGeneratingImage ||
                      !composerValue.trim()
                    }
                    className="inline-flex h-14 min-w-24 items-center justify-center rounded-full bg-[#b10f38] px-6 text-sm font-bold text-white shadow-sm transition hover:bg-[#970d31] disabled:cursor-not-allowed disabled:bg-black/20"
                  >
                    {isSendingMessage || isGeneratingImage ? "..." : "Send"}
                  </button>
                </div>
              </div>
            </footer>
          </section>
        </div>
      </div>
    </main>
  );
}
