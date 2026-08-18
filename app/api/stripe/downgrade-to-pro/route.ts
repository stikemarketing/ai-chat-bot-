import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { getStripePriceIdPro, getStripeServer } from "@/lib/stripe";

type StripeSubscriptionLike = Stripe.Subscription & {
  cancel_at?: number | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
  items?: {
    data?: Array<
      Stripe.SubscriptionItem & {
        current_period_start?: number | null;
        current_period_end?: number | null;
      }
    >;
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

function getStripeCustomerId(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
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

function getUnixTimestampFromIso(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const date = new Date(trimmedValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Math.floor(date.getTime() / 1000);
}

function getCurrentPeriodStart(subscription: Stripe.Subscription) {
  const safeSubscription = subscription as StripeSubscriptionLike;

  const directCurrentPeriodStart = getSafeUnixTimestamp(
    safeSubscription.current_period_start
  );

  if (directCurrentPeriodStart) {
    return directCurrentPeriodStart;
  }

  const itemCurrentPeriodStart = getSafeUnixTimestamp(
    safeSubscription.items?.data?.[0]?.current_period_start
  );

  if (itemCurrentPeriodStart) {
    return itemCurrentPeriodStart;
  }

  return Math.floor(Date.now() / 1000);
}

function getCurrentPeriodEndFromSubscription(subscription: Stripe.Subscription) {
  const safeSubscription = subscription as StripeSubscriptionLike;

  const directCurrentPeriodEnd = getSafeUnixTimestamp(
    safeSubscription.current_period_end
  );

  if (directCurrentPeriodEnd) {
    return directCurrentPeriodEnd;
  }

  const itemCurrentPeriodEnd = getSafeUnixTimestamp(
    safeSubscription.items?.data?.[0]?.current_period_end
  );

  if (itemCurrentPeriodEnd) {
    return itemCurrentPeriodEnd;
  }

  const cancelAt = getSafeUnixTimestamp(safeSubscription.cancel_at);

  if (cancelAt) {
    return cancelAt;
  }

  return null;
}

function getCurrentPeriodEndFromUserData(
  userData: FirebaseFirestore.DocumentData | undefined
) {
  if (!userData) {
    return null;
  }

  const directPeriodEnd = getSafeUnixTimestamp(
    userData.subscriptionCurrentPeriodEnd
  );

  if (directPeriodEnd) {
    return directPeriodEnd;
  }

  const directPeriodEndIso = getUnixTimestampFromIso(
    userData.subscriptionCurrentPeriodEndIso
  );

  if (directPeriodEndIso) {
    return directPeriodEndIso;
  }

  const cancelAt = getSafeUnixTimestamp(userData.subscriptionCancelAt);

  if (cancelAt) {
    return cancelAt;
  }

  const cancelAtIso = getUnixTimestampFromIso(userData.subscriptionCancelAtIso);

  if (cancelAtIso) {
    return cancelAtIso;
  }

  const stripeCurrentPeriodEnd = getSafeUnixTimestamp(
    userData.stripeCurrentPeriodEnd
  );

  if (stripeCurrentPeriodEnd) {
    return stripeCurrentPeriodEnd;
  }

  return null;
}

function formatStripeUnixTimestamp(timestamp: number | null | undefined) {
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp * 1000).toISOString();
}

function getFirstSubscriptionItem(subscription: Stripe.Subscription) {
  return subscription.items.data[0] || null;
}

function getSubscriptionScheduleId(subscription: Stripe.Subscription) {
  const schedule = subscription.schedule;

  if (typeof schedule === "string") {
    return schedule;
  }

  if (schedule && typeof schedule.id === "string") {
    return schedule.id;
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
    const currentPlan =
      typeof userData?.plan === "string" ? userData.plan.trim() : "";

    if (currentPlan !== "unlimited") {
      return NextResponse.json(
        {
          error:
            "Only Unlimited users can schedule a downgrade to Pro from this page.",
        },
        { status: 400 }
      );
    }

    const stripeSubscriptionId = getStripeSubscriptionId(
      userData?.stripeSubscriptionId
    );

    const stripeCustomerId = getStripeCustomerId(userData?.stripeCustomerId);

    if (!stripeSubscriptionId) {
      return NextResponse.json(
        {
          error: "No active Stripe subscription was found for this account.",
        },
        { status: 400 }
      );
    }

    const stripe = getStripeServer();

    const subscription = await stripe.subscriptions.retrieve(
      stripeSubscriptionId,
      {
        expand: ["items.data.price"],
      }
    );

    if (
      subscription.status !== "active" &&
      subscription.status !== "trialing"
    ) {
      return NextResponse.json(
        {
          error:
            "Only an active subscription can be scheduled to downgrade to Pro.",
        },
        { status: 400 }
      );
    }

    if (subscription.cancel_at_period_end === true) {
      return NextResponse.json(
        {
          error:
            "This subscription is already scheduled to cancel, so it cannot also be downgraded to Pro.",
        },
        { status: 400 }
      );
    }

    const currentPeriodStart = getCurrentPeriodStart(subscription);
    const currentPeriodEnd =
      getCurrentPeriodEndFromSubscription(subscription) ||
      getCurrentPeriodEndFromUserData(userData);

    const currentItem = getFirstSubscriptionItem(subscription);
    const proPriceId = getStripePriceIdPro();

    if (!currentPeriodEnd) {
      return NextResponse.json(
        {
          error:
            "Could not find the end of the current billing period for this subscription.",
        },
        { status: 400 }
      );
    }

    if (!currentItem?.price?.id) {
      return NextResponse.json(
        {
          error: "Could not find the current subscription price item in Stripe.",
        },
        { status: 400 }
      );
    }

    let scheduleId = getSubscriptionScheduleId(subscription);

    if (!scheduleId) {
      const createdSchedule = await stripe.subscriptionSchedules.create({
        from_subscription: subscription.id,
      });

      scheduleId = createdSchedule.id;
    }

    const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);

    const currentPhase =
      schedule.phases && schedule.phases.length > 0
        ? schedule.phases[0]
        : null;

    const currentPhaseStart =
      typeof currentPhase?.start_date === "number"
        ? currentPhase.start_date
        : currentPeriodStart;

    await stripe.subscriptionSchedules.update(scheduleId, {
      end_behavior: "release",
      phases: [
        {
          start_date: currentPhaseStart,
          end_date: currentPeriodEnd,
          items: [
            {
              price: currentItem.price.id,
              quantity: currentItem.quantity || 1,
            },
          ],
        },
        {
          start_date: currentPeriodEnd,
          items: [
            {
              price: proPriceId,
              quantity: 1,
            },
          ],
          metadata: {
            userId: verifiedUserId,
            plan: "pro",
          },
        },
      ],
      metadata: {
        userId: verifiedUserId,
        scheduledChange: "downgrade_to_pro",
      },
    });

    const currentPeriodEndIso = formatStripeUnixTimestamp(currentPeriodEnd);

    await userRef.set(
      {
        subscriptionDowngradeToProAtPeriodEnd: true,
        subscriptionDowngradeRequestedAt: FieldValue.serverTimestamp(),
        subscriptionDowngradeEffectiveAt: currentPeriodEnd,
        subscriptionDowngradeEffectiveAtIso: currentPeriodEndIso,
        subscriptionCurrentPeriodEnd: currentPeriodEnd,
        subscriptionCurrentPeriodEndIso: currentPeriodEndIso,
        subscriptionScheduleId: scheduleId,
        stripeCustomerId:
          stripeCustomerId || getStripeCustomerId(subscription.customer),
        stripeSubscriptionId: subscription.id,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      downgradeToProAtPeriodEnd: true,
      currentPeriodEnd,
      currentPeriodEndIso,
    });
  } catch (error) {
    console.error("Failed to schedule downgrade to Pro:", error);

    const message =
      error instanceof Error ? error.message : "Could not schedule downgrade to Pro.";

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