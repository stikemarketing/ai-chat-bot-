"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

function getPlanLabel(plan: string | null | undefined) {
  if (plan === "unlimited") {
    return "Unlimited";
  }

  if (plan === "pro") {
    return "Pro";
  }

  return "Free";
}

function getCharacterLabel(characterId: string | null | undefined) {
  if (characterId === "ivy") {
    return "Ivy";
  }

  if (characterId === "sienna") {
    return "Sienna";
  }

  return "Luna";
}

async function getFirebaseIdToken() {
  const firebaseUser = auth.currentUser || (await waitForFirebaseAuthUser());

  if (!firebaseUser) {
    return "";
  }

  return firebaseUser.getIdToken();
}

export default function ProCheckoutPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const savedUser = await getUserWithFirestoreFallback();
        setUser(savedUser);
      } catch (error) {
        console.error("Failed to load saved user for Pro checkout:", error);
      } finally {
        setIsLoadingUser(false);
      }
    }

    loadUser();
  }, []);

  async function handleStartCheckout() {
    try {
      setIsStartingCheckout(true);

      const savedUser = await getUserWithFirestoreFallback();

      if (!savedUser?.id) {
        router.push("/signup");
        return;
      }

      if (savedUser.plan === "unlimited") {
        alert("This saved account is already on Unlimited.");
        return;
      }

      const firebaseIdToken = await getFirebaseIdToken();

      if (!firebaseIdToken) {
        alert("Please sign in again before starting checkout.");
        router.push("/signup");
        return;
      }

      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firebaseIdToken}`,
        },
        body: JSON.stringify({
          characterId: savedUser.selectedCharacter,
          planId: "pro",
        }),
      });

      const data = (await response.json()) as CheckoutApiResponse;

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to create Stripe checkout session."
        );
      }

      if (!data.url) {
        throw new Error("Stripe checkout URL was empty.");
      }

      router.push(data.url);
    } catch (error) {
      console.error("Failed to start Stripe checkout:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Could not start Stripe checkout."
      );
    } finally {
      setIsStartingCheckout(false);
    }
  }

  const selectedCharacter = user?.selectedCharacter || "luna";
  const selectedCharacterLabel = getCharacterLabel(selectedCharacter);
  const currentPlanLabel = getPlanLabel(user?.plan);
  const isAlreadyUnlimited = user?.plan === "unlimited";

  return (
    <main className="min-h-screen bg-[#f7eeee] px-4 py-6 text-[#111111] sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8">
          <Link
            href="/upgrade"
            className="text-sm font-medium text-black/50 transition hover:text-[#c1123f]"
          >
            ← Back to plans
          </Link>
        </div>

        <section className="rounded-[2rem] border border-[#c1123f]/10 bg-white/72 p-6 shadow-[0_20px_60px_rgba(111,0,23,0.05)] sm:p-8 lg:p-10">
          <div className="space-y-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#c1123f] sm:text-[13px]">
              Secure checkout
            </p>

            <h1 className="text-4xl font-semibold tracking-[-0.04em] text-black sm:text-5xl">
              Upgrade to Pro
            </h1>

            <p className="max-w-2xl text-base leading-8 text-black/65 sm:text-lg">
              Continue to Stripe to unlock unlimited saved messages, personal
              selfies, and limited spicy images with your companion.
            </p>
          </div>

          <div className="mt-8 rounded-[1.75rem] border border-[#c1123f]/8 bg-[#fff8f8] p-5 sm:p-6">
            <div className="space-y-4 text-sm text-black/68 sm:text-base">
              <p className="flex items-center justify-between gap-3">
                <span>Plan</span>
                <span className="font-semibold text-black">Pro</span>
              </p>

              <div className="h-px bg-[#c1123f]/8" />

              <p className="flex items-center justify-between gap-3">
                <span>Price</span>
                <span className="font-semibold text-black">£14.99 / month</span>
              </p>

              <div className="h-px bg-[#c1123f]/8" />

              <p className="flex items-center justify-between gap-3">
                <span>Messages</span>
                <span className="font-semibold text-black">Unlimited</span>
              </p>

              <div className="h-px bg-[#c1123f]/8" />

              <p className="flex items-center justify-between gap-3">
                <span>Personal selfies</span>
                <span className="font-semibold text-black">10 per day</span>
              </p>

              <div className="h-px bg-[#c1123f]/8" />

              <p className="flex items-center justify-between gap-3">
                <span>Spicy images</span>
                <span className="font-semibold text-black">3 per day</span>
              </p>

              <div className="h-px bg-[#c1123f]/8" />

              <p className="flex items-center justify-between gap-3">
                <span>Return to</span>
                <span className="font-semibold text-black">
                  {selectedCharacterLabel} chat
                </span>
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-[#c1123f]/8 bg-white px-5 py-4 text-sm leading-7 text-black/68">
            {isLoadingUser ? (
              <p>Checking your saved account...</p>
            ) : user ? (
              <div className="space-y-1">
                <p>
                  Checkout account:{" "}
                  <span className="preserve-case font-semibold text-black">
                    {user.email || user.name || "Current user"}
                  </span>
                </p>
                <p>
                  Current plan:{" "}
                  <span className="font-semibold text-black">
                    {currentPlanLabel}
                  </span>
                </p>
              </div>
            ) : (
              <p>
                No signed-in account was found. Create an account first, then
                come back to checkout.
              </p>
            )}
          </div>

          {isAlreadyUnlimited ? (
            <div className="mt-5 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-7 text-amber-900">
              This account is already on Unlimited, so starting Pro checkout is
              blocked to avoid accidental duplicate subscriptions.
            </div>
          ) : null}

          <div className="mt-8 space-y-3">
            <div className="rounded-[1.35rem] border border-[#c1123f]/10 bg-[#fff8f8] px-5 py-4 text-sm leading-7 text-black/65">
              <p>
                £14.99 Is Charged When The Subscription Starts And Automatically
                Every Month On Your Billing Date Until You Cancel. Cancellation
                Stops The Next Renewal; Access Continues Until The End Of The
                Current Paid Period.
              </p>
              <p className="mt-2">
                Payments Are Generally Non-Refundable Once Paid Access Begins,
                Except Where Required By Law. Read Our{" "}
                <Link className="text-[#b10f38]" href="/refunds-cancellation">
                  Refund And Cancellation Policy
                </Link>
                .
              </p>
            </div>

            {user ? (
              <button
                type="button"
                onClick={handleStartCheckout}
                disabled={
                  isStartingCheckout || isLoadingUser || isAlreadyUnlimited
                }
                className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#b10f38] px-7 py-3 font-semibold transition hover:bg-[#970d31] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="text-base text-white">
                  {isStartingCheckout
                    ? "Redirecting to Stripe..."
                    : isAlreadyUnlimited
                    ? "Already on Unlimited"
                    : "Continue to Stripe"}
                </span>
              </button>
            ) : (
              <Link
                href="/signup"
                className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#b10f38] px-7 py-3 font-semibold transition hover:bg-[#970d31]"
              >
                <span className="text-base text-white">Create account first</span>
              </Link>
            )}

            <p className="text-center text-xs leading-6 text-black/45">
              You’ll be redirected to Stripe-hosted Checkout to complete your
              payment securely.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
