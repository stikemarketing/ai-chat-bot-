import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";

type ActivateProPlanParams = {
  userId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCheckoutSessionId?: string | null;
};

type DowngradePlanParams = {
  userId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
};

export async function activateProPlan(params: ActivateProPlanParams) {
  const db = getAdminDb();

  await db.collection("users").doc(params.userId).set(
    {
      plan: "pro",
      stripeCustomerId: params.stripeCustomerId ?? null,
      stripeSubscriptionId: params.stripeSubscriptionId ?? null,
      lastStripeCheckoutSessionId: params.stripeCheckoutSessionId ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function downgradeToFreePlan(params: DowngradePlanParams) {
  const db = getAdminDb();

  await db.collection("users").doc(params.userId).set(
    {
      plan: "free",
      stripeCustomerId: params.stripeCustomerId ?? null,
      stripeSubscriptionId: params.stripeSubscriptionId ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function saveStripeWebhookLog(data: Record<string, unknown>) {
  const db = getAdminDb();

  await db.collection("stripeWebhookLogs").add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
  });
}