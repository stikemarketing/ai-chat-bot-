// lib/stripe.ts
import Stripe from "stripe";
import type { AppPlan } from "@/lib/plans";

let stripeClient: Stripe | null = null;

export function getStripeServer() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Missing STRIPE_SECRET_KEY in environment.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
}

export function getAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!appUrl) {
    throw new Error("Missing NEXT_PUBLIC_APP_URL in environment.");
  }

  return appUrl.replace(/\/$/, "");
}

export function getStripePriceIdPro() {
  const priceId = process.env.STRIPE_PRICE_ID_PRO?.trim();

  if (!priceId) {
    throw new Error("Missing STRIPE_PRICE_ID_PRO in environment.");
  }

  return priceId;
}

export function getStripePriceIdUnlimited() {
  const priceId = process.env.STRIPE_PRICE_ID_UNLIMITED?.trim();

  if (!priceId) {
    throw new Error("Missing STRIPE_PRICE_ID_UNLIMITED in environment.");
  }

  return priceId;
}

export function getStripePriceIdNormalImageCredit() {
  const priceId = process.env.STRIPE_PRICE_ID_NORMAL_IMAGE_CREDIT?.trim();

  if (!priceId) {
    throw new Error(
      "Missing STRIPE_PRICE_ID_NORMAL_IMAGE_CREDIT in environment."
    );
  }

  return priceId;
}

export function getStripePriceIdForPlan(plan: AppPlan) {
  if (plan === "pro") {
    return getStripePriceIdPro();
  }

  if (plan === "unlimited") {
    return getStripePriceIdUnlimited();
  }

  throw new Error(`Stripe checkout is not available for plan: ${plan}`);
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!secret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET in environment.");
  }

  return secret;
}