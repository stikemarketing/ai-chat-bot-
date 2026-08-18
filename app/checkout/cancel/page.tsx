// app/checkout/cancel/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getUserWithFirestoreFallback, type StoredUser } from "@/lib/user";

function getSafeCharacterId(characterId: string | null | undefined) {
  if (characterId === "ivy") {
    return "ivy";
  }

  if (characterId === "sienna") {
    return "sienna";
  }

  return "luna";
}

function getCheckoutParams() {
  if (typeof window === "undefined") {
    return {
      characterId: null,
    };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    characterId: params.get("character") || params.get("characterId"),
  };
}

export default function CheckoutCancelPage() {
  const [savedUser, setSavedUser] = useState<StoredUser | null>(null);
  const [urlCharacterId, setUrlCharacterId] = useState<string | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    async function loadPageData() {
      try {
        const params = getCheckoutParams();
        setUrlCharacterId(params.characterId);

        const user = await getUserWithFirestoreFallback();
        setSavedUser(user);
      } catch (error) {
        console.error("Failed to load checkout cancel page data:", error);
      } finally {
        setIsLoadingUser(false);
      }
    }

    loadPageData();
  }, []);

  const chatCharacterId = getSafeCharacterId(
    savedUser?.selectedCharacter || urlCharacterId
  );

  return (
    <main className="min-h-screen bg-[#f7eeee] px-4 py-6 text-[#111111] sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <section className="rounded-[2rem] border border-[#c1123f]/10 bg-white/72 p-6 shadow-[0_20px_60px_rgba(111,0,23,0.05)] sm:p-8 lg:p-10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#c1123f] sm:text-[13px]">
            Checkout cancelled
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-black sm:text-5xl">
            No worries
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-8 text-black/65 sm:text-lg">
            Your payment was not completed, so your current access has not
            changed. You can return to your plans and upgrade whenever you are
            ready.
          </p>

          <div className="mt-8 rounded-[1.75rem] border border-[#c1123f]/8 bg-[#fff8f8] p-5 sm:p-6">
            {isLoadingUser ? (
              <p className="text-base leading-8 text-black/68">
                Checking your saved account...
              </p>
            ) : savedUser ? (
              <p className="text-base leading-8 text-black/68">
                You can keep chatting with your saved companion, or return to
                the Upgrade page when you want to try Pro or Unlimited again.
              </p>
            ) : (
              <p className="text-base leading-8 text-black/68">
                You can browse companions or return to the Upgrade page when
                you’re ready.
              </p>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/upgrade"
              className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#b10f38] px-7 py-3 font-semibold transition hover:bg-[#970d31]"
            >
              <span className="text-base text-white">Back to plans</span>
            </Link>

            <Link
              href={`/chat/${chatCharacterId}`}
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-7 py-3 font-semibold transition hover:border-[#c1123f]/25 hover:bg-[#fff7f8]"
            >
              <span className="text-base text-black">Back to chat</span>
            </Link>

            <Link
              href="/characters"
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-7 py-3 font-semibold transition hover:border-[#c1123f]/25 hover:bg-[#fff7f8]"
            >
              <span className="text-base text-black">Browse companions</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}