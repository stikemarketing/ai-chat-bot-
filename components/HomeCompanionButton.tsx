"use client";

import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "@/firebase/config";
import { getUserWithFirestoreFallback, type StoredUser } from "@/lib/user";

let cachedUserId = "";
let cachedUserRequest: Promise<StoredUser | null> | null = null;

function loadSignedInUser(userId: string) {
  if (cachedUserId !== userId || !cachedUserRequest) {
    cachedUserId = userId;
    cachedUserRequest = getUserWithFirestoreFallback();
  }

  return cachedUserRequest;
}

export default function HomeCompanionButton({
  companionId,
}: {
  companionId: string;
}) {
  const [isChecking, setIsChecking] = useState(true);
  const [savedCharacterId, setSavedCharacterId] = useState("");

  useEffect(() => {
    let isActive = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        if (isActive) {
          setSavedCharacterId("");
          setIsChecking(false);
        }
        return;
      }

      try {
        const savedUser = await loadSignedInUser(firebaseUser.uid);

        if (isActive && savedUser?.id === firebaseUser.uid) {
          setSavedCharacterId(savedUser.selectedCharacter);
        }
      } catch (error) {
        console.error("Failed to load the featured companion state:", error);
      } finally {
        if (isActive) {
          setIsChecking(false);
        }
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  const isSignedIn = Boolean(savedCharacterId);
  const isActiveCharacter = savedCharacterId === companionId;
  const isLocked = isSignedIn && !isActiveCharacter;

  if (isChecking || isLocked) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/10 bg-black/5 px-5 py-3 font-semibold text-black/45 disabled:cursor-not-allowed"
      >
        <span className="text-base">{isLocked ? "Locked" : "Start chatting"}</span>
      </button>
    );
  }

  return (
    <Link
      href={
        isActiveCharacter
          ? `/chat/${companionId}`
          : `/signup?character=${companionId}`
      }
      className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#b10f38] px-5 py-3 font-semibold transition hover:bg-[#970d31]"
    >
      <span className="text-base text-white">
        {isActiveCharacter ? "Continue chat" : "Start chatting"}
      </span>
    </Link>
  );
}
