import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { activatePaidPlan } from "@/firebase/billingAdmin";
import {
  getAppUrl,
  getStripePriceIdForPlan,
  getStripePriceIdNormalImageCredit,
  getStripePriceIdUnlimited,
  getStripeServer,
} from "@/lib/stripe";
import { normalizePlan, type AppPlan } from "@/lib/plans";

type CheckoutType = "subscription" | "normal_image_credit";
type CheckoutSource = "website" | "app";

type CheckoutRequestBody = {
  characterId?: string;
  planId?: string;
  checkoutType?: CheckoutType;
  source?: CheckoutSource;
};

type VerifiedCheckoutUser = {
  userId: string;
  email: string;
  firestorePlan: AppPlan;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

const allowedCharacterIds = ["luna", "ivy", "sienna"];
const NORMAL_IMAGE_TOKEN_PACK_CREDITS = 3;

function getRequestAppUrl(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin) {
    return origin;
  }

  return getAppUrl();
}

function getSafeCharacterId(characterId?: string) {
  const cleanCharacterId = characterId?.trim().toLowerCase();

  if (cleanCharacterId && allowedCharacterIds.includes(cleanCharacterId)) {
    return cleanCharacterId;
  }

  return "luna";
}

function getSafeCheckoutType(checkoutType?: string): CheckoutType {
  if (checkoutType === "normal_image_credit") {
    return "normal_image_credit";
  }

  return "subscription";
}

function getSafeCheckoutSource(source?: string): CheckoutSource {
  if (source === "app") {
    return "app";
  }

  return "website";
}

function getCheckoutPlan(planId?: string): AppPlan {
  const plan = normalizePlan(planId || "pro");

  if (plan !== "pro" && plan !== "unlimited") {
    throw new Error("Checkout is only available for Pro or Unlimited.");
  }

  return plan;
}

function getBearerToken(request: NextRequest) {
  const authorizationHeader = request.headers.get("authorization") || "";
  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token?.trim()) {
    return "";
  }

  return token.trim();
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

function getSuccessUrl(params: {
  appUrl: string;
  source: CheckoutSource;
  query: string;
}) {
  if (params.source === "app") {
    return `${params.appUrl}/app/checkout/success?${params.query}`;
  }

  return `${params.appUrl}/checkout/success?${params.query}`;
}

function getCancelUrl(params: {
  appUrl: string;
  source: CheckoutSource;
  characterId: string;
}) {
  if (params.source === "app") {
    return `${params.appUrl}/app/upgrade?cancelled=true&character=${params.characterId}`;
  }

  return `${params.appUrl}/checkout/cancel?character=${params.characterId}`;
}

function isActiveStripeSubscription(subscription: Stripe.Subscription) {
  return subscription.status === "active" || subscription.status === "trialing";
}

function getFirstSubscriptionItem(subscription: Stripe.Subscription) {
  return subscription.items.data[0] || null;
}

async function getVerifiedCheckoutUser(
  request: NextRequest
): Promise<VerifiedCheckoutUser> {
  const token = getBearerToken(request);

  if (!token) {
    throw new Error("Missing Firebase authentication token.");
  }

  const decodedToken = await getAdminAuth().verifyIdToken(token);
  const userId = decodedToken.uid;
  const authEmail =
    typeof decodedToken.email === "string" ? decodedToken.email : "";

  const db = getAdminDb();
  const userSnapshot = await db.collection("users").doc(userId).get();
  const userData = userSnapshot.exists ? userSnapshot.data() : null;

  return {
    userId,
    email:
      typeof userData?.email === "string" && userData.email.trim()
        ? userData.email.trim()
        : authEmail,
    firestorePlan: normalizePlan(String(userData?.plan || "free")),
    stripeCustomerId: getSafeString(userData?.stripeCustomerId),
    stripeSubscriptionId: getSafeString(userData?.stripeSubscriptionId),
  };
}

async function createSubscriptionCheckoutSession(params: {
  userId: string;
  email?: string;
  characterId: string;
  appUrl: string;
  plan: AppPlan;
  source: CheckoutSource;
  stripeCustomerId?: string | null;
}) {
  const stripe = getStripeServer();
  const priceId = getStripePriceIdForPlan(params.plan);

  const successQuery = `plan=${params.plan}&character=${params.characterId}&source=${params.source}&session_id={CHECKOUT_SESSION_ID}`;

  return stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    allow_promotion_codes: true,
    customer: params.stripeCustomerId || undefined,
    customer_email: params.stripeCustomerId
      ? undefined
      : params.email || undefined,
    client_reference_id: params.userId,
    metadata: {
      userId: params.userId,
      checkoutType: "subscription",
      plan: params.plan,
      characterId: params.characterId,
      source: params.source,
    },
    subscription_data: {
      metadata: {
        userId: params.userId,
        checkoutType: "subscription",
        plan: params.plan,
        characterId: params.characterId,
        source: params.source,
      },
    },
    success_url: getSuccessUrl({
      appUrl: params.appUrl,
      source: params.source,
      query: successQuery,
    }),
    cancel_url: getCancelUrl({
      appUrl: params.appUrl,
      source: params.source,
      characterId: params.characterId,
    }),
  });
}

async function createNormalImageCreditCheckoutSession(params: {
  userId: string;
  email?: string;
  characterId: string;
  appUrl: string;
  source: CheckoutSource;
  stripeCustomerId?: string | null;
}) {
  const stripe = getStripeServer();
  const priceId = getStripePriceIdNormalImageCredit();

  const successQuery = `credit=normal_image&credits=${NORMAL_IMAGE_TOKEN_PACK_CREDITS}&character=${params.characterId}&source=${params.source}&session_id={CHECKOUT_SESSION_ID}`;

  return stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    allow_promotion_codes: true,
    customer: params.stripeCustomerId || undefined,
    customer_email: params.stripeCustomerId
      ? undefined
      : params.email || undefined,
    client_reference_id: params.userId,
    metadata: {
      userId: params.userId,
      checkoutType: "normal_image_credit",
      creditType: "normal_image",
      creditQuantity: String(NORMAL_IMAGE_TOKEN_PACK_CREDITS),
      characterId: params.characterId,
      source: params.source,
    },
    success_url: getSuccessUrl({
      appUrl: params.appUrl,
      source: params.source,
      query: successQuery,
    }),
    cancel_url: getCancelUrl({
      appUrl: params.appUrl,
      source: params.source,
      characterId: params.characterId,
    }),
  });
}

async function upgradeExistingProSubscriptionToUnlimited(params: {
  userId: string;
  characterId: string;
  appUrl: string;
  source: CheckoutSource;
  stripeCustomerId?: string | null;
  stripeSubscriptionId: string;
}) {
  const stripe = getStripeServer();
  const unlimitedPriceId = getStripePriceIdUnlimited();

  const subscription = await stripe.subscriptions.retrieve(
    params.stripeSubscriptionId,
    {
      expand: ["items.data.price"],
    }
  );

  if (!isActiveStripeSubscription(subscription)) {
    throw new Error(
      "Your existing Pro subscription is not active, so please start a new Unlimited checkout instead."
    );
  }

  const currentItem = getFirstSubscriptionItem(subscription);

  if (!currentItem?.id) {
    throw new Error("Could not find the current Stripe subscription item.");
  }

  const updatedSubscription = await stripe.subscriptions.update(
    subscription.id,
    {
      cancel_at_period_end: false,
      proration_behavior: "always_invoice",
      payment_behavior: "error_if_incomplete",
      items: [
        {
          id: currentItem.id,
          price: unlimitedPriceId,
          quantity: currentItem.quantity || 1,
        },
      ],
      metadata: {
        ...subscription.metadata,
        userId: params.userId,
        checkoutType: "subscription",
        plan: "unlimited",
        characterId: params.characterId,
        source: params.source,
        upgradedFrom: "pro",
      },
    }
  );

  await activatePaidPlan({
    userId: params.userId,
    plan: "unlimited",
    stripeCustomerId:
      getStripeId(updatedSubscription.customer) ||
      params.stripeCustomerId ||
      null,
    stripeSubscriptionId: updatedSubscription.id,
    stripeCheckoutSessionId: null,
  });

  const successQuery = `plan=unlimited&character=${params.characterId}&source=${params.source}&upgraded=pro_to_unlimited&subscription_id=${updatedSubscription.id}`;

  return {
    url: getSuccessUrl({
      appUrl: params.appUrl,
      source: params.source,
      query: successQuery,
    }),
    subscriptionId: updatedSubscription.id,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CheckoutRequestBody;
    const verifiedUser = await getVerifiedCheckoutUser(request);

    const characterId = getSafeCharacterId(body.characterId);
    const checkoutType = getSafeCheckoutType(body.checkoutType);
    const source = getSafeCheckoutSource(body.source);
    const appUrl = getRequestAppUrl(request);

    if (checkoutType === "normal_image_credit") {
      if (verifiedUser.firestorePlan !== "pro") {
        return NextResponse.json(
          {
            error:
              "Extra personal selfie token packs are only available for Pro users.",
          },
          { status: 403 }
        );
      }

      const session = await createNormalImageCreditCheckoutSession({
        userId: verifiedUser.userId,
        email: verifiedUser.email,
        characterId,
        appUrl,
        source,
        stripeCustomerId: verifiedUser.stripeCustomerId,
      });

      if (!session.url) {
        throw new Error("Stripe checkout session URL was empty.");
      }

      return NextResponse.json({
        url: session.url,
        checkoutType,
        creditType: "normal_image",
        creditQuantity: NORMAL_IMAGE_TOKEN_PACK_CREDITS,
        source,
      });
    }

    const plan = getCheckoutPlan(body.planId);

    if (
      verifiedUser.firestorePlan === "pro" &&
      plan === "unlimited" &&
      verifiedUser.stripeSubscriptionId
    ) {
      const upgradedSubscription =
        await upgradeExistingProSubscriptionToUnlimited({
          userId: verifiedUser.userId,
          characterId,
          appUrl,
          source,
          stripeCustomerId: verifiedUser.stripeCustomerId,
          stripeSubscriptionId: verifiedUser.stripeSubscriptionId,
        });

      return NextResponse.json({
        url: upgradedSubscription.url,
        checkoutType,
        plan,
        source,
        upgradedExistingSubscription: true,
        stripeSubscriptionId: upgradedSubscription.subscriptionId,
      });
    }

    const session = await createSubscriptionCheckoutSession({
      userId: verifiedUser.userId,
      email: verifiedUser.email,
      characterId,
      appUrl,
      plan,
      source,
      stripeCustomerId: verifiedUser.stripeCustomerId,
    });

    if (!session.url) {
      throw new Error("Stripe checkout session URL was empty.");
    }

    return NextResponse.json({
      url: session.url,
      checkoutType,
      plan,
      source,
      upgradedExistingSubscription: false,
    });
  } catch (error) {
    console.error("API /api/stripe/checkout error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown Stripe checkout error.";

    const status =
      message.includes("authentication token") ||
      message.includes("Firebase ID token")
        ? 401
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}