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
  where,
} from "firebase/firestore";
import { db } from "./config";

export type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  text: string;
  createdAt?: unknown;
};

export type ConversationRecord = {
  userId: string;
  characterId: string;
  characterName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export async function ensureConversation(params: {
  userId: string;
  characterId: string;
  characterName: string;
}) {
  const conversationRef = doc(db, "conversations", params.userId);

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
  role: "user" | "assistant";
  text: string;
}) {
  await ensureConversation({
    userId: params.userId,
    characterId: params.characterId,
    characterName: params.characterName,
  });

  const messagesRef = collection(db, "conversations", params.userId, "messages");

  await addDoc(messagesRef, {
    role: params.role,
    text: params.text,
    createdAt: serverTimestamp(),
  });

  const conversationRef = doc(db, "conversations", params.userId);

  await setDoc(
    conversationRef,
    {
      updatedAt: serverTimestamp(),
      characterId: params.characterId,
      characterName: params.characterName,
    },
    { merge: true }
  );
}

export async function getMessagesFromFirestore(userId: string) {
  const messagesRef = collection(db, "conversations", userId, "messages");
  const messagesQuery = query(messagesRef, orderBy("createdAt", "asc"));
  const snapshot = await getDocs(messagesQuery);

  return snapshot.docs.map((messageDoc) => ({
    id: messageDoc.id,
    ...messageDoc.data(),
  })) as ChatMessage[];
}

export async function countMessagesFromFirestore(userId: string) {
  const messagesRef = collection(db, "conversations", userId, "messages");
  const userMessagesQuery = query(messagesRef, where("role", "==", "user"));
  const snapshot = await getCountFromServer(userMessagesQuery);
  return snapshot.data().count;
}