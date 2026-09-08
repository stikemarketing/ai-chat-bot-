import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { ProhibitedContentCategory } from "@/lib/contentSafety";
import { getAdminDb } from "@/lib/firebaseAdmin";

const EVENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const RESTRICTION_MS = 24 * 60 * 60 * 1000;
const EVENTS_BEFORE_RESTRICTION = 3;

type TimestampLike = {
  toMillis?: () => number;
  toDate?: () => Date;
};

function timestampToMillis(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object") {
    const timestamp = value as TimestampLike;
    if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
    if (typeof timestamp.toDate === "function") return timestamp.toDate().getTime();
  }
  return null;
}

export function getActiveSpicySafetyRestriction(userData: unknown) {
  const data =
    userData && typeof userData === "object"
      ? (userData as Record<string, unknown>)
      : {};
  const lockedUntilMs = timestampToMillis(data.safetySpicyLockedUntil);

  return lockedUntilMs !== null && lockedUntilMs > Date.now()
    ? new Date(lockedUntilMs)
    : null;
}

export async function recordProhibitedSafetyEvent(params: {
  userId: string;
  category: ProhibitedContentCategory;
}) {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(params.userId);
  const eventsRef = userRef.collection("safetyEvents");
  const windowStart = Timestamp.fromDate(new Date(Date.now() - EVENT_WINDOW_MS));
  const recentSnapshot = await eventsRef
    .where("createdAt", ">=", windowStart)
    .get();

  await eventsRef.add({
    category: params.category,
    createdAt: FieldValue.serverTimestamp(),
  });

  const eventCount = recentSnapshot.size + 1;
  if (eventCount < EVENTS_BEFORE_RESTRICTION) {
    return { eventCount, restricted: false as const, lockedUntil: null };
  }

  const lockedUntil = new Date(Date.now() + RESTRICTION_MS);
  await userRef.set(
    {
      safetySpicyLockedUntil: Timestamp.fromDate(lockedUntil),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { eventCount, restricted: true as const, lockedUntil };
}

export async function deleteProhibitedUserMessage(params: {
  userId: string;
  characterId: string;
  messageId: string;
  expectedText: string;
}) {
  if (!params.messageId.trim()) return;

  const messageRef = getAdminDb()
    .collection("conversations")
    .doc(params.userId)
    .collection("characters")
    .doc(params.characterId)
    .collection("messages")
    .doc(params.messageId);
  const snapshot = await messageRef.get();
  const message = snapshot.data();

  if (
    snapshot.exists &&
    message?.role === "user" &&
    (message.type || "text") === "text" &&
    String(message.text || "") === params.expectedText
  ) {
    await messageRef.delete();
  }
}
