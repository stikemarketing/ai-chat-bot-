"use client";

import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "@/firebase/config";
import { getUserWithFirestoreFallback } from "@/lib/user";

function getSafeCharacterId(characterId: string | null | undefined) {
  if (characterId === "ivy" || characterId === "sienna") {
    return characterId;
  }

  return "luna";
}

export default function HomeBackToChatButton() {
  const [chatHref, setChatHref] = useState("");

  useEffect(() => {
    let isActive = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        if (isActive) {
          setChatHref("");
        }
        return;
      }

      try {
        const savedUser = await getUserWithFirestoreFallback();

        if (isActive && savedUser?.id === firebaseUser.uid) {
          setChatHref(
            `/chat/${getSafeCharacterId(savedUser.selectedCharacter)}`
          );
        }
      } catch (error) {
        console.error("Failed to load the home-page chat link:", error);
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  return (
    <Link
      href={chatHref || "/characters"}
      className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#b10f38] px-7 py-3 font-semibold transition hover:bg-[#970d31]"
    >
      <span className="text-base text-white">
        {chatHref ? "Back to chat" : "Start chatting"}
      </span>
    </Link>
  );
}
