"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserWithFirestoreFallback, type StoredUser } from "@/lib/user";

function getSafeCharacterId(characterId: string | undefined | null) {
  if (characterId === "ivy") {
    return "ivy";
  }

  if (characterId === "sienna") {
    return "sienna";
  }

  return "luna";
}

export default function AppEntryPage() {
  const router = useRouter();
  const [isCheckingUser, setIsCheckingUser] = useState(true);
  const [savedUser, setSavedUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    async function openApp() {
      try {
        const user = await getUserWithFirestoreFallback();
        setSavedUser(user);

        if (user?.id) {
          const characterId = getSafeCharacterId(user.selectedCharacter);
          router.replace(`/app/chat/${characterId}`);
          return;
        }

        router.replace("/signup");
      } catch (error) {
        console.error("Failed to open app entry route:", error);
        router.replace("/signup");
      } finally {
        setIsCheckingUser(false);
      }
    }

    openApp();
  }, [router]);

  return (
    <main className="min-h-screen bg-[#f7eeee] px-4 py-8 text-[#111111]">
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center text-center">
        <div className="rounded-[2rem] border border-[#c1123f]/10 bg-white/75 p-6 shadow-[0_20px_60px_rgba(111,0,23,0.06)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#c1123f]">
            AI Companion
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-black">
            Opening your app
          </h1>

          <p className="mt-4 text-sm leading-7 text-black/62">
            {isCheckingUser
              ? "Checking your saved account and companion..."
              : savedUser
              ? "Taking you to your private chat..."
              : "Taking you to sign in..."}
          </p>

          <div className="mt-6 flex justify-center">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#c1123f]/20 border-t-[#c1123f]" />
          </div>

          <div className="mt-6">
            <Link
              href="/signup"
              className="text-sm font-semibold text-[#b10f38] underline-offset-4 hover:underline"
            >
              Sign in manually
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}