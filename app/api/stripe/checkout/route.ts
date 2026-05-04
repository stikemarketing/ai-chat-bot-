import { NextRequest, NextResponse } from "next/server";
import { getAppUrl, getStripePriceIdPro, getStripeServer } from "@/lib/stripe";

type CheckoutRequestBody = {
  userId: string;
  email?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CheckoutRequestBody;

    const userId = body.userId?.trim();
    const email = body.email?.trim();

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const stripe = getStripeServer();
    const appUrl = getAppUrl();
    const priceId = getStripePriceIdPro();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      customer_email: email || undefined,
      client_reference_id: userId,
      metadata: {
        userId,
        plan: "pro",
      },
      subscription_data: {
        metadata: {
          userId,
          plan: "pro",
        },
      },
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout/cancel`,
    });

    if (!session.url) {
      throw new Error("Stripe checkout session URL was empty.");
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("API /api/stripe/checkout error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown Stripe checkout error.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}