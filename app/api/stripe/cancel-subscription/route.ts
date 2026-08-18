import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { getStripeServer } from "@/lib/stripe";

type CancelSubscriptionRequestBody = {
  userId?: string;
};

type StripeSubscriptionLike = {
  cancel_at?: number | null;
  cancel_at_period_end?: boolean;
  current_period_end?: number | null;
  schedule?: string | Stripe.SubscriptionSchedule | null;
  items?: {
    data?: Array<{
      current_period_end?: number | null;
    }>;
  };
};

function getBearerToken(request: NextRequest) {
  const authorizationHeader = request.headers.get("authorization") || "";
  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token?.trim()) {
    return "";
  }

  return token.trim();
}

async function getVerifiedUserId(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    throw new Error("Missing Firebase authentication token.");
  }

  const decodedToken = await getAdminAuth().verifyIdToken(token);

  if (!decodedToken.uid) {
    throw new Error("Firebase authentication token did not include a user ID.");
  }

  return decodedToken.uid;
}

function getStripeSubscriptionId(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getStripeScheduleId(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string"
  ) {
    return value.id.trim();
  }

  return "";
}

function getSubscriptionCancelAtPeriodEnd(subscription: unknown) {
  const safeSubscription = subscription as StripeSubscriptionLike;

  return safeSubscription.cancel_at_period_end === true;
}

function getSafeUnixTimestamp(value: unknown) {
  if (typeof value !== "number") {
    return null;
  }

  if (!Number.isFinite(value)) {
    return null;
  }

  if (value <= 0) {
    return null;
  }

  return Math.floor(value);
}

function getSubscriptionCurrentPeriodEnd(subscription: unknown) {
  const safeSubscription = subscription as StripeSubscriptionLike;

  const directCurrentPeriodEnd = getSafeUnixTimestamp(
    safeSubscription.current_period_end
  );

  if (directCurrentPeriodEnd) {
    return directCurrentPeriodEnd;
  }

  const cancelAt = getSafeUnixTimestamp(safeSubscription.cancel_at);

  if (cancelAt) {
    return cancelAt;
  }

  const itemCurrentPeriodEnd = getSafeUnixTimestamp(
    safeSubscription.items?.data?.[0]?.current_period_end
  );

  if (itemCurrentPeriodEnd) {
    return itemCurrentPeriodEnd;
  }

  return null;
}

function formatStripeUnixTimestamp(timestamp: number | null | undefined) {
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp * 1000).toISOString();
}

async function releaseSubscriptionScheduleIfNeeded(params: {
  stripe: ReturnType<typeof getStripeServer>;
  subscription: Stripe.Subscription;
}) {
  const scheduleId = getStripeScheduleId(
    (params.subscription as StripeSubscriptionLike).schedule
  );

  if (!scheduleId) {
    return null;
  }

  const schedule = await params.stripe.subscriptionSchedules.retrieve(
    scheduleId
  );

  if (schedule.status === "active" || schedule.status === "not_started") {
    await params.stripe.subscriptionSchedules.release(scheduleId);
    return scheduleId;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const verifiedUserId = await getVerifiedUserId(request);

    const db = getAdminDb();
    const userRef = db.collection("users").doc(verifiedUserId);
    const userSnapshot = await userRef.get();

    if (!userSnapshot.exists) {
      return NextResponse.json(
        { error: "Authenticated user account was not found." },
        { status: 404 }
      );
    }

    const userData = userSnapshot.data();
    const stripeSubscriptionId = getStripeSubscriptionId(
      userData?.stripeSubscriptionId
    );

    if (!stripeSubscriptionId) {
      return NextResponse.json(
        {
          error: "No active Stripe subscription was found for this account.",
        },
        { status: 400 }
      );
    }

    const stripe = getStripeServer();

    let subscription = await stripe.subscriptions.retrieve(
      stripeSubscriptionId,
      {
        expand: ["schedule"],
      }
    );

    const releasedScheduleId = await releaseSubscriptionScheduleIfNeeded({
      stripe,
      subscription,
    });

    if (releasedScheduleId) {
      subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    }

    await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

    const currentPeriodEnd = getSubscriptionCurrentPeriodEnd(subscription);
    const currentPeriodEndIso = formatStripeUnixTimestamp(currentPeriodEnd);
    const cancelAtPeriodEnd =
      getSubscriptionCancelAtPeriodEnd(subscription);

    await userRef.set(
      {
        subscriptionCancelAtPeriodEnd: cancelAtPeriodEnd,
        subscriptionCancelRequestedAt: FieldValue.serverTimestamp(),
        subscriptionCurrentPeriodEnd: currentPeriodEnd,
        subscriptionCurrentPeriodEndIso: currentPeriodEndIso,
        subscriptionCancelAt: currentPeriodEnd,
        subscriptionCancelAtIso: currentPeriodEndIso,
        subscriptionDowngradeToProAtPeriodEnd: false,
        subscriptionDowngradeEffectiveAt: null,
        subscriptionDowngradeEffectiveAtIso: null,
        releasedStripeSubscriptionScheduleId: releasedScheduleId,
        stripeCancelAtPeriodEnd: cancelAtPeriodEnd,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      cancelAtPeriodEnd,
      currentPeriodEnd,
      currentPeriodEndIso,
      releasedScheduleId,
    });
  } catch (error) {
    console.error("Failed to schedule subscription cancellation:", error);

    const message =
      error instanceof Error ? error.message : "Could not cancel subscription.";

    const status =
      message.includes("authentication token") ||
      message.includes("Firebase ID token")
        ? 401
        : 500;

    return NextResponse.json(
      {
        error: message,
      },
      { status }
    );
  }
}