"use client";

import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/firebase/config";
import {
  getUserWithFirestoreFallback,
  saveUser,
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

type DevSwitchCharacterResponse = {
  ok?: boolean;
  error?: string;
  selectedCharacter?: "luna" | "ivy" | "sienna";
  conversationCleared?: boolean;
};

type DevCharacterId = "luna" | "ivy" | "sienna";

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

export default function BillingPage() {
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

  const [devCharacterId, setDevCharacterId] =
    useState<DevCharacterId>("luna");
  const [isSwitchingCharacter, setIsSwitchingCharacter] = useState(false);
  const [characterSwitchMessage, setCharacterSwitchMessage] = useState("");
  const [characterSwitchType, setCharacterSwitchType] = useState<
    "idle" | "success" | "error"
  >("idle");

  useEffect(() => {
    async function loadUser() {
      try {
        const savedUser = await getUserWithFirestoreFallback();
        setUser(savedUser);

        if (
          savedUser?.selectedCharacter === "luna" ||
          savedUser?.selectedCharacter === "ivy" ||
          savedUser?.selectedCharacter === "sienna"
        ) {
          setDevCharacterId(savedUser.selectedCharacter);
        }

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
        console.error("Failed to load billing page user:", error);
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

  const isPaidPlan = currentPlan.id === "pro" || currentPlan.id === "unlimited";
  const isUnlimitedPlan = currentPlan.id === "unlimited";
  const selectedCharacterId = user?.selectedCharacter || "luna";

  const isCancellationScheduled =
    billingStatus.subscriptionCancelAtPeriodEnd === true;

  const isDowngradeScheduled =
    billingStatus.subscriptionDowngradeToProAtPeriodEnd === true;

  async function handleDevCharacterSwitch() {
    if (!user?.id) {
      setCharacterSwitchType("error");
      setCharacterSwitchMessage("No signed-in test account was found.");
      return;
    }

    if (devCharacterId === user.selectedCharacter) {
      setCharacterSwitchType("error");
      setCharacterSwitchMessage(
        `This test account is already using ${
          devCharacterId === "ivy"
            ? "Ivy"
            : devCharacterId === "sienna"
            ? "Sienna"
            : "Luna"
        }.`
      );
      return;
    }

    try {
      setIsSwitchingCharacter(true);
      setCharacterSwitchType("idle");
      setCharacterSwitchMessage(
        "Switching companion and clearing this test account’s chat history..."
      );

      const firebaseIdToken = await getFirebaseIdToken();

      if (!firebaseIdToken) {
        throw new Error("Please sign in again before switching companion.");
      }

      const response = await fetch("/api/dev/switch-character", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firebaseIdToken}`,
        },
        body: JSON.stringify({
          characterId: devCharacterId,
        }),
      });

      const data = (await response.json()) as DevSwitchCharacterResponse;

      if (!response.ok || !data.ok || !data.selectedCharacter) {
        throw new Error(data.error || "Could not switch test companion.");
      }

      const updatedUser: StoredUser = {
        ...user,
        selectedCharacter: data.selectedCharacter,
      };

      setUser(updatedUser);
      saveUser(updatedUser);

      setCharacterSwitchType("success");
      setCharacterSwitchMessage(
        `Switched to ${
          data.selectedCharacter === "ivy"
            ? "Ivy"
            : data.selectedCharacter === "sienna"
            ? "Sienna"
            : "Luna"
        }. The previous chat history for this test account was cleared.`
      );
    } catch (error) {
      console.error("Failed to switch development companion:", error);
      setCharacterSwitchType("error");
      setCharacterSwitchMessage(
        error instanceof Error
          ? error.message
          : "Could not switch test companion."
      );
    } finally {
      setIsSwitchingCharacter(false);
    }
  }

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
          formatBillingDate(
            refreshedBillingStatus.subscriptionCurrentPeriodEndIso
          )
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
      console.error("Failed to cancel subscription:", error);
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
      console.error("Failed to schedule downgrade to Pro:", error);
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
          <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#c1123f] sm:text-[13px]">
            Billing
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-black sm:text-5xl">
            Manage your plan
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-8 text-black/65 sm:text-lg">
            You can cancel your paid plan here. Your plan stays active until the
            end of your current paid billing period, then your account returns
            to Free.
          </p>

          <div className="mt-8 rounded-[1.75rem] border border-[#c1123f]/8 bg-[#fff8f8] p-5 sm:p-6">
            {isLoadingUser ? (
              <p className="text-base leading-8 text-black/68">
                Checking your saved account...
              </p>
            ) : user ? (
              <div className="space-y-3 text-base leading-8 text-black/68">
                <p>
                  Account:{" "}
                  <span className="font-semibold text-black">
                    {user.email || user.name || "Current test user"}
                  </span>
                </p>

                <p>
                  Current plan:{" "}
                  <span className="font-semibold text-black">
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
              <p className="text-base leading-8 text-black/68">
                No saved account was found. Please return to chat or sign up
                again.
              </p>
            )}
          </div>

          {process.env.NODE_ENV !== "production" ? (
            <div className="mt-6 rounded-[1.75rem] border-2 border-dashed border-[#c1123f]/25 bg-[#fff4f6] p-5 sm:p-6">
              <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#c1123f] sm:text-[13px]">
                DEV TESTING ONLY
              </p>

              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-black">
                Switch test companion
              </h2>

              <p className="mt-3 text-sm leading-7 text-black/62 sm:text-base">
                This temporary control changes the test account between Luna,
                Ivy, and Sienna. Switching also clears this account’s current
                conversation history so the next companion starts with a clean
                chat. This control is disabled automatically in production.
              </p>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1">
                  <span className="mb-2 block text-sm font-semibold text-black">
                    Companion
                  </span>

                  <select
                    value={devCharacterId}
                    onChange={(event) =>
                      setDevCharacterId(event.target.value as DevCharacterId)
                    }
                    disabled={isSwitchingCharacter}
                    className="min-h-12 w-full rounded-[1.15rem] border border-[#c1123f]/14 bg-white px-4 py-3 text-base text-black outline-none transition focus:border-[#c1123f]/35 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="luna">Luna</option>
                    <option value="ivy">Ivy</option>
                    <option value="sienna">Sienna</option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={handleDevCharacterSwitch}
                  disabled={isSwitchingCharacter || !user?.id}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#b10f38] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#970d31] disabled:cursor-not-allowed disabled:bg-black/20"
                >
                  {isSwitchingCharacter
                    ? "Switching..."
                    : "Switch test companion"}
                </button>
              </div>

              {characterSwitchMessage ? (
                <p
                  className={`mt-4 rounded-[1.2rem] border px-4 py-3 text-sm leading-6 ${
                    characterSwitchType === "error"
                      ? "border-[#c1123f]/12 bg-white text-[#8f0d2f]"
                      : characterSwitchType === "success"
                      ? "border-black/8 bg-white text-black/72"
                      : "border-black/8 bg-white text-black/55"
                  }`}
                >
                  {characterSwitchMessage}
                </p>
              ) : null}

              {characterSwitchType === "success" && user?.selectedCharacter ? (
                <Link
                  href={`/chat/${user.selectedCharacter}`}
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-5 py-2 text-sm font-semibold text-black transition hover:border-[#c1123f]/25 hover:bg-[#fff7f8]"
                >
                  Open fresh test chat
                </Link>
              ) : null}
            </div>
          ) : null}

          {isPaidPlan && isCancellationScheduled ? (
            <div className="mt-6 rounded-[1.75rem] border border-[#c1123f]/10 bg-white p-5 shadow-[0_10px_30px_rgba(111,0,23,0.04)] sm:p-6">
              <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#c1123f] sm:text-[13px]">
                Cancellation scheduled
              </p>

              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-black">
                Your {currentPlan.name} plan is cancelled
              </h2>

              <p className="mt-3 text-base leading-8 text-black/62">
                {cancelEndDate
                  ? `You can keep using ${currentPlan.name} until ${cancelEndDate}. You will not be charged again.`
                  : `You can keep using ${currentPlan.name} until the end of your current paid billing period. You will not be charged again.`}
              </p>
            </div>
          ) : null}

          {isUnlimitedPlan && isDowngradeScheduled ? (
            <div className="mt-6 rounded-[1.75rem] border border-[#c1123f]/10 bg-white p-5 shadow-[0_10px_30px_rgba(111,0,23,0.04)] sm:p-6">
              <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#c1123f] sm:text-[13px]">
                Downgrade scheduled
              </p>

              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-black">
                Your plan will move to Pro
              </h2>

              <p className="mt-3 text-base leading-8 text-black/62">
                {downgradeDate
                  ? `You can keep using Unlimited until ${downgradeDate}. After that, your plan will become Pro.`
                  : "You can keep using Unlimited until the end of your current paid billing period. After that, your plan will become Pro."}
              </p>
            </div>
          ) : null}

          {isUnlimitedPlan && !isCancellationScheduled ? (
            <div className="mt-6 rounded-[1.75rem] border border-[#c1123f]/10 bg-white p-5 shadow-[0_10px_30px_rgba(111,0,23,0.04)] sm:p-6">
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-black">
                Downgrade to Pro
              </h2>

              <p className="mt-3 text-base leading-8 text-black/62">
                You can schedule a downgrade to Pro. You will keep Unlimited
                until the end of your current paid billing period. After that,
                your plan will move to Pro and your next billing cycle will use
                the Pro price.
              </p>

              <div className="mt-5 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="mt-1 text-sm text-[#c1123f]">•</span>
                  <p className="text-sm leading-7 text-black/72 sm:text-base">
                    You keep Unlimited until the end of the current paid period.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <span className="mt-1 text-sm text-[#c1123f]">•</span>
                  <p className="text-sm leading-7 text-black/72 sm:text-base">
                    After that, your plan changes to Pro.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <span className="mt-1 text-sm text-[#c1123f]">•</span>
                  <p className="text-sm leading-7 text-black/72 sm:text-base">
                    Pro includes unlimited text, 10 personal selfies per day, and 3
                    spicy images per day.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDowngradeToPro}
                disabled={isDowngrading || isDowngradeScheduled}
                className="mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-7 py-3 text-base font-semibold text-black transition hover:border-[#c1123f]/25 hover:bg-[#fff7f8] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isDowngradeScheduled
                  ? "Downgrade scheduled"
                  : isDowngrading
                  ? "Scheduling downgrade..."
                  : "Downgrade to Pro"}
              </button>

              {downgradeStatusMessage ? (
                <p
                  className={`mt-4 rounded-[1.25rem] border px-4 py-3 text-sm leading-7 ${
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

              {downgradeDate ? (
                <p className="mt-3 text-sm leading-7 text-black/50">
                  Unlimited remains active until {downgradeDate}.
                </p>
              ) : null}
            </div>
          ) : null}

          {isPaidPlan ? (
            <div className="mt-6 rounded-[1.75rem] border border-[#c1123f]/10 bg-white p-5 shadow-[0_10px_30px_rgba(111,0,23,0.04)] sm:p-6">
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-black">
                Before you cancel
              </h2>

              <p className="mt-3 text-base leading-8 text-black/62">
                When your paid period ends, your account will return to Free and
                you will lose the paid features included with {currentPlan.name}.
              </p>

              <div className="mt-5 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="mt-1 text-sm text-[#c1123f]">•</span>
                  <p className="text-sm leading-7 text-black/72 sm:text-base">
                    Your account will go back to the Free daily message limit.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <span className="mt-1 text-sm text-[#c1123f]">•</span>
                  <p className="text-sm leading-7 text-black/72 sm:text-base">
                    Personal selfie access will stop when the paid period ends.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <span className="mt-1 text-sm text-[#c1123f]">•</span>
                  <p className="text-sm leading-7 text-black/72 sm:text-base">
                    Spicy image access will stop when the paid period ends.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <span className="mt-1 text-sm text-[#c1123f]">•</span>
                  <p className="text-sm leading-7 text-black/72 sm:text-base">
                    You will not be charged again after cancellation is
                    scheduled.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCancelSubscription}
                disabled={
                  isCancelling ||
                  cancelStatusType === "success" ||
                  isCancellationScheduled
                }
                className="mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#b10f38] px-7 py-3 text-base font-semibold text-white transition hover:bg-[#970d31] disabled:cursor-not-allowed disabled:bg-black/20 sm:w-auto"
              >
                {isCancellationScheduled
                  ? "Cancellation scheduled"
                  : isCancelling
                  ? "Cancelling plan..."
                  : "Cancel my plan"}
              </button>

              {cancelStatusMessage ? (
                <p
                  className={`mt-4 rounded-[1.25rem] border px-4 py-3 text-sm leading-7 ${
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
                <p className="mt-3 text-sm leading-7 text-black/50">
                  Access remains active until {cancelEndDate}.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-6 rounded-[1.75rem] border border-[#c1123f]/10 bg-white p-5 shadow-[0_10px_30px_rgba(111,0,23,0.04)] sm:p-6">
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-black">
                No paid plan to cancel
              </h2>

              <p className="mt-3 text-base leading-8 text-black/62">
                You are currently on Free, so there is no active subscription to
                cancel.
              </p>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/chat/${selectedCharacterId}`}
              className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#b10f38] px-7 py-3 font-semibold transition hover:bg-[#970d31]"
            >
              <span className="text-base text-white">Back to chat</span>
            </Link>

            <Link
              href="/upgrade"
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-7 py-3 font-semibold transition hover:border-[#c1123f]/25 hover:bg-[#fff7f8]"
            >
              <span className="text-base text-black">View plans</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}