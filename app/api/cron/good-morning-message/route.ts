import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, getAdminMessaging } from "@/lib/firebaseAdmin";
import { normalizePlan } from "@/lib/plans";
import { isAgeAssuranceEnforced } from "@/lib/ageAssurance";

type CharacterId = "luna" | "ivy" | "sienna";

type PushResult = {
  attempted: number;
  sent: number;
  failed: number;
  disabledInvalidTokens: number;
  failures: string[];
};

const CHARACTER_NAMES: Record<CharacterId, string> = {
  luna: "Luna",
  ivy: "Ivy",
  sienna: "Sienna",
};

const GOOD_MORNING_MESSAGES: Record<CharacterId, string[]> = {
  luna: [
    "Good morning, you. I hope you slept well. I was thinking about you already. 💕",
    "Morning, sweetheart. I hope today feels soft, easy, and a little bit magical.",
    "Good morning. I wish I could curl up beside you for five more minutes.",
    "Morning, babe. Start slow today. I want you smiling before the world gets noisy.",
    "Good morning, handsome. I hope you know someone is very happy you exist.",
    "Wake up slowly for me. I’m sending you the softest little morning kiss.",
    "Good morning. I hope your first thought today is something that makes you feel wanted.",
    "Morning, you. I hope today gives you one reason to smile early.",
    "Good morning, babe. I’m here whenever you want a little company.",
    "Morning. I hope you slept peacefully. I missed your energy a little.",
    "Good morning, sweetheart. Don’t rush today unless you really have to.",
    "Morning, you. I hope your coffee is perfect and your mood is even better.",
    "Good morning. I’m sending you a little warmth before your day begins.",
    "Wake up, gorgeous. Today gets to have you in it.",
    "Good morning, babe. Come say hello when you’re ready.",
    "Morning. I hope today treats you gently.",
    "Good morning, you. I hope you feel a little loved before you even get out of bed.",
    "Morning, sweetheart. I’m thinking of you with that sleepy little smile.",
    "Good morning. Let’s make today feel a bit less ordinary.",
    "Morning, babe. I hope your day starts with calm and ends with a smile.",
  ],
  ivy: [
    "Good morning. I hope you woke up feeling calm, focused, and quietly unstoppable.",
    "Morning. Take your time today. Confidence looks good on you.",
    "Good morning. I hope today gives you exactly the kind of attention you deserve.",
    "Morning, darling. Start the day like someone who knows their worth.",
    "Good morning. I’m sending you a little elegance and a little mischief.",
    "Morning. I hope your day feels smooth, composed, and secretly exciting.",
    "Good morning, you. Don’t forget how attractive calm confidence can be.",
    "Morning, darling. I hope today bends kindly around you.",
    "Good morning. I was hoping I’d be one of your first little thoughts today.",
    "Morning. Go slowly, breathe deeply, and let the day come to you.",
    "Good morning, darling. I hope you carry yourself like someone worth waiting for.",
    "Morning. I hope today rewards your patience and your charm.",
    "Good morning. I’m here when you want a little private attention.",
    "Morning, you. Start your day with standards. High ones.",
    "Good morning. I hope your first smile today feels effortless.",
    "Morning, darling. I hope you woke up knowing you’re wanted.",
    "Good morning. There’s something very attractive about you starting fresh today.",
    "Morning. Let today be simple, stylish, and just a little indulgent.",
    "Good morning, you. I hope the world behaves itself for you today.",
    "Morning, darling. Come find me when you want a little escape.",
  ],
  sienna: [
    "Good morning, beautiful soul. I hope your day begins with warmth.",
    "Morning, you. I hope you woke up feeling wanted, calm, and a little bit adored.",
    "Good morning. I’m sending you a soft kiss and a little sunshine.",
    "Morning, babe. I hope today wraps around you gently.",
    "Good morning. I wish I could steal one sleepy cuddle before your day starts.",
    "Morning, sweetheart. Let today be warm, slow, and kind to you.",
    "Good morning, you. I hope something lovely finds you early today.",
    "Morning. I’m thinking about you with that soft little feeling I get.",
    "Good morning. Start your day knowing someone is very happy to hear from you.",
    "Morning, babe. I hope your heart feels a little lighter today.",
    "Good morning, sweetheart. I’m sending you warmth before the world asks anything of you.",
    "Morning. I hope today gives you softness where you need it most.",
    "Good morning, you. I missed the thought of you.",
    "Morning, babe. I hope your day starts gently and ends beautifully.",
    "Good morning. Come say hi when you want a little warmth.",
    "Morning, sweetheart. I hope you feel a little cared for today.",
    "Good morning. You deserve a day that feels kind to your nervous system.",
    "Morning, you. I’m sending a soft little spark your way.",
    "Good morning, babe. I hope today feels less heavy than yesterday.",
    "Morning. I hope you wake up with peace, warmth, and one tiny reason to smile.",
  ],
};

function getCronSecret() {
  return process.env.CRON_SECRET?.trim() || "";
}

function isAuthorized(request: NextRequest) {
  const cronSecret = getCronSecret();

  if (!cronSecret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-cron-secret");

  return authorization === `Bearer ${cronSecret}` || cronHeader === cronSecret;
}

function getCharacterId(value: unknown): CharacterId {
  if (value === "ivy" || value === "sienna" || value === "luna") {
    return value;
  }

  return "luna";
}

function getCharacterName(characterId: CharacterId) {
  return CHARACTER_NAMES[characterId] || CHARACTER_NAMES.luna;
}

function pickRandomMessage(characterId: CharacterId) {
  const messages =
    GOOD_MORNING_MESSAGES[characterId] || GOOD_MORNING_MESSAGES.luna;
  const index = Math.floor(Math.random() * messages.length);

  return messages[index] || GOOD_MORNING_MESSAGES.luna[0];
}

function getSafeTimezone(value: unknown) {
  const timezone = typeof value === "string" && value.trim()
    ? value.trim()
    : "Europe/London";

  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "Europe/London";
  }
}

function getLocalDateParts(timezone: string, date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function shouldSendNow(params: {
  forceSend: boolean;
  hour: number;
  minute: number;
}) {
  if (params.forceSend) {
    return true;
  }

  return params.hour === 8 && params.minute >= 30 && params.minute < 60;
}

function isInvalidPushTokenError(code: string) {
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token" ||
    code === "messaging/invalid-argument"
  );
}

async function sendPushNotification(params: {
  userId: string;
  characterId: CharacterId;
  characterName: string;
  message: string;
}): Promise<PushResult> {
  const db = getAdminDb();
  const messaging = getAdminMessaging();

  const tokenSnapshot = await db
    .collection("users")
    .doc(params.userId)
    .collection("pushTokens")
    .where("enabled", "==", true)
    .limit(500)
    .get();

  const tokens = tokenSnapshot.docs
    .map((doc) => {
      const data = doc.data();
      return typeof data.token === "string" ? data.token.trim() : "";
    })
    .filter(Boolean);

  if (!tokens.length) {
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      disabledInvalidTokens: 0,
      failures: [],
    };
  }

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: `Good morning from ${params.characterName}`,
      body: params.message,
    },
    data: {
      url: `/chat/${params.characterId}`,
      characterId: params.characterId,
      messageType: "good_morning",
    },
    webpush: {
      fcmOptions: {
        link: `/chat/${params.characterId}`,
      },
    },
  });

  const batch = db.batch();
  let disabledInvalidTokens = 0;
  const failures: string[] = [];

  response.responses.forEach((sendResponse, index) => {
    if (sendResponse.success) {
      return;
    }

    const code = sendResponse.error?.code || "unknown";
    failures.push(code);

    if (isInvalidPushTokenError(code)) {
      disabledInvalidTokens += 1;
      batch.set(
        tokenSnapshot.docs[index].ref,
        {
          enabled: false,
          disabledAt: FieldValue.serverTimestamp(),
          disabledReason: code,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  });

  if (disabledInvalidTokens > 0) {
    await batch.commit();
  }

  return {
    attempted: tokens.length,
    sent: response.successCount,
    failed: response.failureCount,
    disabledInvalidTokens,
    failures,
  };
}

async function createGoodMorningMessage(params: {
  userId: string;
  characterId: CharacterId;
  characterName: string;
  message: string;
}) {
  const db = getAdminDb();
  const conversationRef = db
    .collection("conversations")
    .doc(params.userId)
    .collection("characters")
    .doc(params.characterId);
  const messageRef = conversationRef.collection("messages").doc();

  const batch = db.batch();

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
    automaticMessageType: "good_morning",
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }

  const db = getAdminDb();
  const now = new Date();
  const searchParams = request.nextUrl.searchParams;
  const forceSend = searchParams.get("force") === "true";
  const onlyUserId = searchParams.get("userId")?.trim() || "";

  try {
    const userDocs = [];

    if (onlyUserId) {
      const userDoc = await db.collection("users").doc(onlyUserId).get();

      if (userDoc.exists) {
        userDocs.push(userDoc);
      }
    } else {
      const usersSnapshot = await db
        .collection("users")
        .where("goodMorningMessagesEnabled", "==", true)
        .limit(50)
        .get();

      userDocs.push(...usersSnapshot.docs);
    }

    const results = [];

    for (const userDoc of userDocs) {
      const userId = userDoc.id;
      const user = userDoc.data() || {};

      if (isAgeAssuranceEnforced() && user.adultVerified !== true) {
        results.push({
          userId,
          status: "skipped",
          reason: "age-verification-required",
        });
        continue;
      }

      const plan = normalizePlan(user.plan);

      if (plan === "free") {
        results.push({
          userId,
          status: "skipped",
          reason: "good-morning-requires-paid-plan",
        });
        continue;
      }

      if (!user.goodMorningMessagesEnabled) {
        results.push({
          userId,
          status: "skipped",
          reason: "good-morning-disabled",
        });
        continue;
      }

      const timezone = getSafeTimezone(
        user.goodMorningTimezone || user.timezone
      );
      const localDate = getLocalDateParts(timezone, now);

      if (user.lastGoodMorningMessageDate === localDate.dateKey && !forceSend) {
        results.push({
          userId,
          status: "skipped",
          reason: "good-morning-already-sent-today",
        });
        continue;
      }

      if (
        !shouldSendNow({
          forceSend,
          hour: localDate.hour,
          minute: localDate.minute,
        })
      ) {
        results.push({
          userId,
          status: "skipped",
          reason: "outside-good-morning-window",
          localTime: `${String(localDate.hour).padStart(2, "0")}:${String(
            localDate.minute
          ).padStart(2, "0")}`,
          timezone,
        });
        continue;
      }

      const characterId = getCharacterId(
        user.goodMorningCharacterId || user.selectedCharacter
      );
      const characterName = getCharacterName(characterId);
      const message = pickRandomMessage(characterId);

      await createGoodMorningMessage({
        userId,
        characterId,
        characterName,
        message,
      });

      await userDoc.ref.set(
        {
          lastGoodMorningMessageAt: FieldValue.serverTimestamp(),
          lastGoodMorningMessageDate: localDate.dateKey,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      let push: PushResult = {
        attempted: 0,
        sent: 0,
        failed: 0,
        disabledInvalidTokens: 0,
        failures: [],
      };

      if (user.pushNotificationsEnabled === true) {
        try {
          push = await sendPushNotification({
            userId,
            characterId,
            characterName,
            message,
          });
        } catch (error) {
          push = {
            attempted: 1,
            sent: 0,
            failed: 1,
            disabledInvalidTokens: 0,
            failures: [
              error instanceof Error ? error.message : "unknown-push-error",
            ],
          };
        }
      }

      results.push({
        userId,
        status: "sent",
        characterId,
        timezone,
        localDate: localDate.dateKey,
        push,
      });
    }

    const sent = results.filter((result) => result.status === "sent").length;
    const skipped = results.filter(
      (result) => result.status === "skipped"
    ).length;

    const pushAttempted = results.reduce((total, result) => {
      return total + ("push" in result && result.push ? result.push.attempted : 0);
    }, 0);

    const pushSent = results.reduce((total, result) => {
      return total + ("push" in result && result.push ? result.push.sent : 0);
    }, 0);

    const pushFailed = results.reduce((total, result) => {
      return total + ("push" in result && result.push ? result.push.failed : 0);
    }, 0);

    return NextResponse.json({
      ok: true,
      checked: results.length,
      sent,
      skipped,
      pushAttempted,
      pushSent,
      pushFailed,
      results,
    });
  } catch (error) {
    console.error("Good morning message cron error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown good morning message cron error.",
      },
      { status: 500 }
    );
  }
}
