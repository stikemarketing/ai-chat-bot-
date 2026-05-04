// app/upgrade/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getUserWithFirestoreFallback, type StoredUser } from "@/lib/user";
import {
  getPlanDefinition,
  normalizePlan,
  PLAN_DEFINITIONS,
} from "@/lib/plans";

export default function UpgradePage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const savedUser = await getUserWithFirestoreFallback();
        setUser(savedUser);
      } catch (error) {
        console.error("Failed to load user:", error);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  const currentPlan = useMemo(() => {
    return getPlanDefinition(normalizePlan(user?.plan));
  }, [user?.plan]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href="/characters"
          className="text-sm text-zinc-400 hover:text-white"
        >
          ← Back to characters
        </Link>
      </div>

      <div className="mb-10 space-y-4">
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
          Upgrade
        </p>
        <h1 className="text-4xl font-bold sm:text-5xl">Choose your plan</h1>
        <p className="max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base">
          Upgrade when you want unlimited chat and full access. This next step
          now goes to a proper payment wall page instead of fake local upgrade.
        </p>
      </div>

      <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
        {loading ? (
          <p className="text-sm text-zinc-400">Loading account...</p>
        ) : (
          <div className="space-y-3 text-sm text-zinc-300">
            <p>
              Current plan:{" "}
              <span className="font-semibold text-white">{currentPlan.name}</span>
            </p>
            <p>
              Account:{" "}
              <span className="text-white">{user?.email || "Not saved yet"}</span>
            </p>
            <p>
              Billing mode:{" "}
              <span className="text-white">Payment wall ready</span>
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {Object.values(PLAN_DEFINITIONS).map((plan) => {
          const isCurrentPlan = currentPlan.id === plan.id;

          return (
            <section
              key={plan.id}
              className={`rounded-2xl border p-6 backdrop-blur ${
                plan.highlighted
                  ? "border-white/20 bg-white/10"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <div className="mb-6 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-semibold">{plan.name}</h2>
                  {plan.highlighted ? (
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white">
                      Best for launch
                    </span>
                  ) : null}
                </div>

                <p className="text-3xl font-bold">{plan.priceLabel}</p>

                <p className="text-sm leading-6 text-zinc-300">
                  {plan.messageLimit === null
                    ? "Unlimited saved user messages."
                    : `${plan.messageLimit} saved user messages included.`}
                </p>
              </div>

              <div className="mb-8 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <span className="mt-1 text-sm text-zinc-400">•</span>
                    <p className="text-sm text-zinc-200">{feature}</p>
                  </div>
                ))}
              </div>

              {plan.id === "free" ? (
                <button
                  type="button"
                  disabled
                  className={`inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition ${
                    isCurrentPlan
                      ? "cursor-not-allowed border border-white/10 bg-white/5 text-zinc-300"
                      : "cursor-not-allowed border border-white/10 bg-white/5 text-zinc-500"
                  }`}
                >
                  {isCurrentPlan ? "Your current plan" : plan.ctaLabel}
                </button>
              ) : (
                <Link
                  href="/checkout/pro"
                  className={`inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition ${
                    isCurrentPlan
                      ? "pointer-events-none border border-white/10 bg-white/5 text-zinc-300"
                      : "bg-white text-zinc-950 hover:bg-zinc-200"
                  }`}
                >
                  {isCurrentPlan ? "Already on Pro" : "Continue to payment"}
                </Link>
              )}

              {!loading && isCurrentPlan ? (
                <p className="mt-3 text-center text-xs text-zinc-500">
                  This is your current active plan.
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}