import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getStripeServer, getStripeWebhookSecret } from "@/lib/stripe";
import {
  activateProPlan,
  downgradeToFreePlan,
  saveStripeWebhookLog,
} from "@/firebase/billingAdmin";

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

        const userId =
          session.metadata?.userId?.trim() ||
          session.client_reference_id?.trim() ||
          "";

        if (!userId) {
          throw new Error("checkout.session.completed missing userId.");
        }

        await activateProPlan({
          userId,
          stripeCustomerId:
            typeof session.customer === "string" ? session.customer : null,
          stripeSubscriptionId:
            typeof session.subscription === "string" ? session.subscription : null,
          stripeCheckoutSessionId: session.id,
        });

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId?.trim();

        if (!userId) {
          break;
        }

        if (subscription.status === "active" || subscription.status === "trialing") {
          await activateProPlan({
            userId,
            stripeCustomerId:
              typeof subscription.customer === "string"
                ? subscription.customer
                : null,
            stripeSubscriptionId: subscription.id,
          });
        } else if (
          subscription.status === "canceled" ||
          subscription.status === "unpaid" ||
          subscription.status === "incomplete_expired"
        ) {
          await downgradeToFreePlan({
            userId,
            stripeCustomerId:
              typeof subscription.customer === "string"
                ? subscription.customer
                : null,
            stripeSubscriptionId: subscription.id,
          });
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId?.trim();

        if (!userId) {
          break;
        }

        await downgradeToFreePlan({
          userId,
          stripeCustomerId:
            typeof subscription.customer === "string"
              ? subscription.customer
              : null,
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