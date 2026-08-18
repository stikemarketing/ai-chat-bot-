export type AppPlan = "free" | "pro" | "unlimited";

export type PlanDefinition = {
  id: AppPlan;
  name: string;
  priceLabel: string;
  messageLimit: number | null;
  normalImageLimit: number | null;
  spicyImageLimit: number | null;
  features: string[];
  ctaLabel: string;
  highlighted?: boolean;
};

export const FREE_PLAN_ID: AppPlan = "free";
export const PRO_PLAN_ID: AppPlan = "pro";
export const UNLIMITED_PLAN_ID: AppPlan = "unlimited";

export const PLAN_DEFINITIONS: Record<AppPlan, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    priceLabel: "£0",
    messageLimit: 15,
    normalImageLimit: 0,
    spicyImageLimit: 0,
    ctaLabel: "Current starter plan",
    features: [
      "One active companion",
      "15 user messages per day",
      "Daily message reset based on your timezone",
      "Basic text chat access",
      "Personal selfies not included",
      "Spicy images not included",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceLabel: "£14.99 / month",
    messageLimit: null,
    normalImageLimit: 10,
    spicyImageLimit: 3,
    ctaLabel: "Upgrade to Pro",
    highlighted: true,
    features: [
      "Unlimited text messages",
      "10 personal selfies per day",
      "3 spicy images per day",
      "Daily image reset based on your timezone",
      "Upgrade to Unlimited for unrestricted image access",
      "Full paid companion experience with daily image allowances",
    ],
  },
  unlimited: {
    id: "unlimited",
    name: "Unlimited",
    priceLabel: "£29.99 / month",
    messageLimit: null,
    normalImageLimit: null,
    spicyImageLimit: null,
    ctaLabel: "Upgrade to Unlimited",
    features: [
      "Unlimited text messages",
      "Unlimited personal selfies",
      "Unlimited spicy images",
      "No daily image limits",
      "Unrestricted image access",
      "Built for the full companion experience",
    ],
  },
};

export function normalizePlan(plan: string | null | undefined): AppPlan {
  const cleanPlan = String(plan || "free").trim().toLowerCase();

  if (cleanPlan === "unlimited") {
    return "unlimited";
  }

  if (cleanPlan === "pro") {
    return "pro";
  }

  return "free";
}

export function getPlanDefinition(
  plan: string | null | undefined
): PlanDefinition {
  return PLAN_DEFINITIONS[normalizePlan(plan)];
}

export function getMessageLimitForPlan(
  plan: string | null | undefined
): number | null {
  return getPlanDefinition(plan).messageLimit;
}

export function getNormalImageLimitForPlan(
  plan: string | null | undefined
): number | null {
  return getPlanDefinition(plan).normalImageLimit;
}

export function getSpicyImageLimitForPlan(
  plan: string | null | undefined
): number | null {
  return getPlanDefinition(plan).spicyImageLimit;
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