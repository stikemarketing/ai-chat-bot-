// firebase/replyGuardLogs.ts
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./config";

export type ReplyGuardCategory =
  | "meetup"
  | "device_support"
  | "embodied_claim"
  | "assistant_mode";

export type ReplyGuardLogInput = {
  userId: string;
  characterId: string;
  characterName: string;
  category: ReplyGuardCategory;
  reason: string;
  userMessage: string;
  rawReply: string;
  finalReply: string;
};

export async function logReplyGuardEvent(input: ReplyGuardLogInput) {
  await addDoc(collection(db, "reply_guard_logs"), {
    ...input,
    createdAt: serverTimestamp(),
  });
}