// lib/user.ts
import { getUserFromFirestore } from "@/firebase/users";

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  selectedCharacter: string;
  timezone: string;
  plan: "free";
  trialActive: true;
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

export async function getUserWithFirestoreFallback() {
  const localUser = getUser();

  if (!localUser?.id) {
    return null;
  }

  try {
    const firestoreUser = await getUserFromFirestore(localUser.id);

    if (firestoreUser) {
      const mergedUser: StoredUser = {
        id: firestoreUser.id,
        name: firestoreUser.name,
        email: firestoreUser.email,
        selectedCharacter: firestoreUser.selectedCharacter,
        timezone: firestoreUser.timezone,
        plan: firestoreUser.plan,
        trialActive: firestoreUser.trialActive,
      };

      saveUser(mergedUser);
      return mergedUser;
    }
  } catch (error) {
    console.error("Failed to load Firestore user:", error);
  }

  return localUser;
}

export function clearUser() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
}