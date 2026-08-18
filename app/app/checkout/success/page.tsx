"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth } from "@/firebase/config";
import { requestPushNotificationPermission } from "@/firebase/messaging";
import {
  getUserWithFirestoreFallback,
  waitForFirebaseAuthUser,
  type StoredUser,
} from "@/lib/user";

type GoodMorningPreferenceResponse = {
  ok?: boolean;
  error?: string;
  enabled?: boolean;
};

type SavePushTokenResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
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

  return "paid";
}

function getSafeCharacterId(characterId: string | null | undefined) {
  if (characterId === "ivy") {
    return "ivy";
  }

  if (characterId === "sienna") {
    return "sienna";
  }

  return "luna";
}

function getCharacterName(characterId: string) {
  if (characterId === "ivy") {
    return "Ivy";
  }

  if (characterId === "sienna") {
    return "Sienna";
  }

  return "Luna";
}

function getSafeCreditCount(credits: string | null | undefined) {
  const parsedCredits = Number(credits || "0");

  if (!Number.isFinite(parsedCredits) || parsedCredits < 1) {
    return 3;
  }

  return Math.floor(parsedCredits);
}

function isPaidSubscriptionPlan(plan: string | null | undefined) {
  return plan === "pro" || plan === "unlimited";
}

function userHasPushEnabled(user: StoredUser | null) {
  return Boolean(user?.pushNotificationsEnabled);
}

function userHasGoodMorningEnabled(user: StoredUser | null) {
  return Boolean(user?.goodMorningMessagesEnabled);
}

function getCheckoutParams() {
  if (typeof window === "undefined") {
    return {
      plan: null,
      characterId: null,
      credit: null,
      credits: null,
    };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    plan: params.get("plan"),
    characterId: params.get("character") || params.get("characterId"),
    credit: params.get("credit"),
    credits: params.get("credits"),
  };
}

export default function AppCheckoutSuccessPage() {
  const [savedUser, setSavedUser] = useState<StoredUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [urlPlan, setUrlPlan] = useState<string | null>(null);
  const [urlCharacterId, setUrlCharacterId] = useState<string | null>(null);
  const [urlCredit, setUrlCredit] = useState<string | null>(null);
  const [urlCredits, setUrlCredits] = useState<string | null>(null);

  const [connectedMessagesStatusMessage, setConnectedMessagesStatusMessage] =
    useState("");
  const [connectedMessagesStatusType, setConnectedMessagesStatusType] =
    useState<"idle" | "success" | "error">("idle");
  const [isTurningOnConnectedMessages, setIsTurningOnConnectedMessages] =
    useState(false);
  const [hasNotificationsEnabled, setHasNotificationsEnabled] = useState(false);
  const [hasGoodMorningEnabled, setHasGoodMorningEnabled] = useState(false);

  useEffect(() => {
    async function loadPageData() {
      try {
        const params = getCheckoutParams();
        setUrlPlan(params.plan);
        setUrlCharacterId(params.characterId);
        setUrlCredit(params.credit);
        setUrlCredits(params.credits);

        const user = await getUserWithFirestoreFallback();
        setSavedUser(user);
        setHasNotificationsEnabled(userHasPushEnabled(user));
        setHasGoodMorningEnabled(userHasGoodMorningEnabled(user));
      } catch (error) {
        console.error("Failed to load app checkout success page data:", error);
      } finally {
        setIsLoadingUser(false);
      }
    }

    loadPageData();
  }, []);

  const isNormalImageCreditSuccess = urlCredit === "normal_image";
  const extraImageCredits = getSafeCreditCount(urlCredits);

  const expectedPlanLabel = useMemo(() => {
    return getPlanLabel(urlPlan || savedUser?.plan);
  }, [urlPlan, savedUser?.plan]);

  const savedPlanLabel = useMemo(() => {
    return savedUser ? getPlanLabel(savedUser.plan) : null;
  }, [savedUser]);

  const chatCharacterId = getSafeCharacterId(
    savedUser?.selectedCharacter || urlCharacterId
  );

  const characterName = getCharacterName(chatCharacterId);

  const shouldShowConnectedMessagesPrompt = Boolean(
    !isNormalImageCreditSuccess &&
      savedUser &&
      isPaidSubscriptionPlan(urlPlan || savedUser.plan)
  );

  const notificationsAreOn =
    hasNotificationsEnabled || userHasPushEnabled(savedUser);

  const goodMorningIsOn =
    hasGoodMorningEnabled || userHasGoodMorningEnabled(savedUser);

  const connectedMessagesAreOn = notificationsAreOn && goodMorningIsOn;

  async function saveGoodMorningPreference(params: {
    firebaseIdToken: string;
    enabled: boolean;
  }) {
    if (!savedUser?.id) {
      throw new Error(
        "We could not find your saved user account. Return to chat and try again."
      );
    }

    const response = await fetch("/api/good-morning/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.firebaseIdToken}`,
      },
      body: JSON.stringify({
        enabled: params.enabled,
        timezone: savedUser.timezone,
        characterId: chatCharacterId,
      }),
    });

    const data = (await response.json()) as GoodMorningPreferenceResponse;

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Could not save good morning preference.");
    }
  }

  async function saveNotificationDevice(params: {
    firebaseIdToken: string;
  }) {
    if (!savedUser?.id) {
      throw new Error(
        "We could not find your saved user account. Return to chat and try again."
      );
    }

    const permissionResult = await requestPushNotificationPermission();

    if (!permissionResult.ok || !permissionResult.token) {
      throw new Error(
        permissionResult.error ||
          "Notifications were not enabled. You can try again from chat."
      );
    }

    const response = await fetch("/api/push/save-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.firebaseIdToken}`,
      },
      body: JSON.stringify({
        token: permissionResult.token,
        characterId: chatCharacterId,
      }),
    });

    const data = (await response.json()) as SavePushTokenResponse;

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
          "Notifications were allowed, but this device could not be saved."
      );
    }
  }

  async function handleTurnOnConnectedMessages() {
    if (!savedUser?.id) {
      setConnectedMessagesStatusType("error");
      setConnectedMessagesStatusMessage(
        "We could not find your saved user account. Return to chat and try again."
      );
      return;
    }

    if (connectedMessagesAreOn) {
      return;
    }

    try {
      setIsTurningOnConnectedMessages(true);
      setConnectedMessagesStatusType("idle");

      const firebaseIdToken = await getFirebaseIdToken();

      if (!firebaseIdToken) {
        throw new Error("Please sign in again before turning on messages.");
      }

      if (!notificationsAreOn) {
        setConnectedMessagesStatusMessage(
          "Opening your browser notification request..."
        );

        await saveNotificationDevice({
          firebaseIdToken,
        });

        setHasNotificationsEnabled(true);
      }

      if (!goodMorningIsOn) {
        setConnectedMessagesStatusMessage(
          "Saving your good morning text preference..."
        );

        await saveGoodMorningPreference({
          firebaseIdToken,
          enabled: true,
        });

        setHasGoodMorningEnabled(true);
      }

      const refreshedUser = await getUserWithFirestoreFallback();
      setSavedUser(refreshedUser);

      setConnectedMessagesStatusType("success");
      setConnectedMessagesStatusMessage(
        `${characterName} can now send you a soft good morning text and gentle check-ins on this device.`
      );
    } catch (error) {
      console.error("Failed to turn on app connected messages:", error);
      setConnectedMessagesStatusType("error");
      setConnectedMessagesStatusMessage(
        error instanceof Error
          ? error.message
          : "Could not turn this on. Please try again."
      );
    } finally {
      setIsTurningOnConnectedMessages(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7eeee] px-4 py-5 text-[#111111]">
      <div className="mx-auto w-full max-w-3xl">
        <header className="sticky top-0 z-20 -mx-4 -mt-5 border-b border-black/5 bg-white/95 px-4 py-4 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#c1123f]">
                Payment successful
              </p>
              <h1 className="mt-1 text-xl font-bold tracking-[-0.03em] text-black">
                {isNormalImageCreditSuccess ? "Tokens added" : "Upgrade received"}
              </h1>
            </div>

            <Link
              href={`/app/chat/${chatCharacterId}`}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#f7eeee] px-4 py-2 text-sm font-bold text-black"
            >
              Chat
            </Link>
          </div>
        </header>

        <section className="mt-5 rounded-[1.75rem] border border-[#c1123f]/10 bg-white/80 p-5 shadow-[0_16px_45px_rgba(111,0,23,0.05)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#c1123f]">
            Success
          </p>

          <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-black">
            {isNormalImageCreditSuccess
              ? "Your token pack has been added"
              : expectedPlanLabel === "paid"
              ? "Your upgrade is being activated"
              : `You’re upgrading to ${expectedPlanLabel}`}
          </h2>

          <p className="mt-4 text-sm leading-7 text-black/65">
            {isNormalImageCreditSuccess
              ? `Your payment was received. Your account will receive ${extraImageCredits} extra personal selfie credits. Each extra personal selfie uses 1 credit.`
              : "Your payment was received. Stripe will confirm the checkout with the app, then your account will show the correct plan in chat."}
          </p>

          <div className="mt-6 rounded-[1.4rem] border border-[#c1123f]/8 bg-[#fff8f8] p-4">
            {isLoadingUser ? (
              <p className="text-sm leading-6 text-black/62">
                Checking your saved account...
              </p>
            ) : savedUser ? (
              <div className="space-y-2 text-sm leading-6 text-black/62">
                <p>
                  Account:{" "}
                  <span className="font-bold text-black">
                    {savedUser.email || savedUser.name || "Current user"}
                  </span>
                </p>

                <p>
                  Current saved plan:{" "}
                  <span className="font-bold text-black">{savedPlanLabel}</span>
                </p>

                <p>
                  During local testing, make sure the local Stripe webhook is
                  running and the Vercel webhook stays disabled.
                </p>
              </div>
            ) : (
              <p className="text-sm leading-6 text-black/62">
                Payment was successful. Return to chat and refresh after a
                moment if your plan or credits have not appeared yet.
              </p>
            )}
          </div>
        </section>

        {shouldShowConnectedMessagesPrompt ? (
          <section className="mt-5 rounded-[1.75rem] border border-[#c1123f]/10 bg-white p-5 shadow-[0_16px_45px_rgba(111,0,23,0.04)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#c1123f]">
              Stay connected
            </p>

            <h2 className="mt-3 text-2xl font-bold tracking-[-0.03em] text-black">
              {characterName} would like to send you little messages
            </h2>

            <p className="mt-3 text-sm leading-7 text-black/62">
              {characterName} can send you a soft good morning message and
              gentle check-ins when you are away from chat.
            </p>

            <p className="mt-2 text-xs leading-6 text-black/42">
              One button turns on both messages and device notifications. You
              can turn notifications off later in your browser or device
              settings.
            </p>

            <button
              type="button"
              onClick={handleTurnOnConnectedMessages}
              disabled={isTurningOnConnectedMessages || connectedMessagesAreOn}
              className={`mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 py-3 text-sm font-bold transition disabled:cursor-not-allowed ${
                connectedMessagesAreOn
                  ? "bg-black/15 text-black/45"
                  : "bg-[#b10f38] text-white hover:bg-[#970d31] disabled:bg-black/20"
              }`}
            >
              {connectedMessagesAreOn
                ? "Messages on"
                : isTurningOnConnectedMessages
                ? "Turning on..."
                : "Turn on messages"}
            </button>

            {connectedMessagesStatusMessage ? (
              <p
                className={`mt-4 rounded-[1.15rem] px-4 py-3 text-sm leading-6 ${
                  connectedMessagesStatusType === "error"
                    ? "border border-[#c1123f]/12 bg-[#fff4f6] text-[#8f0d2f]"
                    : connectedMessagesStatusType === "success"
                    ? "border border-black/8 bg-[#f7f3ef] text-black/72"
                    : "border border-black/8 bg-white text-black/55"
                }`}
              >
                {connectedMessagesStatusMessage}
              </p>
            ) : null}
          </section>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={`/app/chat/${chatCharacterId}`}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#b10f38] px-5 py-3 text-sm font-bold text-white"
          >
            Back to chat
          </Link>

          {isNormalImageCreditSuccess ? (
            <Link
              href="/app/upgrade"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-5 py-3 text-sm font-bold text-black"
            >
              View upgrade options
            </Link>
          ) : (
            <Link
              href="/app/account"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-5 py-3 text-sm font-bold text-black"
            >
              View account
            </Link>
          )}
        </div>

        <div className="h-8" />
      </div>
    </main>
  );
}