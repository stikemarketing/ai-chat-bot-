"use client";

import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/firebase/config";
import {
  getUserWithFirestoreFallback,
  waitForFirebaseAuthUser,
  type StoredUser,
} from "@/lib/user";
import { getPlanDefinition, normalizePlan } from "@/lib/plans";

type CancelSubscriptionResponse = {
  ok?: boolean;
  error?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: number | null;
  currentPeriodEndIso?: string | null;
};

type DowngradeToProResponse = {
  ok?: boolean;
  error?: string;
  downgradeToProAtPeriodEnd?: boolean;
  currentPeriodEnd?: number | null;
  currentPeriodEndIso?: string | null;
};

type BillingStatus = {
  subscriptionCancelAtPeriodEnd: boolean;
  subscriptionCurrentPeriodEndIso: string | null;
  subscriptionDowngradeToProAtPeriodEnd: boolean;
  subscriptionDowngradeEffectiveAtIso: string | null;
};

async function getFirebaseIdToken() {
  const firebaseUser = auth.currentUser || (await waitForFirebaseAuthUser());

  if (!firebaseUser) {
    return "";
  }

  return firebaseUser.getIdToken();
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

function getSafeString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return trimmedValue;
}

function getIsoFromUnknownDate(value: unknown) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return null;
    }

    const date = new Date(trimmedValue);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  }

  if (typeof value === "number") {
    const milliseconds = value < 1000000000000 ? value * 1000 : value;
    const date = new Date(milliseconds);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return value.toISOString();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const date = value.toDate() as Date;

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof value.seconds === "number"
  ) {
    const date = new Date(value.seconds * 1000);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  }

  return null;
}

function getFirstSafeDateIso(...values: unknown[]) {
  for (const value of values) {
    const isoValue = getIsoFromUnknownDate(value);

    if (isoValue) {
      return isoValue;
    }
  }

  return null;
}

function formatBillingDate(value: unknown) {
  const isoValue = getIsoFromUnknownDate(value);

  if (!isoValue) {
    return null;
  }

  const date = new Date(isoValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

async function getBillingStatus(userId: string): Promise<BillingStatus> {
  const userSnapshot = await getDoc(doc(db, "users", userId));

  if (!userSnapshot.exists()) {
    return {
      subscriptionCancelAtPeriodEnd: false,
      subscriptionCurrentPeriodEndIso: null,
      subscriptionDowngradeToProAtPeriodEnd: false,
      subscriptionDowngradeEffectiveAtIso: null,
    };
  }

  const data = userSnapshot.data();

  const subscriptionCurrentPeriodEndIso = getFirstSafeDateIso(
    getSafeString(data.subscriptionCurrentPeriodEndIso),
    data.subscriptionCurrentPeriodEnd,
    getSafeString(data.currentPeriodEndIso),
    data.currentPeriodEnd,
    data.stripeCurrentPeriodEnd
  );

  const subscriptionDowngradeEffectiveAtIso = getFirstSafeDateIso(
    getSafeString(data.subscriptionDowngradeEffectiveAtIso),
    data.subscriptionDowngradeEffectiveAt,
    getSafeString(data.subscriptionCurrentPeriodEndIso),
    data.subscriptionCurrentPeriodEnd,
    getSafeString(data.currentPeriodEndIso),
    data.currentPeriodEnd,
    data.stripeCurrentPeriodEnd
  );

  return {
    subscriptionCancelAtPeriodEnd:
      data.subscriptionCancelAtPeriodEnd === true,
    subscriptionCurrentPeriodEndIso,
    subscriptionDowngradeToProAtPeriodEnd:
      data.subscriptionDowngradeToProAtPeriodEnd === true,
    subscriptionDowngradeEffectiveAtIso,
  };
}

export default function AppAccountPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatus>({
    subscriptionCancelAtPeriodEnd: false,
    subscriptionCurrentPeriodEndIso: null,
    subscriptionDowngradeToProAtPeriodEnd: false,
    subscriptionDowngradeEffectiveAtIso: null,
  });

  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelStatusMessage, setCancelStatusMessage] = useState("");
  const [cancelStatusType, setCancelStatusType] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [cancelEndDate, setCancelEndDate] = useState<string | null>(null);

  const [isDowngrading, setIsDowngrading] = useState(false);
  const [downgradeStatusMessage, setDowngradeStatusMessage] = useState("");
  const [downgradeStatusType, setDowngradeStatusType] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [downgradeDate, setDowngradeDate] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const savedUser = await getUserWithFirestoreFallback();
        setUser(savedUser);

        if (savedUser?.id) {
          const status = await getBillingStatus(savedUser.id);
          setBillingStatus(status);
          setCancelEndDate(
            formatBillingDate(status.subscriptionCurrentPeriodEndIso)
          );
          setDowngradeDate(
            formatBillingDate(status.subscriptionDowngradeEffectiveAtIso)
          );
        }
      } catch (error) {
        console.error("Failed to load app account user:", error);
        setCancelStatusType("error");
        setCancelStatusMessage("Could not load your saved account.");
      } finally {
        setIsLoadingUser(false);
      }
    }

    loadUser();
  }, []);

  const currentPlan = useMemo(() => {
    return getPlanDefinition(normalizePlan(user?.plan));
  }, [user?.plan]);

  const selectedCharacterId = user?.selectedCharacter || "luna";
  const isPaidPlan = currentPlan.id === "pro" || currentPlan.id === "unlimited";
  const isUnlimitedPlan = currentPlan.id === "unlimited";

  const isCancellationScheduled =
    billingStatus.subscriptionCancelAtPeriodEnd === true;

  const isDowngradeScheduled =
    billingStatus.subscriptionDowngradeToProAtPeriodEnd === true;

  async function handleCancelSubscription() {
    if (!user?.id) {
      setCancelStatusType("error");
      setCancelStatusMessage(
        "We could not find your saved account. Please return to chat and try again."
      );
      return;
    }

    if (!isPaidPlan) {
      setCancelStatusType("error");
      setCancelStatusMessage("Your account is already on the Free plan.");
      return;
    }

    try {
      setIsCancelling(true);
      setCancelStatusType("idle");
      setCancelStatusMessage(
        "Cancelling your plan at the end of your billing period..."
      );

      const firebaseIdToken = await getFirebaseIdToken();

      if (!firebaseIdToken) {
        throw new Error("Please sign in again before cancelling your plan.");
      }

      const response = await fetch("/api/stripe/cancel-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firebaseIdToken}`,
        },
        body: JSON.stringify({}),
      });

      const data = (await response.json()) as CancelSubscriptionResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Could not cancel your subscription.");
      }

      const formattedEndDate =
        formatBillingDate(data.currentPeriodEndIso) ||
        formatBillingDate(data.currentPeriodEnd);

      const refreshedBillingStatus = await getBillingStatus(user.id);

      setBillingStatus(refreshedBillingStatus);
      setCancelEndDate(
        formattedEndDate ||
          formatBillingDate(refreshedBillingStatus.subscriptionCurrentPeriodEndIso)
      );

      setCancelStatusType("success");
      setCancelStatusMessage(
        formattedEndDate
          ? `Your ${getPlanLabel(
              currentPlan.id
            )} plan has been cancelled. You can keep using it until ${formattedEndDate}. You will not be charged again.`
          : `Your ${getPlanLabel(
              currentPlan.id
            )} plan has been cancelled at the end of your current billing period. You will not be charged again.`
      );
    } catch (error) {
      console.error("Failed to cancel app subscription:", error);
      setCancelStatusType("error");
      setCancelStatusMessage(
        error instanceof Error
          ? error.message
          : "Could not cancel your subscription."
      );
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleDowngradeToPro() {
    if (!user?.id) {
      setDowngradeStatusType("error");
      setDowngradeStatusMessage(
        "We could not find your saved account. Please return to chat and try again."
      );
      return;
    }

    if (!isUnlimitedPlan) {
      setDowngradeStatusType("error");
      setDowngradeStatusMessage(
        "Only Unlimited users can downgrade to Pro from this page."
      );
      return;
    }

    try {
      setIsDowngrading(true);
      setDowngradeStatusType("idle");
      setDowngradeStatusMessage(
        "Scheduling your downgrade to Pro for the end of your billing period..."
      );

      const firebaseIdToken = await getFirebaseIdToken();

      if (!firebaseIdToken) {
        throw new Error("Please sign in again before changing your plan.");
      }

      const response = await fetch("/api/stripe/downgrade-to-pro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firebaseIdToken}`,
        },
        body: JSON.stringify({}),
      });

      const data = (await response.json()) as DowngradeToProResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Could not schedule downgrade to Pro.");
      }

      const formattedDowngradeDate =
        formatBillingDate(data.currentPeriodEndIso) ||
        formatBillingDate(data.currentPeriodEnd);

      const refreshedBillingStatus = await getBillingStatus(user.id);

      setBillingStatus(refreshedBillingStatus);
      setDowngradeDate(
        formattedDowngradeDate ||
          formatBillingDate(
            refreshedBillingStatus.subscriptionDowngradeEffectiveAtIso
          )
      );

      setDowngradeStatusType("success");
      setDowngradeStatusMessage(
        formattedDowngradeDate
          ? `Your downgrade to Pro has been scheduled. You can keep using Unlimited until ${formattedDowngradeDate}.`
          : "Your downgrade to Pro has been scheduled. You can keep using Unlimited until the end of your current billing period."
      );
    } catch (error) {
      console.error("Failed to schedule app downgrade:", error);
      setDowngradeStatusType("error");
      setDowngradeStatusMessage(
        error instanceof Error
          ? error.message
          : "Could not schedule downgrade to Pro."
      );
    } finally {
      setIsDowngrading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7eeee] px-4 py-5 text-[#111111]">
      <div className="mx-auto w-full max-w-3xl">
        <header className="sticky top-0 z-20 -mx-4 -mt-5 border-b border-black/5 bg-white/95 px-4 py-4 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#c1123f]">
                Account
              </p>
              <h1 className="mt-1 text-xl font-bold tracking-[-0.03em] text-black">
                Billing
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
          {isLoadingUser ? (
            <p className="text-sm text-black/50">Checking your account...</p>
          ) : user ? (
            <div className="space-y-2 text-sm leading-6 text-black/65">
              <p>
                Account:{" "}
                <span className="font-bold text-black">
                  {user.email || user.name || "Current user"}
                </span>
              </p>

              <p>
                Current plan:{" "}
                <span className="font-bold text-black">
                  {currentPlan.name}
                </span>
              </p>

              {isPaidPlan ? (
                <p>
                  Your billing cycle is based on the date you signed up. It is
                  not fixed to the 1st of the month.
                </p>
              ) : (
                <p>Your account is currently on the Free plan.</p>
              )}
            </div>
          ) : (
            <p className="text-sm leading-6 text-black/65">
              No saved account was found. Please return to chat or sign up
              again.
            </p>
          )}
        </section>

        {isPaidPlan && isCancellationScheduled ? (
          <section className="mt-5 rounded-[1.75rem] border border-[#c1123f]/10 bg-white p-5 shadow-[0_16px_45px_rgba(111,0,23,0.04)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#c1123f]">
              Cancellation scheduled
            </p>

            <h2 className="mt-2 text-xl font-bold tracking-[-0.03em] text-black">
              Your {currentPlan.name} plan is cancelled
            </h2>

            <p className="mt-3 text-sm leading-7 text-black/62">
              {cancelEndDate
                ? `You can keep using ${currentPlan.name} until ${cancelEndDate}. You will not be charged again.`
                : `You can keep using ${currentPlan.name} until the end of your current paid billing period. You will not be charged again.`}
            </p>
          </section>
        ) : null}

        {isUnlimitedPlan && isDowngradeScheduled ? (
          <section className="mt-5 rounded-[1.75rem] border border-[#c1123f]/10 bg-white p-5 shadow-[0_16px_45px_rgba(111,0,23,0.04)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#c1123f]">
              Downgrade scheduled
            </p>

            <h2 className="mt-2 text-xl font-bold tracking-[-0.03em] text-black">
              Your plan will move to Pro
            </h2>

            <p className="mt-3 text-sm leading-7 text-black/62">
              {downgradeDate
                ? `You can keep using Unlimited until ${downgradeDate}. After that, your plan will become Pro.`
                : "You can keep using Unlimited until the end of your current paid billing period. After that, your plan will become Pro."}
            </p>
          </section>
        ) : null}

        {isUnlimitedPlan && !isCancellationScheduled ? (
          <section className="mt-5 rounded-[1.75rem] border border-[#c1123f]/10 bg-white p-5 shadow-[0_16px_45px_rgba(111,0,23,0.04)]">
            <h2 className="text-xl font-bold tracking-[-0.03em] text-black">
              Downgrade to Pro
            </h2>

            <p className="mt-3 text-sm leading-7 text-black/62">
              You can schedule a downgrade to Pro. You will keep Unlimited until
              the end of your current paid billing period.
            </p>

            <button
              type="button"
              onClick={handleDowngradeToPro}
              disabled={isDowngrading || isDowngradeScheduled}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-[#fff7f8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDowngradeScheduled
                ? "Downgrade scheduled"
                : isDowngrading
                ? "Scheduling downgrade..."
                : "Downgrade to Pro"}
            </button>

            {downgradeStatusMessage ? (
              <p
                className={`mt-4 rounded-[1.2rem] border px-4 py-3 text-sm leading-6 ${
                  downgradeStatusType === "error"
                    ? "border-[#c1123f]/12 bg-[#fff4f6] text-[#8f0d2f]"
                    : downgradeStatusType === "success"
                    ? "border-black/8 bg-[#f7f3ef] text-black/72"
                    : "border-black/8 bg-white text-black/55"
                }`}
              >
                {downgradeStatusMessage}
              </p>
            ) : null}
          </section>
        ) : null}

        {isPaidPlan ? (
          <section className="mt-5 rounded-[1.75rem] border border-[#c1123f]/10 bg-white p-5 shadow-[0_16px_45px_rgba(111,0,23,0.04)]">
            <h2 className="text-xl font-bold tracking-[-0.03em] text-black">
              Cancel plan
            </h2>

            <p className="mt-3 text-sm leading-7 text-black/62">
              When your paid period ends, your account will return to Free and
              you will lose the paid features included with {currentPlan.name}.
            </p>

            <button
              type="button"
              onClick={handleCancelSubscription}
              disabled={
                isCancelling ||
                cancelStatusType === "success" ||
                isCancellationScheduled
              }
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#b10f38] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#970d31] disabled:cursor-not-allowed disabled:bg-black/20"
            >
              {isCancellationScheduled
                ? "Cancellation scheduled"
                : isCancelling
                ? "Cancelling plan..."
                : "Cancel my plan"}
            </button>

            {cancelStatusMessage ? (
              <p
                className={`mt-4 rounded-[1.2rem] border px-4 py-3 text-sm leading-6 ${
                  cancelStatusType === "error"
                    ? "border-[#c1123f]/12 bg-[#fff4f6] text-[#8f0d2f]"
                    : cancelStatusType === "success"
                    ? "border-black/8 bg-[#f7f3ef] text-black/72"
                    : "border-black/8 bg-white text-black/55"
                }`}
              >
                {cancelStatusMessage}
              </p>
            ) : null}

            {cancelEndDate ? (
              <p className="mt-3 text-xs leading-6 text-black/45">
                Access remains active until {cancelEndDate}.
              </p>
            ) : null}
          </section>
        ) : (
          <section className="mt-5 rounded-[1.75rem] border border-[#c1123f]/10 bg-white p-5 shadow-[0_16px_45px_rgba(111,0,23,0.04)]">
            <h2 className="text-xl font-bold tracking-[-0.03em] text-black">
              No paid plan to cancel
            </h2>

            <p className="mt-3 text-sm leading-7 text-black/62">
              You are currently on Free, so there is no active subscription to
              cancel.
            </p>

            <Link
              href="/app/upgrade"
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#b10f38] px-5 py-3 text-sm font-bold text-white"
            >
              View plans
            </Link>
          </section>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={`/app/chat/${selectedCharacterId}`}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#b10f38] px-5 py-3 text-sm font-bold text-white"
          >
            Back to chat
          </Link>

          <Link
            href="/app/upgrade"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-5 py-3 text-sm font-bold text-black"
          >
            View plans
          </Link>
        </div>

        <div className="h-8" />
      </div>
    </main>
  );
}