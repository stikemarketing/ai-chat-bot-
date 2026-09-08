import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, getAdminStorageBucket } from "@/lib/firebaseAdmin";
import { getStripeServer } from "@/lib/stripe";

export const runtime = "nodejs";

const MAX_AUTH_AGE_SECONDS = 10 * 60;

function getBearerToken(request: NextRequest) {
  const [scheme, token] = (request.headers.get("authorization") || "").split(" ");
  return scheme === "Bearer" ? token?.trim() || "" : "";
}

function getSafeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function cancelCurrentStripeSubscription(subscriptionId: string) {
  if (!subscriptionId) return;

  const stripe = getStripeServer();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  if (subscription.status !== "canceled") {
    await stripe.subscriptions.cancel(subscriptionId, {
      invoice_now: false,
      prorate: false,
    });
  }
}

async function deleteUserStorage(userId: string) {
  try {
    const bucket = getAdminStorageBucket();
    await Promise.all([
      bucket.deleteFiles({ prefix: `users/${userId}/` }),
      bucket.deleteFiles({ prefix: `generated-images/${userId}/` }),
    ]);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Missing Firebase Storage bucket")
    ) {
      return;
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json({ error: "Please Sign In Again Before Deleting Your Account." }, { status: 401 });
    }

    const decodedToken = await getAdminAuth().verifyIdToken(token, true);
    const authAge = Math.floor(Date.now() / 1000) - decodedToken.auth_time;

    if (!decodedToken.auth_time || authAge > MAX_AUTH_AGE_SECONDS) {
      return NextResponse.json(
        {
          error:
            "For Security, Please Sign Out And Sign In Again Before Permanently Deleting Your Account.",
          reauthenticationRequired: true,
        },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      confirmation?: string;
      acceptImmediateLoss?: boolean;
    };

    if (
      body.confirmation !== "DELETE" ||
      body.acceptImmediateLoss !== true
    ) {
      return NextResponse.json(
        { error: "The Permanent Deletion Confirmation Was Not Completed." },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const userRef = db.collection("users").doc(decodedToken.uid);
    const userSnapshot = await userRef.get();
    const userData = userSnapshot.data();
    const subscriptionId = getSafeString(userData?.stripeSubscriptionId);

    // Payment cancellation must succeed before any account data is removed.
    await cancelCurrentStripeSubscription(subscriptionId);

    await deleteUserStorage(decodedToken.uid);
    await db.recursiveDelete(db.collection("conversations").doc(decodedToken.uid));
    await db.recursiveDelete(userRef);
    await getAdminAuth().deleteUser(decodedToken.uid);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Permanent account deletion failed:", error);

    const isStripeError = error instanceof Stripe.errors.StripeError;
    const message = isStripeError
      ? "Your Payment Subscription Could Not Be Cancelled, So Your Account Was Not Deleted. Please Contact Support."
      : error instanceof Error &&
        (error.message.includes("Firebase ID token") ||
          error.message.includes("auth/id-token"))
      ? "Please Sign Out And Sign In Again Before Deleting Your Account."
      : "Your Account Could Not Be Fully Deleted. No Further Attempt Was Made. Please Contact Support.";

    return NextResponse.json(
      { error: message },
      { status: isStripeError ? 502 : 500 }
    );
  }
}
