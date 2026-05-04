// firebase/users.ts
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./config";

export type FirestoreUser = {
  id: string;
  name: string;
  email: string;
  selectedCharacter: string;
  timezone: string;
  plan: "free";
  trialActive: true;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export async function saveUserToFirestore(user: FirestoreUser) {
  const userRef = doc(db, "users", user.id);

  await setDoc(
    userRef,
    {
      ...user,
      createdAt: serverTimestamp(),
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

  return snapshot.data() as FirestoreUser;
}