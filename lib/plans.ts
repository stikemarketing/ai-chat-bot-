// lib/plans.ts
export type AppPlan = "free" | "pro";

export type PlanDefinition = {
  id: AppPlan;
  name: string;
  priceLabel: string;
  messageLimit: number | null;
  features: string[];
  ctaLabel: string;
  highlighted?: boolean;
};

export const FREE_PLAN_ID: AppPlan = "free";
export const PRO_PLAN_ID: AppPlan = "pro";

export const PLAN_DEFINITIONS: Record<AppPlan, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free Trial",
    priceLabel: "£0",
    messageLimit: 3,
    ctaLabel: "Current starter plan",
    features: [
      "One active character",
      "20 saved user messages",
      "Basic chat access",
      "Good for testing the app",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceLabel: "£14.99 / month",
    messageLimit: null,
    ctaLabel: "Upgrade to Pro",
    highlighted: true,
    features: [
      "Unlimited saved user messages",
      "Full character access later",
      "Priority feature access",
      "Built for full companion use",
    ],
  },
};

export function normalizePlan(plan: string | null | undefined): AppPlan {
  if (plan === "pro") {
    return "pro";
  }

  return "free";
}

export function getPlanDefinition(plan: string | null | undefined): PlanDefinition {
  return PLAN_DEFINITIONS[normalizePlan(plan)];
}

export function getMessageLimitForPlan(plan: string | null | undefined): number | null {
  return getPlanDefinition(plan).messageLimit;
}

export function hasReachedMessageLimit(params: {
  plan: string | null | undefined;
  messageCount: number;
}) {
  const limit = getMessageLimitForPlan(params.plan);

  if (limit === null) {
    return false;
  }

  return params.messageCount >= limit;
}

export function getRemainingMessages(params: {
  plan: string | null | undefined;
  messageCount: number;
}) {
  const limit = getMessageLimitForPlan(params.plan);

  if (limit === null) {
    return null;
  }

  return Math.max(0, limit - params.messageCount);
}