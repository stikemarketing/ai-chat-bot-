// app/checkout/pro/page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getUserWithFirestoreFallback } from "@/lib/user";

type CheckoutApiResponse = {
  url?: string;
  error?: string;
};

export default function ProCheckoutPage() {
  const router = useRouter();
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);

  async function handleStartCheckout() {
    try {
      setIsStartingCheckout(true);

      const user = await getUserWithFirestoreFallback();

      if (!user?.id) {
        throw new Error("No signed-in user found for checkout.");
      }

      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
        }),
      });

      const data = (await response.json()) as CheckoutApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Failed to create Stripe checkout session.");
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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link href="/upgrade" className="text-sm text-zinc-400 hover:text-white">
          ← Back to plans
        </Link>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
            Checkout
          </p>

          <h1 className="text-3xl font-bold sm:text-4xl">Upgrade to Pro</h1>

          <p className="text-sm leading-6 text-zinc-300 sm:text-base">
            Unlimited saved messages and full paid access.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
          <div className="space-y-3 text-sm text-zinc-300">
            <p className="flex items-center justify-between gap-3">
              <span>Plan</span>
              <span className="font-semibold text-white">Pro</span>
            </p>
            <p className="flex items-center justify-between gap-3">
              <span>Price</span>
              <span className="font-semibold text-white">£14.99 / month</span>
            </p>
            <p className="flex items-center justify-between gap-3">
              <span>Messages</span>
              <span className="font-semibold text-white">Unlimited</span>
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={handleStartCheckout}
            disabled={isStartingCheckout}
            className="inline-flex w-full items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isStartingCheckout ? "Redirecting to Stripe..." : "Continue to Stripe"}
          </button>

          <p className="text-center text-xs text-zinc-500">
            You will be redirected to Stripe-hosted Checkout.
          </p>
        </div>
      </div>
    </div>
  );
}