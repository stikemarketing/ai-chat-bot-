import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  getStripePriceIdPro,
  getStripePriceIdUnlimited,
  getStripeServer,
  getStripeWebhookSecret,
} from "@/lib/stripe";
import { normalizePlan, type AppPlan } from "@/lib/plans";
import {
  activatePaidPlan,
  addNormalImageCredits,
  downgradeToFreePlan,
  saveStripeWebhookLog,
  syncStripeSubscriptionPlan,
} from "@/firebase/billingAdmin";

type CheckoutType = "subscription" | "normal_image_credit";

type StripeSubscriptionWithBillingDates = Stripe.Subscription & {
  current_period_start?: number;
  current_period_end?: number;
};

function getSafePaidPlan(plan: string | null | undefined): AppPlan | null {
  const normalisedPlan = normalizePlan(plan);

  if (normalisedPlan === "pro" || normalisedPlan === "unlimited") {
    return normalisedPlan;
  }

  return null;
}

function getSafeCheckoutType(
  checkoutType: string | null | undefined
): CheckoutType {
  if (checkoutType === "normal_image_credit") {
    return "normal_image_credit";
  }

  return "subscription";
}

function getSafeCreditQuantity(value: string | null | undefined) {
  const parsedQuantity = Number(value || "1");

  if (!Number.isFinite(parsedQuantity)) {
    return 1;
  }

  const wholeNumberQuantity = Math.floor(parsedQuantity);

  if (wholeNumberQuantity < 1) {
    return 1;
  }

  if (wholeNumberQuantity > 100) {
    return 100;
  }

  return wholeNumberQuantity;
}

function getStripeId(
  value:
    | string
    | Stripe.Customer
    | Stripe.DeletedCustomer
    | Stripe.Subscription
    | null
    | undefined
) {
  if (typeof value === "string") {
    return value;
  }

  return null;
}

function getSubscriptionPriceIds(subscription: Stripe.Subscription) {
  return subscription.items.data
    .map((item) => item.price?.id)
    .filter((priceId): priceId is string => Boolean(priceId));
}

function getPlanFromSubscriptionPrice(subscription: Stripe.Subscription) {
  const proPriceId = getStripePriceIdPro();
  const unlimitedPriceId = getStripePriceIdUnlimited();
  const subscriptionPriceIds = getSubscriptionPriceIds(subscription);

  const matchingPriceId = subscriptionPriceIds.find((priceId) => {
    return priceId === proPriceId || priceId === unlimitedPriceId;
  });

  if (matchingPriceId === unlimitedPriceId) {
    return "unlimited" satisfies AppPlan;
  }

  if (matchingPriceId === proPriceId) {
    return "pro" satisfies AppPlan;
  }

  return null;
}

function getPlanFromSubscription(subscription: Stripe.Subscription) {
  const pricePlan = getPlanFromSubscriptionPrice(subscription);

  if (pricePlan) {
    return pricePlan;
  }

  return getSafePaidPlan(subscription.metadata?.plan);
}

function getSubscriptionCurrentPeriodStart(subscription: Stripe.Subscription) {
  const safeSubscription = subscription as StripeSubscriptionWithBillingDates;

  if (typeof safeSubscription.current_period_start === "number") {
    return safeSubscription.current_period_start;
  }

  return null;
}

function getSubscriptionCurrentPeriodEnd(subscription: Stripe.Subscription) {
  const safeSubscription = subscription as StripeSubscriptionWithBillingDates;

  if (typeof safeSubscription.current_period_end === "number") {
    return safeSubscription.current_period_end;
  }

  return null;
}

function formatStripeUnixTimestamp(timestamp: number | null | undefined) {
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp * 1000).toISOString();
}

async function handleCompletedCheckoutSession(
  session: Stripe.Checkout.Session
) {
  const userId =
    session.metadata?.userId?.trim() ||
    session.client_reference_id?.trim() ||
    "";

  if (!userId) {
    throw new Error("checkout.session.completed missing userId.");
  }

  const checkoutType = getSafeCheckoutType(session.metadata?.checkoutType);

  if (checkoutType === "normal_image_credit") {
    if (session.payment_status !== "paid") {
      throw new Error(
        "Normal image credit checkout completed without paid payment status."
      );
    }

    const creditQuantity = getSafeCreditQuantity(
      session.metadata?.creditQuantity
    );

    await addNormalImageCredits({
      userId,
      creditQuantity,
      stripeCustomerId: getStripeId(session.customer),
      stripeCheckoutSessionId: session.id,
    });

    return;
  }

  const plan = getSafePaidPlan(session.metadata?.plan);

  if (!plan) {
    throw new Error("checkout.session.completed missing valid paid plan.");
  }

  await activatePaidPlan({
    userId,
    plan,
    stripeCustomerId: getStripeId(session.customer),
    stripeSubscriptionId: getStripeId(session.subscription),
    stripeCheckoutSessionId: session.id,
  });
}

export async function POST(request: Request) {
  try {
    const stripe = getStripeServer();
    const webhookSecret = getStripeWebhookSecret();

    const body = await request.text();
    const signature = (await headers()).get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing Stripe signature header." },
        { status: 400 }
      );
    }

    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    await saveStripeWebhookLog({
      eventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
    });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        await handleCompletedCheckoutSession(session);

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId?.trim() || "";
        const plan = getPlanFromSubscription(subscription);

        if (!userId) {
          break;
        }

        if (
          subscription.status === "active" ||
          subscription.status === "trialing"
        ) {
          if (!plan) {
            break;
          }

          const currentPeriodStart =
            getSubscriptionCurrentPeriodStart(subscription);
          const currentPeriodEnd =
            getSubscriptionCurrentPeriodEnd(subscription);

          await syncStripeSubscriptionPlan({
            userId,
            plan,
            stripeCustomerId: getStripeId(subscription.customer),
            stripeSubscriptionId: subscription.id,
            stripeSubscriptionStatus: subscription.status,
            stripeCancelAtPeriodEnd: subscription.cancel_at_period_end === true,
            stripeCurrentPeriodStart: currentPeriodStart,
            stripeCurrentPeriodEnd: currentPeriodEnd,
            stripeCurrentPeriodStartIso:
              formatStripeUnixTimestamp(currentPeriodStart),
            stripeCurrentPeriodEndIso:
              formatStripeUnixTimestamp(currentPeriodEnd),
          });
        } else if (
          subscription.status === "canceled" ||
          subscription.status === "unpaid" ||
          subscription.status === "incomplete_expired"
        ) {
          await downgradeToFreePlan({
            userId,
            stripeCustomerId: getStripeId(subscription.customer),
            stripeSubscriptionId: subscription.id,
          });
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId?.trim() || "";

        if (!userId) {
          break;
        }

        await downgradeToFreePlan({
          userId,
          stripeCustomerId: getStripeId(subscription.customer),
          stripeSubscriptionId: subscription.id,
        });

        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("API /api/stripe/webhook error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown Stripe webhook error.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}