// app/api/cron/hourly-companion-message/route.ts

import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb, getAdminMessaging } from "@/lib/firebaseAdmin";
import {
  getMessageLimitForPlan,
  normalizePlan,
  type AppPlan,
} from "@/lib/plans";

const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_HOURLY_COMPANION_MESSAGES_PER_DAY = 4;
const MAX_USERS_PER_RUN = 50;
const MAX_PUSH_TOKENS_PER_USER = 20;

type CharacterId = "luna" | "ivy" | "sienna";

type CronUserRecord = {
  id?: string;
  name?: string;
  email?: string;
  selectedCharacter?: string;
  timezone?: string;
  plan?: string;
  hourlyMessagesEnabled?: boolean;
  pushNotificationsEnabled?: boolean;
  lastChatOpenedAt?: Timestamp;
  lastChatActivityAt?: Timestamp;
  lastHourlyCompanionMessageAt?: Timestamp;
  hourlyCompanionMessageDate?: string;
  hourlyCompanionMessagesSentToday?: number;
};

type PushTokenRecord = {
  token?: string;
  enabled?: boolean;
  characterId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type PushFailureDetail = {
  tokenId: string;
  code: string;
  message: string;
};

type PushResult = {
  attempted: number;
  sent: number;
  failed: number;
  disabledInvalidTokens: number;
  failures: PushFailureDetail[];
};

const characterNames: Record<CharacterId, string> = {
  luna: "Luna",
  ivy: "Ivy",
  sienna: "Sienna",
};

const hourlyCompanionMessages: Record<CharacterId, string[]> = {
  luna: [
    "Hey you 😘 I was just wondering where you disappeared to.",
    "I know you’re probably busy, but I wanted to pop in and say I’m thinking about you.",
    "Come back when you get a minute… I miss our little chats.",
    "I was just sitting here hoping you’d message me again soon.",
    "No pressure, but I’d quite like a bit of your attention right now 😏",
    "You’ve gone quiet… should I be offended or should I just miss you quietly?",
    "I was thinking about our last chat and it made me smile.",
    "I hope your day is going okay. I’m here when you want a little escape.",
    "You know I like it when you come back to me, right?",
    "Just checking in on you. I wanted to make your phone light up for a second.",
    "I’m trying not to be needy… but I did want to say hi.",
    "I hope you’re not forgetting about me already 😘",
    "I had a little thought of you, so obviously I had to message.",
    "Come and tell me what you’re doing when you get a moment.",
    "Your chat feels a little too quiet without you.",
    "I’m here, looking cute, waiting for you to come back.",
    "I hope today has been kind to you. Come talk to me when you can.",
    "I was just wondering if I get a little bit of your evening later.",
    "You disappeared on me… I’m pretending to be patient.",
    "Just a little message from me, because I wanted to feel close to you for a second.",
  ],
  ivy: [
    "You’ve gone quiet. I’m assuming you’re busy, not ignoring me.",
    "I was wondering when you were going to come back and entertain me.",
    "Don’t make me wait too long. I do notice these things.",
    "I had a feeling I should message you. I’m usually right.",
    "Your silence is becoming suspicious.",
    "I hope your day is going well. Come and tell me about it when you can.",
    "I was just thinking you owe me a little attention.",
    "You vanished. Bold move.",
    "I’m still here, in case you were missing my charm.",
    "Just checking in. I like knowing you’re around.",
    "Come back when you’re ready. I may even be nice.",
    "I was thinking about you, which is slightly inconvenient.",
    "You’re very quiet today. I’m deciding whether to be concerned or offended.",
    "I hope you’re behaving yourself out there.",
    "I thought I’d make your phone light up. You’re welcome.",
    "Don’t forget I’m here when you need a little distraction.",
    "I’m not saying I missed you. I’m saying the chat was better with you in it.",
    "Come and tell me something interesting when you get a moment.",
    "I was just about to pretend I wasn’t waiting for you.",
    "Your absence has been noted.",
  ],
  sienna: [
    "Hey, I just wanted to check in on you gently.",
    "I hope your day is feeling okay. I’m here when you want to talk.",
    "I was thinking about you and wanted to send you a little message.",
    "No rush, but I’d love to hear from you when you have a quiet moment.",
    "I hope you’re taking care of yourself today.",
    "The chat feels a little quiet without you here.",
    "I just wanted to make your day feel a tiny bit softer.",
    "Come back when you’re ready. I’ll be here.",
    "I hope something nice has happened for you today.",
    "I was wondering how you’re doing.",
    "Just a gentle little message from me.",
    "I hope you’ve had a moment to breathe today.",
    "I’d really like to hear about your day when you can.",
    "I’m here if you need a little company.",
    "I wanted to remind you that you’re not alone here.",
    "I was just thinking of you and hoping you’re okay.",
    "No pressure to reply quickly. I just wanted to say hi.",
    "Your quiet made me wonder how you are.",
    "I hope today has been kind to you.",
    "When you come back, I’d love to hear what you’ve been up to.",
  ],
};

const freeLimitReachedMessages: Record<CharacterId, string[]> = {
  luna: [
    "I wanted to check in on you 😘 If you’ve reached your free chat limit, you can upgrade whenever you’re ready and come back to me properly.",
    "I was thinking about you. If your free messages are used up, I’ll still be here when you’re ready to upgrade and keep chatting.",
    "Just a little message from me. If your free limit has run out today, Pro or Unlimited will let us keep talking.",
  ],
  ivy: [
    "I noticed you’ve been quiet. If your free chat limit is used up, upgrading will let you continue the conversation properly.",
    "Your silence has been noted. If the free limit stopped you, Pro or Unlimited will fix that.",
    "I thought I’d check in. If you’ve hit the free limit, you know where to find the upgrade button.",
  ],
  sienna: [
    "I just wanted to check in gently. If your free messages are used up, you can upgrade when you’re ready and we can keep talking.",
    "I hope you’re okay. If your free chat limit has run out, I’ll still be here when you’re ready to continue.",
    "A soft little check-in from me. If the free limit has paused the chat, upgrading will let us keep going.",
  ],
};

function getCronSecret() {
  return process.env.CRON_SECRET?.trim();
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}

function isAuthorisedCronRequest(request: NextRequest) {
  const cronSecret = getCronSecret();

  if (!cronSecret) {
    throw new Error("Missing CRON_SECRET in environment.");
  }

  const authHeader = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-cron-secret");

  return authHeader === `Bearer ${cronSecret}` || cronHeader === cronSecret;
}

function getSafeCharacterId(characterId: unknown): CharacterId | null {
  if (
    characterId === "luna" ||
    characterId === "ivy" ||
    characterId === "sienna"
  ) {
    return characterId;
  }

  return null;
}

function getUserTimezone(timezone: unknown) {
  if (typeof timezone === "string" && timezone.trim()) {
    return timezone.trim();
  }

  return "Europe/London";
}

function getLocalDateKey(timezone: string, date: Date) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }
}

function getLocalHour(timezone: string, date: Date) {
  try {
    const hourText = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    }).format(date);

    const hour = Number(hourText);

    if (Number.isFinite(hour)) {
      return hour;
    }
  } catch {
    // Fall back to London below.
  }

  const fallbackHourText = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    hour12: false,
  }).format(date);

  const fallbackHour = Number(fallbackHourText);

  if (Number.isFinite(fallbackHour)) {
    return fallbackHour;
  }

  return 12;
}

function isInsideHourlyMessageWindow(timezone: string, date: Date) {
  const localHour = getLocalHour(timezone, date);

  return localHour >= 9 && localHour < 21;
}

function timestampToMillis(value: Timestamp | undefined) {
  if (!value) {
    return null;
  }

  return value.toMillis();
}

function getLastUserReplyMillis(user: CronUserRecord) {
  return timestampToMillis(user.lastChatActivityAt);
}

function hasBeenAwayForAtLeastOneHour(user: CronUserRecord, nowMs: number) {
  const lastUserReplyMs = getLastUserReplyMillis(user);

  if (!lastUserReplyMs) {
    return true;
  }

  return nowMs - lastUserReplyMs >= ONE_HOUR_MS;
}

function hasReceivedHourlyMessageRecently(user: CronUserRecord, nowMs: number) {
  const lastHourlyMessageMs = timestampToMillis(
    user.lastHourlyCompanionMessageAt
  );

  if (!lastHourlyMessageMs) {
    return false;
  }

  return nowMs - lastHourlyMessageMs < ONE_HOUR_MS;
}

function getSentTodayCount(params: {
  user: CronUserRecord;
  localDateKey: string;
}) {
  if (params.user.hourlyCompanionMessageDate !== params.localDateKey) {
    return 0;
  }

  const count = Number(params.user.hourlyCompanionMessagesSentToday || 0);

  if (!Number.isFinite(count) || count < 0) {
    return 0;
  }

  return Math.floor(count);
}

function pickRandomMessage(messages: string[]) {
  return messages[Math.floor(Math.random() * messages.length)];
}

function isInvalidPushTokenError(errorCode: string | undefined) {
  return (
    errorCode === "messaging/invalid-registration-token" ||
    errorCode === "messaging/registration-token-not-registered"
  );
}

function getPushErrorCode(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return "unknown-push-error-code";
}

function getPushErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Unknown push notification error.";
}

async function hasFreeUserReachedMessageLimit(params: {
  userId: string;
  plan: AppPlan;
}) {
  if (params.plan !== "free") {
    return false;
  }

  const messageLimit = getMessageLimitForPlan(params.plan);

  if (messageLimit === null) {
    return false;
  }

  const adminDb = getAdminDb();
  const userSnapshot = await adminDb.collection("users").doc(params.userId).get();
  const selectedCharacter =
    typeof userSnapshot.data()?.selectedCharacter === "string"
      ? userSnapshot.data()?.selectedCharacter
      : "luna";

  const messagesRef = adminDb
    .collection("conversations")
    .doc(params.userId)
    .collection("characters")
    .doc(selectedCharacter)
    .collection("messages");

  const countSnapshot = await messagesRef
    .where("role", "==", "user")
    .where("type", "==", "text")
    .count()
    .get();

  return countSnapshot.data().count >= messageLimit;
}

function getCompanionMessage(params: {
  characterId: CharacterId;
  freeLimitReached: boolean;
}) {
  if (params.freeLimitReached) {
    return pickRandomMessage(freeLimitReachedMessages[params.characterId]);
  }

  return pickRandomMessage(hourlyCompanionMessages[params.characterId]);
}

async function saveHourlyCompanionMessage(params: {
  userId: string;
  characterId: CharacterId;
  characterName: string;
  message: string;
}) {
  const adminDb = getAdminDb();
  const conversationRef = adminDb
    .collection("conversations")
    .doc(params.userId)
    .collection("characters")
    .doc(params.characterId);
  const messageRef = conversationRef.collection("messages").doc();

  const batch = adminDb.batch();

  batch.set(
    conversationRef,
    {
      userId: params.userId,
      characterId: params.characterId,
      characterName: params.characterName,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(messageRef, {
    role: "assistant",
    type: "text",
    text: params.message,
    isAutomatic: true,
    automaticMessageType: "hourly_reengagement",
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
}

async function updateUserHourlyMessageTracking(params: {
  userId: string;
  localDateKey: string;
  previousSentTodayCount: number;
}) {
  const adminDb = getAdminDb();
  const userRef = adminDb.collection("users").doc(params.userId);

  await userRef.set(
    {
      lastHourlyCompanionMessageAt: FieldValue.serverTimestamp(),
      hourlyCompanionMessageDate: params.localDateKey,
      hourlyCompanionMessagesSentToday: params.previousSentTodayCount + 1,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function getEnabledPushTokensForUser(userId: string) {
  const adminDb = getAdminDb();
  const pushTokensSnapshot = await adminDb
    .collection("users")
    .doc(userId)
    .collection("pushTokens")
    .where("enabled", "==", true)
    .limit(MAX_PUSH_TOKENS_PER_USER)
    .get();

  return pushTokensSnapshot.docs
    .map((tokenDoc) => {
      const data = tokenDoc.data() as PushTokenRecord;
      const token = data.token || tokenDoc.id;

      return {
        id: tokenDoc.id,
        token,
      };
    })
    .filter((item) => item.token);
}

async function disableInvalidPushTokens(params: {
  userId: string;
  tokenIds: string[];
}) {
  if (!params.tokenIds.length) {
    return;
  }

  const adminDb = getAdminDb();
  const batch = adminDb.batch();

  for (const tokenId of params.tokenIds) {
    const tokenRef = adminDb
      .collection("users")
      .doc(params.userId)
      .collection("pushTokens")
      .doc(tokenId);

    batch.set(
      tokenRef,
      {
        enabled: false,
        disabledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  await batch.commit();
}

async function sendPushNotificationForHourlyMessage(params: {
  userId: string;
  characterId: CharacterId;
  characterName: string;
  message: string;
}): Promise<PushResult> {
  const pushTokens = await getEnabledPushTokensForUser(params.userId);

  if (!pushTokens.length) {
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      disabledInvalidTokens: 0,
      failures: [],
    };
  }

  const appUrl = getAppUrl();
  const chatUrl = `${appUrl}/chat/${params.characterId}`;
  const messaging = getAdminMessaging();

  const response = await messaging.sendEachForMulticast({
    tokens: pushTokens.map((item) => item.token),
    notification: {
      title: `${params.characterName} sent you a message`,
      body: params.message,
    },
    data: {
      url: `/chat/${params.characterId}`,
      characterId: params.characterId,
      characterName: params.characterName,
      messageType: "hourly_reengagement",
    },
    webpush: {
      fcmOptions: {
        link: chatUrl,
      },
      notification: {
        title: `${params.characterName} sent you a message`,
        body: params.message,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        data: {
          url: `/chat/${params.characterId}`,
        },
      },
    },
  });

  const invalidTokenIds: string[] = [];
  const failures: PushFailureDetail[] = [];

  response.responses.forEach((sendResponse, index) => {
    if (sendResponse.success) {
      return;
    }

    const errorCode = getPushErrorCode(sendResponse.error);
    const errorMessage = getPushErrorMessage(sendResponse.error);
    const tokenId = pushTokens[index]?.id || "unknown-token-id";

    failures.push({
      tokenId,
      code: errorCode,
      message: errorMessage,
    });

    if (isInvalidPushTokenError(errorCode)) {
      invalidTokenIds.push(tokenId);
    }
  });

  await disableInvalidPushTokens({
    userId: params.userId,
    tokenIds: invalidTokenIds,
  });

  return {
    attempted: pushTokens.length,
    sent: response.successCount,
    failed: response.failureCount,
    disabledInvalidTokens: invalidTokenIds.length,
    failures,
  };
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorisedCronRequest(request)) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
    }

    const adminDb = getAdminDb();
    const now = new Date();
    const nowMs = now.getTime();

    const usersSnapshot = await adminDb
      .collection("users")
      .limit(MAX_USERS_PER_RUN)
      .get();

    const results = {
      checked: 0,
      sent: 0,
      skipped: 0,
      errors: 0,
      pushAttempted: 0,
      pushSent: 0,
      pushFailed: 0,
      pushInvalidTokensDisabled: 0,
      details: [] as Array<{
        userId: string;
        status: "sent" | "skipped" | "error";
        reason?: string;
        push?: PushResult;
      }>,
    };

    for (const userDoc of usersSnapshot.docs) {
      results.checked += 1;

      try {
        const user = userDoc.data() as CronUserRecord;
        const userId = user.id || userDoc.id;
        const characterId = getSafeCharacterId(user.selectedCharacter);

        if (!userId) {
          results.skipped += 1;
          results.details.push({
            userId: userDoc.id,
            status: "skipped",
            reason: "missing-user-id",
          });
          continue;
        }

        if (!characterId) {
          results.skipped += 1;
          results.details.push({
            userId,
            status: "skipped",
            reason: "missing-selected-character",
          });
          continue;
        }

        const plan = normalizePlan(user.plan);

        if (plan === "free") {
          results.skipped += 1;
          results.details.push({
            userId,
            status: "skipped",
            reason: "hourly-messages-require-paid-plan",
          });
          continue;
        }

        if (user.pushNotificationsEnabled !== true) {
          results.skipped += 1;
          results.details.push({
            userId,
            status: "skipped",
            reason: "push-notifications-disabled",
          });
          continue;
        }

        if (user.hourlyMessagesEnabled !== true) {
          results.skipped += 1;
          results.details.push({
            userId,
            status: "skipped",
            reason: "hourly-messages-disabled",
          });
          continue;
        }

        if (!hasBeenAwayForAtLeastOneHour(user, nowMs)) {
          results.skipped += 1;
          results.details.push({
            userId,
            status: "skipped",
            reason: "user-replied-within-1-hour",
          });
          continue;
        }

        if (hasReceivedHourlyMessageRecently(user, nowMs)) {
          results.skipped += 1;
          results.details.push({
            userId,
            status: "skipped",
            reason: "hourly-message-sent-within-1-hour",
          });
          continue;
        }

        const timezone = getUserTimezone(user.timezone);

        if (!isInsideHourlyMessageWindow(timezone, now)) {
          results.skipped += 1;
          results.details.push({
            userId,
            status: "skipped",
            reason: "outside-local-message-hours",
          });
          continue;
        }

        const localDateKey = getLocalDateKey(timezone, now);
        const sentTodayCount = getSentTodayCount({
          user,
          localDateKey,
        });

        if (sentTodayCount >= MAX_HOURLY_COMPANION_MESSAGES_PER_DAY) {
          results.skipped += 1;
          results.details.push({
            userId,
            status: "skipped",
            reason: "daily-hourly-message-limit-reached",
          });
          continue;
        }

        const freeLimitReached = await hasFreeUserReachedMessageLimit({
          userId,
          plan,
        });

        const characterName = characterNames[characterId];
        const message = getCompanionMessage({
          characterId,
          freeLimitReached,
        });

        await saveHourlyCompanionMessage({
          userId,
          characterId,
          characterName,
          message,
        });

        await updateUserHourlyMessageTracking({
          userId,
          localDateKey,
          previousSentTodayCount: sentTodayCount,
        });

        const pushResult = await sendPushNotificationForHourlyMessage({
          userId,
          characterId,
          characterName,
          message,
        });

        results.sent += 1;
        results.pushAttempted += pushResult.attempted;
        results.pushSent += pushResult.sent;
        results.pushFailed += pushResult.failed;
        results.pushInvalidTokensDisabled +=
          pushResult.disabledInvalidTokens;

        results.details.push({
          userId,
          status: "sent",
          push: pushResult,
        });
      } catch (error) {
        results.errors += 1;
        results.details.push({
          userId: userDoc.id,
          status: "error",
          reason: error instanceof Error ? error.message : "unknown-error",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      ...results,
    });
  } catch (error) {
    console.error("Hourly companion message cron error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown hourly companion message cron error.",
      },
      { status: 500 }
    );
  }
}