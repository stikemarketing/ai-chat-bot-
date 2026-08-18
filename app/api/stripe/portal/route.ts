import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { getAppUrl, getStripeServer } from "@/lib/stripe";

type PortalRequestBody = {
  userId?: string;
  returnPath?: string;
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

function getSafeReturnPath(returnPath: string | null | undefined) {
  if (!returnPath) {
    return "/upgrade";
  }

  if (!returnPath.startsWith("/")) {
    return "/upgrade";
  }

  if (returnPath.startsWith("//")) {
    return "/upgrade";
  }

  return returnPath;
}

function getRequestAppUrl(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim();

  if (origin) {
    return origin.replace(/\/$/, "");
  }

  return getAppUrl();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PortalRequestBody;
    const verifiedUserId = await getVerifiedUserId(request);

    const db = getAdminDb();
    const userSnapshot = await db.collection("users").doc(verifiedUserId).get();

    if (!userSnapshot.exists) {
      return NextResponse.json(
        { error: "Authenticated user account was not found." },
        { status: 404 }
      );
    }

    const userData = userSnapshot.data();
    const stripeCustomerId =
      typeof userData?.stripeCustomerId === "string"
        ? userData.stripeCustomerId.trim()
        : "";

    if (!stripeCustomerId) {
      return NextResponse.json(
        {
          error:
            "No Stripe customer was found for this account. Please contact support if you have an active plan.",
        },
        { status: 400 }
      );
    }

    const stripe = getStripeServer();
    const appUrl = getRequestAppUrl(request);
    const returnPath = getSafeReturnPath(body.returnPath);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appUrl}${returnPath}`,
    });

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error) {
    console.error("Failed to create Stripe portal session:", error);

    const message =
      error instanceof Error ? error.message : "Could not open billing portal.";

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