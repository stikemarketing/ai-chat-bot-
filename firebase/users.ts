import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import {
  normalizeRelationshipMemory,
  type RelationshipMemory,
} from "@/lib/relationshipMemory";
import { normalizePlan, type AppPlan } from "@/lib/plans";
import { db } from "./config";

export type FirestoreUser = {
  id: string;
  name: string;
  email: string;
  selectedCharacter: string;
  timezone: string;
  plan: AppPlan;
  trialActive: boolean;
  relationshipMemory?: RelationshipMemory;
  pushNotificationsEnabled?: boolean;
  hourlyMessagesEnabled?: boolean;
  goodMorningMessagesEnabled?: boolean;
  goodMorningMessageTime?: string;
  goodMorningTimezone?: string;
  goodMorningCharacterId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function getPlanRank(plan: AppPlan) {
  if (plan === "unlimited") return 3;
  if (plan === "pro") return 2;
  return 1;
}

function getSafestPlan(existingPlan: unknown, incomingPlan: unknown): AppPlan {
  const normalisedExistingPlan = normalizePlan(String(existingPlan || "free"));
  const normalisedIncomingPlan = normalizePlan(String(incomingPlan || "free"));

  if (getPlanRank(normalisedExistingPlan) > getPlanRank(normalisedIncomingPlan)) {
    return normalisedExistingPlan;
  }

  return normalisedIncomingPlan;
}

function getSafeCharacterId(characterId: unknown) {
  if (characterId === "ivy") return "ivy";
  if (characterId === "sienna") return "sienna";
  return "luna";
}

function getSafeTimezone(timezone: unknown) {
  return typeof timezone === "string" && timezone.trim()
    ? timezone.trim()
    : "Europe/London";
}

function getSafeTime(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function saveUserToFirestore(user: FirestoreUser) {
  const userRef = doc(db, "users", user.id);
  const existingSnapshot = await getDoc(userRef);
  const existingData = existingSnapshot.exists()
    ? existingSnapshot.data()
    : null;

  const safestPlan = getSafestPlan(existingData?.plan, user.plan);

  await setDoc(
    userRef,
    {
      id: user.id,
      name: user.name,
      email: user.email,
      selectedCharacter: getSafeCharacterId(user.selectedCharacter),
      timezone: getSafeTimezone(user.timezone),
      plan: safestPlan,
      trialActive: Boolean(user.trialActive),
      createdAt: existingData?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getUserFromFirestore(userId: string) {
  const userRef = doc(db, "users", userId);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  return {
    id: data.id || userId,
    name: data.name || "",
    email: data.email || "",
    selectedCharacter: getSafeCharacterId(data.selectedCharacter),
    timezone: getSafeTimezone(data.timezone),
    plan: normalizePlan(data.plan),
    trialActive: Boolean(data.trialActive),
    relationshipMemory: normalizeRelationshipMemory(data.relationshipMemory),
    pushNotificationsEnabled: Boolean(data.pushNotificationsEnabled),
    hourlyMessagesEnabled: Boolean(data.hourlyMessagesEnabled),
    goodMorningMessagesEnabled: Boolean(data.goodMorningMessagesEnabled),
    goodMorningMessageTime: getSafeTime(data.goodMorningMessageTime),
    goodMorningTimezone: getSafeTimezone(
      data.goodMorningTimezone || data.timezone
    ),
    goodMorningCharacterId: getSafeCharacterId(
      data.goodMorningCharacterId || data.selectedCharacter
    ),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  } satisfies FirestoreUser;
}

export async function recordUserChatOpened(userId: string) {
  if (!userId) return;

  const userRef = doc(db, "users", userId);

  await setDoc(
    userRef,
    {
      lastChatOpenedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function recordUserChatActivity(userId: string) {
  if (!userId) return;

  const userRef = doc(db, "users", userId);

  await setDoc(
    userRef,
    {
      lastChatActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}