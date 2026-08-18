import { onAuthStateChanged, type User as FirebaseAuthUser } from "firebase/auth";
import { auth } from "@/firebase/config";
import { getUserFromFirestore } from "@/firebase/users";
import type { AppPlan } from "@/lib/plans";

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  selectedCharacter: string;
  timezone: string;
  plan: AppPlan;
  trialActive: boolean;
  pushNotificationsEnabled?: boolean;
  goodMorningMessagesEnabled?: boolean;
  goodMorningMessageTime?: string;
  goodMorningTimezone?: string;
  goodMorningCharacterId?: string;
};

const STORAGE_KEY = "ai-companion-user";

export function saveUser(user: StoredUser) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function getUser(): StoredUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredUser;
  } catch {
    return null;
  }
}

export function waitForFirebaseAuthUser() {
  return new Promise<FirebaseAuthUser | null>((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribe();
      resolve(firebaseUser);
    });
  });
}

function getStoredUserFromFirebaseAuthUser(
  firebaseUser: FirebaseAuthUser,
  fallbackUser?: StoredUser | null
): StoredUser {
  return {
    id: firebaseUser.uid,
    name:
      firebaseUser.displayName ||
      fallbackUser?.name ||
      firebaseUser.email ||
      "Friend",
    email: firebaseUser.email || fallbackUser?.email || "",
    selectedCharacter: fallbackUser?.selectedCharacter || "luna",
    timezone:
      fallbackUser?.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "Europe/London",
    plan: fallbackUser?.plan || "free",
    trialActive: fallbackUser?.trialActive ?? true,
    pushNotificationsEnabled: fallbackUser?.pushNotificationsEnabled || false,
    goodMorningMessagesEnabled:
      fallbackUser?.goodMorningMessagesEnabled || false,
    goodMorningMessageTime: fallbackUser?.goodMorningMessageTime,
    goodMorningTimezone:
      fallbackUser?.goodMorningTimezone ||
      fallbackUser?.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "Europe/London",
    goodMorningCharacterId:
      fallbackUser?.goodMorningCharacterId ||
      fallbackUser?.selectedCharacter ||
      "luna",
  };
}

function mergeFirestoreUserWithAuthUser(params: {
  firestoreUser: NonNullable<Awaited<ReturnType<typeof getUserFromFirestore>>>;
  firebaseUser?: FirebaseAuthUser | null;
}): StoredUser {
  return {
    id: params.firestoreUser.id,
    name:
      params.firestoreUser.name ||
      params.firebaseUser?.displayName ||
      params.firebaseUser?.email ||
      "",
    email: params.firestoreUser.email || params.firebaseUser?.email || "",
    selectedCharacter: params.firestoreUser.selectedCharacter,
    timezone: params.firestoreUser.timezone,
    plan: params.firestoreUser.plan,
    trialActive: params.firestoreUser.trialActive,
    pushNotificationsEnabled:
      params.firestoreUser.pushNotificationsEnabled || false,
    goodMorningMessagesEnabled:
      params.firestoreUser.goodMorningMessagesEnabled || false,
    goodMorningMessageTime: params.firestoreUser.goodMorningMessageTime,
    goodMorningTimezone:
      params.firestoreUser.goodMorningTimezone ||
      params.firestoreUser.timezone ||
      "Europe/London",
    goodMorningCharacterId:
      params.firestoreUser.goodMorningCharacterId ||
      params.firestoreUser.selectedCharacter ||
      "luna",
  };
}

export async function getUserWithFirestoreFallback() {
  const localUser = getUser();
  const firebaseUser = await waitForFirebaseAuthUser();

  if (firebaseUser?.uid) {
    try {
      const firestoreUser = await getUserFromFirestore(firebaseUser.uid);

      if (firestoreUser) {
        const mergedUser = mergeFirestoreUserWithAuthUser({
          firestoreUser,
          firebaseUser,
        });

        saveUser(mergedUser);
        return mergedUser;
      }
    } catch (error) {
      console.error("Failed to load Firestore user from Firebase Auth:", error);
    }

    const authUser = getStoredUserFromFirebaseAuthUser(firebaseUser, localUser);
    saveUser(authUser);
    return authUser;
  }

  if (!localUser?.id) {
    return null;
  }

  try {
    const firestoreUser = await getUserFromFirestore(localUser.id);

    if (firestoreUser) {
      const mergedUser = mergeFirestoreUserWithAuthUser({
        firestoreUser,
      });

      saveUser(mergedUser);
      return mergedUser;
    }
  } catch (error) {
    console.error("Failed to load Firestore user from local cache:", error);
  }

  return localUser;
}

export function clearUser() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
}