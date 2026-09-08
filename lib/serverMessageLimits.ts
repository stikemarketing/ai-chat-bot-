import { getAdminDb } from "@/lib/firebaseAdmin";
import { normalizePlan } from "@/lib/plans";

export const FREE_DAILY_MESSAGE_LIMIT = 15;

function getSafeTimezone(value: unknown) {
  const timezone =
    typeof value === "string" && value.trim() ? value.trim() : "UTC";

  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "UTC";
  }
}

function getTimezoneOffsetMs(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values: Record<string, string> = {};

  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return (
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    ) - date.getTime()
  );
}

function getUtcDateForLocalTime(params: {
  year: number;
  month: number;
  day: number;
  timezone: string;
}) {
  const utcGuess = new Date(
    Date.UTC(params.year, params.month - 1, params.day, 0, 0, 0)
  );
  let offset = getTimezoneOffsetMs(utcGuess, params.timezone);
  let utcDate = new Date(utcGuess.getTime() - offset);

  offset = getTimezoneOffsetMs(utcDate, params.timezone);
  utcDate = new Date(utcGuess.getTime() - offset);

  return utcDate;
}

function getDailyWindow(timezoneValue: unknown) {
  const timezone = getSafeTimezone(timezoneValue);
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const values: Record<string, string> = {};

  for (const part of formatter.formatToParts(now)) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);

  return {
    startOfDay: getUtcDateForLocalTime({ year, month, day, timezone }),
    endOfDay: getUtcDateForLocalTime({
      year,
      month,
      day: day + 1,
      timezone,
    }),
  };
}

export async function enforceServerMessageLimit(params: {
  userId: string;
  characterId: string;
  messageId: string;
  expectedText: string;
  deleteRejectedMessage?: boolean;
}) {
  const db = getAdminDb();
  const userSnapshot = await db.collection("users").doc(params.userId).get();

  if (!userSnapshot.exists) {
    throw new Error("Authenticated user was not found.");
  }

  const user = userSnapshot.data() || {};
  const plan = normalizePlan(String(user.plan || "free"));

  if (plan !== "free") {
    return {
      allowed: true,
      plan,
      messageCount: null,
      remainingToday: null,
    } as const;
  }

  const messagesRef = db
    .collection("conversations")
    .doc(params.userId)
    .collection("characters")
    .doc(params.characterId)
    .collection("messages");
  const messageRef = messagesRef.doc(params.messageId);
  const messageSnapshot = await messageRef.get();
  const message = messageSnapshot.data();

  if (
    !messageSnapshot.exists ||
    message?.role !== "user" ||
    (message?.type || "text") !== "text" ||
    String(message?.text || "") !== params.expectedText
  ) {
    throw new Error("The saved user message could not be verified.");
  }

  const dailyWindow = getDailyWindow(user.timezone);
  const countSnapshot = await messagesRef
    .where("role", "==", "user")
    .where("type", "==", "text")
    .where("createdAt", ">=", dailyWindow.startOfDay)
    .where("createdAt", "<", dailyWindow.endOfDay)
    .count()
    .get();
  const messageCount = countSnapshot.data().count;
  const allowed = messageCount <= FREE_DAILY_MESSAGE_LIMIT;

  if (!allowed && params.deleteRejectedMessage) {
    await messageRef.delete();
  }

  return {
    allowed,
    plan,
    messageCount: Math.min(messageCount, FREE_DAILY_MESSAGE_LIMIT),
    remainingToday: Math.max(0, FREE_DAILY_MESSAGE_LIMIT - messageCount),
  } as const;
}
