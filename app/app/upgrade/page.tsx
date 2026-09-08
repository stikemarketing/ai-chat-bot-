"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CharacterSwitchPanel from "@/components/CharacterSwitchPanel";
import AccountDeletionPanel from "@/components/AccountDeletionPanel";
import { auth } from "@/firebase/config";
import {
  getUserWithFirestoreFallback,
  waitForFirebaseAuthUser,
  type StoredUser,
} from "@/lib/user";
import {
  getPlanDefinition,
  normalizePlan,
  PLAN_DEFINITIONS,
  type AppPlan,
} from "@/lib/plans";

type CheckoutApiResponse = {
  url?: string;
  error?: string;
};

type CheckoutPlan = "pro" | "unlimited";

function getPlanBadge(planId: AppPlan) {
  if (planId === "pro") {
    return "Popular";
  }

  if (planId === "unlimited") {
    return "Full access";
  }

  return "Starter";
}

function getPlanDescription(planId: AppPlan) {
  if (planId === "free") {
    return "Try your companion with daily messages, flirty chat, and teasing spicy previews.";
  }

  if (planId === "pro") {
    return "Unlimited text chat, full spicy chat, daily personal selfies, and a small spicy image allowance.";
  }

  return "The full companion experience with full spicy chat, unlimited personal selfies, and unlimited spicy images.";
}

function getPlanSubNote(planId: AppPlan) {
  if (planId === "free") {
    return "Free includes a taste of Luna’s teasing side, but full spicy chat and images unlock on paid plans.";
  }

  if (planId === "pro") {
    return "Pro includes proper spicy chat with daily image allowances. Upgrade to Unlimited if you want unrestricted image access.";
  }

  return "Unlimited gives the strongest spicy experience with no daily image limits.";
}

function getSpicyAccessTitle(planId: AppPlan) {
  if (planId === "free") {
    return "Spicy preview";
  }

  if (planId === "pro") {
    return "Full spicy chat";
  }

  return "Full spicy access";
}

function getSpicyAccessHighlights(planId: AppPlan) {
  if (planId === "free") {
    return [
      "Flirty chat and teasing spicy previews included.",
      "No full dirty talk on Free.",
      "Upgrade when you want Luna to stop holding back.",
    ];
  }

  if (planId === "pro") {
    return [
      "Full spicy chat included.",
      "Daily personal selfies included.",
      "Limited spicy images included.",
    ];
  }

  return [
    "Full spicy chat included.",
    "Unlimited personal selfies included.",
    "Unlimited spicy images included.",
  ];
}

function getCheckoutPlan(planId: AppPlan): CheckoutPlan | null {
  if (planId === "pro" || planId === "unlimited") {
    return planId;
  }

  return null;
}

function getPlanButtonLabel(params: {
  planId: AppPlan;
  planName: string;
  isCurrentPlan: boolean;
  isStartingCheckout: boolean;
}) {
  if (params.isStartingCheckout) {
    return "Opening Stripe...";
  }

  if (params.planId === "free") {
    return params.isCurrentPlan ? "Current plan" : "Free plan";
  }

  if (params.isCurrentPlan) {
    return `Already on ${params.planName}`;
  }

  if (params.planId === "unlimited") {
    return "Upgrade to Unlimited";
  }

  return "Upgrade to Pro";
}

async function getFirebaseIdToken() {
  const firebaseUser = auth.currentUser || (await waitForFirebaseAuthUser());

  if (!firebaseUser) {
    return "";
  }

  return firebaseUser.getIdToken();
}

export default function AppUpgradePage() {
  const [hasMounted, setHasMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingPlanCheckout, setStartingPlanCheckout] =
    useState<CheckoutPlan | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setHasMounted(true);

    async function loadUser() {
      try {
        const savedUser = await getUserWithFirestoreFallback();
        setUser(savedUser);
      } catch (error) {
        console.error("Failed to load app upgrade user:", error);
        setErrorMessage("Could not load your saved account.");
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  const currentPlan = useMemo(() => {
    return getPlanDefinition(normalizePlan(user?.plan));
  }, [user?.plan]);

  const selectedCharacterId = user?.selectedCharacter || "luna";
  const isPaidPlan =
    currentPlan.id === "pro" || currentPlan.id === "unlimited";

  async function startCheckout(params: {
    planId?: CheckoutPlan;
    checkoutType?: "subscription";
  }) {
    const savedUser = await getUserWithFirestoreFallback();

    if (!savedUser?.id) {
      setErrorMessage("Please sign in again before starting checkout.");
      return;
    }

    const firebaseIdToken = await getFirebaseIdToken();

    if (!firebaseIdToken) {
      setErrorMessage("Please sign in again before starting checkout.");
      return;
    }

    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${firebaseIdToken}`,
      },
      body: JSON.stringify({
        characterId: savedUser.selectedCharacter || selectedCharacterId,
        planId: params.planId,
        checkoutType: params.checkoutType || "subscription",
        source: "app",
      }),
    });

    const data = (await response.json()) as CheckoutApiResponse;

    if (!response.ok) {
      throw new Error(data.error || "Failed to create Stripe checkout.");
    }

    if (!data.url) {
      throw new Error("Stripe checkout URL was empty.");
    }

    window.location.href = data.url;
  }

  async function handleStartPlanCheckout(planId: CheckoutPlan) {
    try {
      setErrorMessage("");
      setStartingPlanCheckout(planId);

      await startCheckout({
        planId,
        checkoutType: "subscription",
      });
    } catch (error) {
      console.error("Failed to start app plan checkout:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not start checkout."
      );
    } finally {
      setStartingPlanCheckout(null);
    }
  }


  if (!hasMounted || loading) {
    return (
      <main className="min-h-screen bg-[#f7eeee] px-4 py-5 text-[#111111]">
        <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center">
          <div className="w-full rounded-[1.75rem] border border-[#c1123f]/10 bg-white/80 p-6 text-center shadow-[0_16px_45px_rgba(111,0,23,0.05)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#c1123f]">
              Plans
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-black">
              Loading upgrade options
            </h1>
            <p className="mt-3 text-sm leading-7 text-black/55">
              Checking your account and current plan...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7eeee] px-4 py-5 text-[#111111]">
      <div className="mx-auto w-full max-w-3xl">
        <header className="sticky top-0 z-20 -mx-4 -mt-5 border-b border-black/5 bg-white/95 px-4 py-4 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#c1123f]">
                Plans
              </p>
              <h1 className="mt-1 text-xl font-bold tracking-[-0.03em] text-black">
                Upgrade access
              </h1>
            </div>

            <Link
              href={`/app/chat/${selectedCharacterId}`}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#f7eeee] px-4 py-2 text-sm font-bold text-black"
            >
              Chat
            </Link>
          </div>
        </header>

        <section className="mt-5 rounded-[1.75rem] border border-[#c1123f]/10 bg-white/80 p-5 shadow-[0_16px_45px_rgba(111,0,23,0.05)]">
          <div className="space-y-2 text-sm leading-6 text-black/65">
            <p>
              Current plan:{" "}
              <span className="font-bold text-black">{currentPlan.name}</span>
            </p>

            <p>
              Account:{" "}
              <span className="preserve-case text-black">
                {user?.email || user?.name || "Not signed in"}
              </span>
            </p>

            {isPaidPlan ? (
              <Link
                href="/app/account"
                className="mt-3 inline-flex min-h-10 items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-4 py-2 text-sm font-bold text-black"
              >
                Manage billing
              </Link>
            ) : null}
          </div>

          {errorMessage ? (
            <p className="mt-4 rounded-[1.2rem] border border-[#c1123f]/12 bg-[#fff4f6] px-4 py-3 text-sm leading-6 text-[#8f0d2f]">
              {errorMessage}
            </p>
          ) : null}
        </section>

        {user ? (
          <div className="mt-5">
            <CharacterSwitchPanel source="app" />
          </div>
        ) : null}

        <section className="mt-5 space-y-4">
          {Object.values(PLAN_DEFINITIONS).map((plan) => {
            const isCurrentPlan = currentPlan.id === plan.id;
            const isUnlimitedPlan = plan.id === "unlimited";
            const checkoutPlan = getCheckoutPlan(plan.id);
            const isStartingThisPlan = startingPlanCheckout === checkoutPlan;

            return (
              <article
                key={plan.id}
                className={`rounded-[1.75rem] border p-5 shadow-[0_16px_45px_rgba(111,0,23,0.04)] ${
                  isUnlimitedPlan
                    ? "border-[#c1123f]/18 bg-[linear-gradient(135deg,#fff7f8,rgba(193,18,63,0.12))]"
                    : plan.highlighted
                    ? "border-[#c1123f]/14 bg-[linear-gradient(135deg,#fff7f8,rgba(193,18,63,0.07))]"
                    : "border-[#c1123f]/10 bg-white/82"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold tracking-[-0.03em] text-black">
                      {plan.name}
                    </h2>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-black">
                      {plan.priceLabel}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      isUnlimitedPlan
                        ? "bg-[#b10f38] text-white"
                        : "bg-[#fff1f4] text-[#c1123f]"
                    }`}
                  >
                    {getPlanBadge(plan.id)}
                  </span>
                </div>

                <p className="mt-4 text-sm leading-7 text-black/65">
                  {getPlanDescription(plan.id)}
                </p>

                <p className="mt-2 text-xs leading-6 text-black/45">
                  {getPlanSubNote(plan.id)}
                </p>

                {checkoutPlan ? (
                  <p className="mt-2 text-xs leading-6 text-black/50">
                    Renews Automatically Every Month Until Cancelled.
                  </p>
                ) : null}

                <div className="mt-4 rounded-[1.35rem] border border-[#c1123f]/10 bg-white/65 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#c1123f]">
                    {getSpicyAccessTitle(plan.id)}
                  </p>

                  <div className="mt-3 space-y-2">
                    {getSpicyAccessHighlights(plan.id).map((highlight) => (
                      <div key={highlight} className="flex items-start gap-2.5">
                        <span className="mt-1 text-xs text-[#c1123f]">•</span>
                        <p className="text-xs leading-5 text-black/62">
                          {highlight}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 space-y-2.5">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <span className="mt-1 text-sm text-[#c1123f]">•</span>
                      <p className="text-sm leading-6 text-black/72">
                        {feature}
                      </p>
                    </div>
                  ))}
                </div>

                {checkoutPlan ? (
                  <button
                    type="button"
                    onClick={() => handleStartPlanCheckout(checkoutPlan)}
                    disabled={
                      isCurrentPlan ||
                      Boolean(startingPlanCheckout)
                    }
                    className={`mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 py-3 text-sm font-bold transition disabled:cursor-not-allowed ${
                      isCurrentPlan
                        ? "border border-black/10 bg-black/5 text-black/50"
                        : isUnlimitedPlan
                        ? "bg-[#b10f38] text-white hover:bg-[#970d31] disabled:bg-black/20"
                        : "border border-[#c1123f]/14 bg-white text-black hover:bg-[#fff7f8] disabled:opacity-60"
                    }`}
                  >
                    {getPlanButtonLabel({
                      planId: plan.id,
                      planName: plan.name,
                      isCurrentPlan,
                      isStartingCheckout: isStartingThisPlan,
                    })}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="mt-6 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-full border border-black/10 bg-black/5 px-5 py-3 text-sm font-bold text-black/50"
                  >
                    {getPlanButtonLabel({
                      planId: plan.id,
                      planName: plan.name,
                      isCurrentPlan,
                      isStartingCheckout: false,
                    })}
                  </button>
                )}

                {isCurrentPlan ? (
                  <p className="mt-3 text-center text-xs text-black/42">
                    This is your current active plan.
                  </p>
                ) : null}
              </article>
            );
          })}
        </section>

        <p className="mt-5 text-center text-xs leading-6 text-black/48">
          Paid Plans Renew Monthly Until Cancelled. Read Our{" "}
          <Link className="text-[#b10f38]" href="/refunds-cancellation">
            Refund And Cancellation Policy
          </Link>
          .
        </p>

        {user ? <AccountDeletionPanel /> : null}


        <div className="h-8" />
      </div>
    </main>
  );
}
