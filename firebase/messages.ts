// firebase/messages.ts

import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "./config";
import { waitForFirebaseAuthUser } from "@/lib/user";
import { getAppNow, isDevTestClockActive } from "@/lib/devTestClock";

export type ChatMessageRole = "user" | "assistant";
export type ChatMessageType = "text" | "image";
export type ImageMessageStatus = "generating" | "complete" | "failed";

export type ChatMessage = {
  id?: string;
  role: ChatMessageRole;
  type?: ChatMessageType;
  text?: string;
  imageUrl?: string;
  imagePrompt?: string;
  imageStatus?: ImageMessageStatus;
  createdAt?: unknown;
};

export type ConversationRecord = {
  userId: string;
  characterId: string;
  characterName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function getChatMessageCreatedAt() {
  if (isDevTestClockActive()) {
    return Timestamp.fromDate(getAppNow());
  }

  return serverTimestamp();
}

async function requireMatchingFirebaseUser(userId: string) {
  const firebaseUser = await waitForFirebaseAuthUser();

  if (!firebaseUser?.uid) {
    throw new Error("You must be signed in to access chat messages.");
  }

  if (firebaseUser.uid !== userId) {
    throw new Error("This signed-in account cannot access this chat.");
  }

  return firebaseUser;
}

function getSafeTimezone(value: string | undefined | null) {
  const timezone =
    typeof value === "string" && value.trim() ? value.trim() : "UTC";

  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone }).format(
      getAppNow()
    );

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

  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return asUtc - date.getTime();
}

function getUtcDateForLocalTime(params: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  timezone: string;
}) {
  const utcGuess = new Date(
    Date.UTC(
      params.year,
      params.month - 1,
      params.day,
      params.hour,
      params.minute,
      params.second
    )
  );

  let offset = getTimezoneOffsetMs(utcGuess, params.timezone);
  let utcDate = new Date(utcGuess.getTime() - offset);

  offset = getTimezoneOffsetMs(utcDate, params.timezone);
  utcDate = new Date(utcGuess.getTime() - offset);

  return utcDate;
}

function getLocalDateParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function getDailyMessageWindow(timezoneValue?: string | null) {
  const timezone = getSafeTimezone(timezoneValue);
  const localDate = getLocalDateParts(getAppNow(), timezone);

  const startOfDay = getUtcDateForLocalTime({
    year: localDate.year,
    month: localDate.month,
    day: localDate.day,
    hour: 0,
    minute: 0,
    second: 0,
    timezone,
  });

  const endOfDay = getUtcDateForLocalTime({
    year: localDate.year,
    month: localDate.month,
    day: localDate.day + 1,
    hour: 0,
    minute: 0,
    second: 0,
    timezone,
  });

  return {
    timezone,
    startOfDay,
    endOfDay,
  };
}

function getCharacterConversationRef(params: {
  userId: string;
  characterId: string;
}) {
  return doc(
    db,
    "conversations",
    params.userId,
    "characters",
    params.characterId
  );
}

function getCharacterMessagesRef(params: {
  userId: string;
  characterId: string;
}) {
  return collection(
    db,
    "conversations",
    params.userId,
    "characters",
    params.characterId,
    "messages"
  );
}

export async function ensureConversation(params: {
  userId: string;
  characterId: string;
  characterName: string;
}) {
  await requireMatchingFirebaseUser(params.userId);

  const conversationRef = getCharacterConversationRef({
    userId: params.userId,
    characterId: params.characterId,
  });

  await setDoc(
    conversationRef,
    {
      userId: params.userId,
      characterId: params.characterId,
      characterName: params.characterName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function saveMessageToFirestore(params: {
  userId: string;
  characterId: string;
  characterName: string;
  role: ChatMessageRole;
  text: string;
}) {
  await requireMatchingFirebaseUser(params.userId);

  await ensureConversation({
    userId: params.userId,
    characterId: params.characterId,
    characterName: params.characterName,
  });

  const messagesRef = getCharacterMessagesRef({
    userId: params.userId,
    characterId: params.characterId,
  });

  await addDoc(messagesRef, {
    role: params.role,
    type: "text",
    text: params.text,
    createdAt: getChatMessageCreatedAt(),
  });

  const conversationRef = getCharacterConversationRef({
    userId: params.userId,
    characterId: params.characterId,
  });

  await setDoc(
    conversationRef,
    {
      userId: params.userId,
      updatedAt: serverTimestamp(),
      characterId: params.characterId,
      characterName: params.characterName,
    },
    { merge: true }
  );
}

export async function saveImageMessageToFirestore(params: {
  userId: string;
  characterId: string;
  characterName: string;
  role: "assistant";
  imageUrl: string;
  imagePrompt: string;
  text?: string;
  imageStatus?: ImageMessageStatus;
}) {
  await requireMatchingFirebaseUser(params.userId);

  await ensureConversation({
    userId: params.userId,
    characterId: params.characterId,
    characterName: params.characterName,
  });

  const messagesRef = getCharacterMessagesRef({
    userId: params.userId,
    characterId: params.characterId,
  });

  await addDoc(messagesRef, {
    role: params.role,
    type: "image",
    text: params.text || "",
    imageUrl: params.imageUrl,
    imagePrompt: params.imagePrompt,
    imageStatus: params.imageStatus || "complete",
    createdAt: getChatMessageCreatedAt(),
  });

  const conversationRef = getCharacterConversationRef({
    userId: params.userId,
    characterId: params.characterId,
  });

  await setDoc(
    conversationRef,
    {
      userId: params.userId,
      updatedAt: serverTimestamp(),
      characterId: params.characterId,
      characterName: params.characterName,
    },
    { merge: true }
  );
}

export async function saveGeneratingImageMessageToFirestore(params: {
  userId: string;
  characterId: string;
  characterName: string;
  imagePrompt: string;
  text?: string;
}) {
  await requireMatchingFirebaseUser(params.userId);

  await ensureConversation({
    userId: params.userId,
    characterId: params.characterId,
    characterName: params.characterName,
  });

  const messagesRef = getCharacterMessagesRef({
    userId: params.userId,
    characterId: params.characterId,
  });

  await addDoc(messagesRef, {
    role: "assistant",
    type: "image",
    text: params.text || "",
    imageUrl: "",
    imagePrompt: params.imagePrompt,
    imageStatus: "generating",
    createdAt: getChatMessageCreatedAt(),
  });

  const conversationRef = getCharacterConversationRef({
    userId: params.userId,
    characterId: params.characterId,
  });

  await setDoc(
    conversationRef,
    {
      userId: params.userId,
      updatedAt: serverTimestamp(),
      characterId: params.characterId,
      characterName: params.characterName,
    },
    { merge: true }
  );
}

export async function getMessagesFromFirestore(
  userId: string,
  characterId: string
) {
  await requireMatchingFirebaseUser(userId);

  const messagesRef = getCharacterMessagesRef({
    userId,
    characterId,
  });
  const messagesQuery = query(messagesRef, orderBy("createdAt", "asc"));
  const snapshot = await getDocs(messagesQuery);

  return snapshot.docs.map((messageDoc) => {
    const data = messageDoc.data();

    return {
      id: messageDoc.id,
      type: data.type || "text",
      ...data,
    };
  }) as ChatMessage[];
}

export async function countMessagesFromFirestore(
  userId: string,
  characterId: string,
  timezone?: string | null
) {
  await requireMatchingFirebaseUser(userId);

  const messagesRef = getCharacterMessagesRef({
    userId,
    characterId,
  });
  const dailyWindow = getDailyMessageWindow(timezone);

  const userMessagesQuery = query(
    messagesRef,
    where("role", "==", "user"),
    where("type", "==", "text"),
    where("createdAt", ">=", dailyWindow.startOfDay),
    where("createdAt", "<", dailyWindow.endOfDay)
  );

  const snapshot = await getCountFromServer(userMessagesQuery);
  return snapshot.data().count;
}
