"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth } from "@/firebase/config";
import {
  getUserWithFirestoreFallback,
  waitForFirebaseAuthUser,
  type StoredUser,
} from "@/lib/user";

type CheckoutApiResponse = {
  url?: string;
  error?: string;
};

function getSafeCharacterId(characterId: string | null | undefined) {
  if (characterId === "ivy") {
    return "ivy";
  }

  if (characterId === "sienna") {
    return "sienna";
  }

  return "luna";
}

function getPlanLabel(plan: string | null | undefined) {
  if (plan === "unlimited") {
    return "Unlimited";
  }

  if (plan === "pro") {
    return "Pro";
  }

  return "Free";
}

function getUrlCharacterId() {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  return params.get("character") || params.get("characterId");
}

async function getFirebaseIdToken() {
  const firebaseUser = auth.currentUser || (await waitForFirebaseAuthUser());

  if (!firebaseUser) {
    return "";
  }

  return firebaseUser.getIdToken();
}

export default function ImageCreditCheckoutPage() {
  const [savedUser, setSavedUser] = useState<StoredUser | null>(null);
  const [urlCharacterId, setUrlCharacterId] = useState<string | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadPageData() {
      try {
        setUrlCharacterId(getUrlCharacterId());

        const user = await getUserWithFirestoreFallback();
        setSavedUser(user);
      } catch (error) {
        console.error("Failed to load image credit checkout page:", error);
        setErrorMessage("Could not load your saved account.");
      } finally {
        setIsLoadingUser(false);
      }
    }

    loadPageData();
  }, []);

  const characterId = useMemo(() => {
    return getSafeCharacterId(savedUser?.selectedCharacter || urlCharacterId);
  }, [savedUser?.selectedCharacter, urlCharacterId]);

  const planLabel = getPlanLabel(savedUser?.plan);
  const canBuyTokenPack = savedUser?.plan === "pro";

  async function handleStartCheckout() {
    if (!savedUser?.id) {
      setErrorMessage("No signed-in account found. Please sign in again first.");
      return;
    }

    if (savedUser.plan !== "pro") {
      setErrorMessage("Extra personal selfie token packs are only available on Pro.");
      return;
    }

    try {
      setErrorMessage("");
      setIsStartingCheckout(true);

      const firebaseIdToken = await getFirebaseIdToken();

      if (!firebaseIdToken) {
        setErrorMessage("Please sign in again before buying selfie tokens.");
        return;
      }

      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firebaseIdToken}`,
        },
        body: JSON.stringify({
          characterId,
          checkoutType: "normal_image_credit",
        }),
      });

      const data = (await response.json()) as CheckoutApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Failed to create token pack checkout.");
      }

      if (!data.url) {
        throw new Error("Stripe checkout URL was empty.");
      }

      window.location.href = data.url;
    } catch (error) {
      console.error("Failed to start token pack checkout:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not start token pack checkout."
      );
    } finally {
      setIsStartingCheckout(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7eeee] px-4 py-6 text-[#111111] sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-5xl">
        <section className="rounded-[2rem] border border-[#c1123f]/10 bg-white/72 p-6 shadow-[0_20px_60px_rgba(111,0,23,0.05)] sm:p-8 lg:p-10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#c1123f] sm:text-[13px]">
            Extra personal selfie token pack
          </p>

          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-black sm:text-5xl">
            You’ve reached your daily selfie allowance
          </h1>

          <p className="mt-4 max-w-3xl text-base leading-8 text-black/65 sm:text-lg">
            You have used your daily Pro allowance of 10 personal selfies. You
            can purchase 1 token pack for £1.99 and receive 3 extra personal
            selfies, or upgrade to Unlimited for full access to personal
            selfies and spicy images.
          </p>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1.75rem] border border-[#c1123f]/10 bg-[#fff8f8] p-5 sm:p-6">
              <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#c1123f]">
                Token pack
              </p>

              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-black">
                £1.99 for 3 extra personal selfies
              </h2>

              <p className="mt-3 text-sm leading-7 text-black/62">
                This adds 3 extra personal selfie credits to your Pro account.
                Each extra personal selfie uses 1 credit. When the 3 credits
                are used, you can buy another token pack.
              </p>

              <button
                type="button"
                onClick={handleStartCheckout}
                disabled={
                  isLoadingUser || isStartingCheckout || !canBuyTokenPack
                }
                className="mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-7 py-3 text-base font-semibold text-black transition hover:border-[#c1123f]/25 hover:bg-[#fff7f8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isStartingCheckout
                  ? "Opening checkout..."
                  : "Buy token pack"}
              </button>

              {!isLoadingUser && !canBuyTokenPack ? (
                <p className="mt-3 text-sm leading-6 text-[#8f0d2f]">
                  Token packs are only available for Pro users.
                </p>
              ) : null}
            </div>

            <div className="rounded-[1.75rem] border border-black/8 bg-white p-5 sm:p-6">
              <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-black/42">
                Unlimited
              </p>

              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-black">
                Upgrade for full access
              </h2>

              <p className="mt-3 text-sm leading-7 text-black/62">
                Unlimited gives you unlimited personal selfies and unlimited
                spicy images, instead of buying extra token packs after your Pro
                daily allowance.
              </p>

              <Link
                href="/checkout/unlimited"
                className="mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#b10f38] px-7 py-3 text-base font-semibold text-white transition hover:bg-[#970d31]"
              >
                Upgrade to Unlimited
              </Link>
            </div>
          </div>

          <div className="mt-8 rounded-[1.75rem] border border-[#c1123f]/8 bg-white/80 p-5 sm:p-6">
            {isLoadingUser ? (
              <p className="text-base leading-8 text-black/68">
                Checking your saved account...
              </p>
            ) : savedUser ? (
              <div className="space-y-3 text-base leading-8 text-black/68">
                <p>
                  Signed-in account:{" "}
                  <span className="preserve-case font-semibold text-black">
                    {savedUser.email || savedUser.name || "Current user"}
                  </span>
                </p>

                <p>
                  Current plan:{" "}
                  <span className="font-semibold text-black">{planLabel}</span>
                </p>
              </div>
            ) : (
              <p className="text-base leading-8 text-black/68">
                No signed-in account was found. Please sign in before buying
                selfie tokens.
              </p>
            )}

            {errorMessage ? (
              <p className="mt-4 rounded-[1.25rem] border border-[#c1123f]/12 bg-[#fff4f6] px-4 py-3 text-sm leading-6 text-[#8f0d2f]">
                {errorMessage}
              </p>
            ) : null}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/chat/${characterId}`}
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-7 py-3 font-semibold transition hover:border-[#c1123f]/25 hover:bg-[#fff7f8]"
            >
              <span className="text-base text-black">Back to chat</span>
            </Link>

            <Link
              href="/upgrade"
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-7 py-3 font-semibold transition hover:border-[#c1123f]/25 hover:bg-[#fff7f8]"
            >
              <span className="text-base text-black">View all plans</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
