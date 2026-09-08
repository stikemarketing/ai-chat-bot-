"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CharacterSwitchPanel from "@/components/CharacterSwitchPanel";
import AccountDeletionPanel from "@/components/AccountDeletionPanel";
import { getUserWithFirestoreFallback, type StoredUser } from "@/lib/user";
import {
  getPlanDefinition,
  normalizePlan,
  PLAN_DEFINITIONS,
  type AppPlan,
} from "@/lib/plans";

function getPlanBadge(planId: AppPlan) {
  if (planId === "pro") {
    return "Most popular";
  }

  if (planId === "unlimited") {
    return "Best value";
  }

  return "Starter";
}

function getPlanDescription(planId: AppPlan) {
  if (planId === "free") {
    return "A simple way to try your companion before upgrading.";
  }

  if (planId === "pro") {
    return "For regular users who want unlimited text chat, daily personal selfies, and a small spicy image allowance.";
  }

  return "For users who want the full experience with no daily image limits.";
}

function getPlanSubNote(planId: AppPlan) {
  if (planId === "free") {
    return "Free is limited during testing and does not include images.";
  }

  if (planId === "pro") {
    return "Your daily image allowances reset automatically. Upgrade to Unlimited if you want unrestricted image access.";
  }

  return "No daily image limits. No top-ups needed.";
}

function getCheckoutHref(planId: AppPlan) {
  if (planId === "pro") {
    return "/checkout/pro";
  }

  if (planId === "unlimited") {
    return "/checkout/unlimited";
  }

  return "/upgrade";
}

function getPlanButtonLabel(params: {
  planId: AppPlan;
  planName: string;
  isCurrentPlan: boolean;
}) {
  if (params.planId === "free") {
    return params.isCurrentPlan ? "Your current plan" : "Free starter plan";
  }

  if (params.isCurrentPlan) {
    return `Already on ${params.planName}`;
  }

  if (params.planId === "unlimited") {
    return "Upgrade to Unlimited";
  }

  return "Upgrade to Pro";
}

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

  const isPaidPlan =
    currentPlan.id === "pro" || currentPlan.id === "unlimited";
  const selectedCharacterId = user?.selectedCharacter || "luna";

  return (
    <main className="min-h-screen bg-[#f7eeee] px-4 py-6 text-[#111111] sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-8">
          <Link
            href={user ? `/chat/${selectedCharacterId}` : "/characters"}
            className="text-sm font-medium text-black/50 transition hover:text-[#c1123f]"
          >
            ← {user ? "Back to chat" : "Back to companions"}
          </Link>
        </div>

        <section className="mb-8 rounded-[2rem] border border-[#c1123f]/10 bg-white/72 p-6 shadow-[0_20px_60px_rgba(111,0,23,0.05)] sm:p-8 lg:p-10">
          <div className="space-y-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#c1123f] sm:text-[13px]">
              Plans
            </p>

            <h1 className="text-4xl font-semibold tracking-[-0.04em] text-black sm:text-5xl">
              Choose your access level
            </h1>

            <p className="max-w-3xl text-base leading-8 text-black/65 sm:text-lg">
              Start with Free, upgrade to Pro for daily personal selfies, or
              choose Unlimited for the full companion experience with unlimited
              personal selfies and spicy images.
            </p>
          </div>
        </section>

        <section className="mb-8 rounded-[2rem] border border-[#c1123f]/10 bg-white/72 p-5 shadow-[0_20px_60px_rgba(111,0,23,0.05)] sm:p-6">
          {loading ? (
            <p className="text-sm text-black/50">Loading account...</p>
          ) : (
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3 text-sm text-black/70 sm:text-base">
                <p>
                  Current plan:{" "}
                  <span className="font-semibold text-black">
                    {currentPlan.name}
                  </span>
                </p>

                <p>
                  Account:{" "}
                  <span className="preserve-case text-black">
                    {user?.email || "Not saved yet"}
                  </span>
                </p>

                <p>
                  Billing:{" "}
                  <span className="text-black">
                    Paid Plans Renew Automatically Each Month On The User&apos;s Own
                    Billing Date Until Cancelled.
                  </span>
                </p>
              </div>

              {isPaidPlan ? (
                <Link
                  href="/account/billing"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-6 py-3 text-sm font-semibold text-black transition hover:border-[#c1123f]/25 hover:bg-[#fff7f8]"
                >
                  Manage billing / cancel plan
                </Link>
              ) : null}
            </div>
          )}
        </section>

        {!loading && user ? <CharacterSwitchPanel source="web" /> : null}

        <div className="grid gap-6 lg:grid-cols-3">
          {Object.values(PLAN_DEFINITIONS).map((plan) => {
            const isCurrentPlan = currentPlan.id === plan.id;
            const badge = getPlanBadge(plan.id);
            const checkoutHref = getCheckoutHref(plan.id);
            const isUnlimitedPlan = plan.id === "unlimited";

            return (
              <section
                key={plan.id}
                className={`rounded-[2rem] border p-6 shadow-[0_18px_50px_rgba(111,0,23,0.04)] ${
                  isUnlimitedPlan
                    ? "border-[#c1123f]/18 bg-[linear-gradient(135deg,#fff7f8,rgba(193,18,63,0.1))]"
                    : plan.highlighted
                    ? "border-[#c1123f]/14 bg-[linear-gradient(135deg,#fff7f8,rgba(193,18,63,0.06))]"
                    : "border-[#c1123f]/10 bg-white/78"
                }`}
              >
                <div className="mb-6 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-2xl font-semibold text-black">
                      {plan.name}
                    </h2>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        isUnlimitedPlan
                          ? "border-[#c1123f]/16 bg-[#b10f38] text-white"
                          : "border-[#c1123f]/12 bg-[#fff1f4] text-[#c1123f]"
                      }`}
                    >
                      {badge}
                    </span>
                  </div>

                  <p className="text-4xl font-semibold tracking-tight text-black">
                    {plan.priceLabel}
                  </p>

                  <p className="text-sm leading-7 text-black/65 sm:text-base">
                    {getPlanDescription(plan.id)}
                  </p>

                  <p className="text-xs leading-6 text-black/45 sm:text-sm">
                    {getPlanSubNote(plan.id)}
                  </p>
                </div>

                <div className="mb-8 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <span className="mt-1 text-sm text-[#c1123f]">•</span>
                      <p className="text-sm leading-7 text-black/72 sm:text-base">
                        {feature}
                      </p>
                    </div>
                  ))}
                </div>

                {plan.id === "free" ? (
                  <button
                    type="button"
                    disabled
                    className={`inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 py-3 font-semibold transition ${
                      isCurrentPlan
                        ? "cursor-not-allowed border border-black/10 bg-black/5 text-black/60"
                        : "cursor-not-allowed border border-black/8 bg-black/5 text-black/35"
                    }`}
                  >
                    <span className="text-base">
                      {getPlanButtonLabel({
                        planId: plan.id,
                        planName: plan.name,
                        isCurrentPlan,
                      })}
                    </span>
                  </button>
                ) : (
                  <Link
                    href={checkoutHref}
                    className={`inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 py-3 font-semibold transition ${
                      isCurrentPlan
                        ? "pointer-events-none border border-black/10 bg-black/5 text-black/60"
                        : isUnlimitedPlan
                        ? "bg-[#b10f38] hover:bg-[#970d31]"
                        : "border border-[#c1123f]/14 bg-white text-black hover:border-[#c1123f]/25 hover:bg-[#fff7f8]"
                    }`}
                  >
                    <span
                      className={`text-base ${
                        isCurrentPlan
                          ? "text-black/60"
                          : isUnlimitedPlan
                          ? "text-white"
                          : "text-black"
                      }`}
                    >
                      {getPlanButtonLabel({
                        planId: plan.id,
                        planName: plan.name,
                        isCurrentPlan,
                      })}
                    </span>
                  </Link>
                )}

                {!loading && isCurrentPlan ? (
                  <p className="mt-3 text-center text-xs text-black/45">
                    This is your current active plan.
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>

        <p className="mt-6 text-center text-sm leading-7 text-black/52">
          Pro And Unlimited Renew Automatically Every Month Until Cancelled. Read
          Our{" "}
          <Link className="text-[#b10f38]" href="/refunds-cancellation">
            Refund And Cancellation Policy
          </Link>
          .
        </p>

        {!loading && user ? <AccountDeletionPanel /> : null}
      </div>
    </main>
  );
}
