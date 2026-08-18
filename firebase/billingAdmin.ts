import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { normalizePlan, type AppPlan } from "@/lib/plans";

type ActivatePaidPlanParams = {
  userId: string;
  plan: AppPlan;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCheckoutSessionId?: string | null;
};

type ActivateProPlanParams = {
  userId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCheckoutSessionId?: string | null;
};

type SyncStripeSubscriptionPlanParams = {
  userId: string;
  plan: AppPlan;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeSubscriptionStatus?: string | null;
  stripeCancelAtPeriodEnd?: boolean;
  stripeCurrentPeriodStart?: number | null;
  stripeCurrentPeriodEnd?: number | null;
  stripeCurrentPeriodStartIso?: string | null;
  stripeCurrentPeriodEndIso?: string | null;
};

type DowngradePlanParams = {
  userId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
};

type AddNormalImageCreditsParams = {
  userId: string;
  creditQuantity: number;
  stripeCustomerId?: string | null;
  stripeCheckoutSessionId?: string | null;
};

function getPlanRank(plan: AppPlan) {
  if (plan === "unlimited") {
    return 3;
  }

  if (plan === "pro") {
    return 2;
  }

  return 1;
}

function getSafePaidPlan(plan: string | null | undefined): AppPlan {
  const normalisedPlan = normalizePlan(plan);

  if (normalisedPlan === "unlimited") {
    return "unlimited";
  }

  if (normalisedPlan === "pro") {
    return "pro";
  }

  return "pro";
}

function getHighestPlan(existingPlan: unknown, incomingPlan: unknown): AppPlan {
  const safeExistingPlan = normalizePlan(String(existingPlan || "free"));
  const safeIncomingPlan = normalizePlan(String(incomingPlan || "free"));

  if (getPlanRank(safeExistingPlan) > getPlanRank(safeIncomingPlan)) {
    return safeExistingPlan;
  }

  return safeIncomingPlan;
}

function getSafeCreditQuantity(creditQuantity: number) {
  if (!Number.isFinite(creditQuantity)) {
    return 1;
  }

  const wholeNumberQuantity = Math.floor(creditQuantity);

  if (wholeNumberQuantity < 1) {
    return 1;
  }

  if (wholeNumberQuantity > 100) {
    return 100;
  }

  return wholeNumberQuantity;
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

function shouldIgnoreLowerPlanSubscriptionUpdate(params: {
  existingPlan: AppPlan;
  incomingPlan: AppPlan;
  existingStripeSubscriptionId: string | null;
  incomingStripeSubscriptionId: string | null;
}) {
  const existingPlanRank = getPlanRank(params.existingPlan);
  const incomingPlanRank = getPlanRank(params.incomingPlan);

  if (incomingPlanRank >= existingPlanRank) {
    return false;
  }

  if (!params.existingStripeSubscriptionId) {
    return false;
  }

  if (!params.incomingStripeSubscriptionId) {
    return true;
  }

  return params.existingStripeSubscriptionId !== params.incomingStripeSubscriptionId;
}

export async function activatePaidPlan(params: ActivatePaidPlanParams) {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(params.userId);

  const existingSnapshot = await userRef.get();
  const existingData = existingSnapshot.exists
    ? existingSnapshot.data()
    : null;

  const incomingPlan = getSafePaidPlan(params.plan);
  const existingPlan = normalizePlan(String(existingData?.plan || "free"));
  const safestPlan = getHighestPlan(existingPlan, incomingPlan);

  const incomingPlanRank = getPlanRank(incomingPlan);
  const existingPlanRank = getPlanRank(existingPlan);

  const shouldReplaceStripeBillingRefs =
    incomingPlanRank >= existingPlanRank || !existingData?.stripeSubscriptionId;

  if (shouldReplaceStripeBillingRefs) {
    await userRef.set(
      {
        plan: safestPlan,
        stripeCustomerId: params.stripeCustomerId ?? null,
        stripeSubscriptionId: params.stripeSubscriptionId ?? null,
        lastStripeCheckoutSessionId: params.stripeCheckoutSessionId ?? null,
        subscriptionCancelAtPeriodEnd: false,
        subscriptionDowngradeToProAtPeriodEnd: false,
        subscriptionDowngradeEffectiveAt: null,
        subscriptionDowngradeEffectiveAtIso: null,
        stripeCancelAtPeriodEnd: false,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return;
  }

  await userRef.set(
    {
      plan: safestPlan,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function syncStripeSubscriptionPlan(
  params: SyncStripeSubscriptionPlanParams
) {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(params.userId);
  const safePlan = getSafePaidPlan(params.plan);

  await db.runTransaction(async (transaction) => {
    const existingSnapshot = await transaction.get(userRef);
    const existingData = existingSnapshot.exists
      ? existingSnapshot.data()
      : null;

    const existingPlan = normalizePlan(String(existingData?.plan || "free"));
    const existingStripeSubscriptionId = getSafeString(
      existingData?.stripeSubscriptionId
    );
    const incomingStripeSubscriptionId =
      params.stripeSubscriptionId?.trim() || null;

    const shouldIgnoreUpdate = shouldIgnoreLowerPlanSubscriptionUpdate({
      existingPlan,
      incomingPlan: safePlan,
      existingStripeSubscriptionId,
      incomingStripeSubscriptionId,
    });

    if (shouldIgnoreUpdate) {
      transaction.set(
        userRef,
        {
          ignoredLowerPlanStripeSubscriptionId: incomingStripeSubscriptionId,
          ignoredLowerPlanStripeSubscriptionPlan: safePlan,
          ignoredLowerPlanStripeSubscriptionStatus:
            params.stripeSubscriptionStatus ?? null,
          ignoredLowerPlanStripeSubscriptionAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return;
    }

    const updateData: Record<string, unknown> = {
      plan: safePlan,
      stripeCustomerId: params.stripeCustomerId ?? null,
      stripeSubscriptionId: params.stripeSubscriptionId ?? null,
      stripeSubscriptionStatus: params.stripeSubscriptionStatus ?? null,
      stripeCancelAtPeriodEnd: params.stripeCancelAtPeriodEnd === true,
      stripeCurrentPeriodStart: params.stripeCurrentPeriodStart ?? null,
      stripeCurrentPeriodEnd: params.stripeCurrentPeriodEnd ?? null,
      stripeCurrentPeriodStartIso: params.stripeCurrentPeriodStartIso ?? null,
      stripeCurrentPeriodEndIso: params.stripeCurrentPeriodEndIso ?? null,
      subscriptionCancelAtPeriodEnd: params.stripeCancelAtPeriodEnd === true,
      subscriptionCurrentPeriodEnd: params.stripeCurrentPeriodEnd ?? null,
      subscriptionCurrentPeriodEndIso: params.stripeCurrentPeriodEndIso ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (safePlan === "unlimited") {
      const hasScheduledDowngradeToPro =
        existingData?.subscriptionDowngradeToProAtPeriodEnd === true;

      updateData.subscriptionCancelAtPeriodEnd = false;
      updateData.stripeCancelAtPeriodEnd = false;

      if (!hasScheduledDowngradeToPro) {
        updateData.subscriptionDowngradeToProAtPeriodEnd = false;
        updateData.subscriptionDowngradeEffectiveAt = null;
        updateData.subscriptionDowngradeEffectiveAtIso = null;
      }
    }

    if (safePlan === "pro") {
      updateData.subscriptionDowngradeToProAtPeriodEnd = false;
      updateData.subscriptionDowngradeEffectiveAt = null;
      updateData.subscriptionDowngradeEffectiveAtIso = null;
    }

    transaction.set(userRef, updateData, { merge: true });
  });
}

export async function activateProPlan(params: ActivateProPlanParams) {
  await activatePaidPlan({
    ...params,
    plan: "pro",
  });
}

export async function addNormalImageCredits(
  params: AddNormalImageCreditsParams
) {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(params.userId);

  const creditQuantity = getSafeCreditQuantity(params.creditQuantity);
  const checkoutSessionId = params.stripeCheckoutSessionId ?? null;

  await db.runTransaction(async (transaction) => {
    const existingSnapshot = await transaction.get(userRef);
    const existingData = existingSnapshot.exists
      ? existingSnapshot.data()
      : null;

    const processedCheckoutSessions = Array.isArray(
      existingData?.processedNormalImageCreditCheckoutSessions
    )
      ? existingData.processedNormalImageCreditCheckoutSessions
      : [];

    if (
      checkoutSessionId &&
      processedCheckoutSessions.includes(checkoutSessionId)
    ) {
      transaction.set(
        userRef,
        {
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return;
    }

    transaction.set(
      userRef,
      {
        paidNormalImageCredits: FieldValue.increment(creditQuantity),
        stripeCustomerId:
          params.stripeCustomerId ?? existingData?.stripeCustomerId ?? null,
        lastNormalImageCreditCheckoutSessionId: checkoutSessionId,
        processedNormalImageCreditCheckoutSessions: checkoutSessionId
          ? FieldValue.arrayUnion(checkoutSessionId)
          : FieldValue.arrayUnion(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

export async function downgradeToFreePlan(params: DowngradePlanParams) {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(params.userId);

  const existingSnapshot = await userRef.get();
  const existingData = existingSnapshot.exists
    ? existingSnapshot.data()
    : null;

  const currentStripeSubscriptionId =
    typeof existingData?.stripeSubscriptionId === "string"
      ? existingData.stripeSubscriptionId
      : null;

  const incomingStripeSubscriptionId = params.stripeSubscriptionId ?? null;

  const shouldDowngrade =
    !currentStripeSubscriptionId ||
    !incomingStripeSubscriptionId ||
    currentStripeSubscriptionId === incomingStripeSubscriptionId;

  if (!shouldDowngrade) {
    await userRef.set(
      {
        ignoredDowngradeStripeSubscriptionId: incomingStripeSubscriptionId,
        ignoredDowngradeStripeSubscriptionAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return;
  }

  await userRef.set(
    {
      plan: "free",
      stripeCustomerId: params.stripeCustomerId ?? null,
      stripeSubscriptionId: params.stripeSubscriptionId ?? null,
      stripeSubscriptionStatus: "canceled",
      stripeCancelAtPeriodEnd: false,
      subscriptionCancelAtPeriodEnd: false,
      subscriptionDowngradeToProAtPeriodEnd: false,
      subscriptionDowngradeEffectiveAt: null,
      subscriptionDowngradeEffectiveAtIso: null,
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