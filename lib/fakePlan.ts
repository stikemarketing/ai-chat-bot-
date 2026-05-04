// lib/fakePlan.ts
import type { AppPlan } from "@/lib/plans";

const FAKE_PLAN_STORAGE_KEY = "ai_companion_fake_plan";

export function getFakePlan(): AppPlan | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(FAKE_PLAN_STORAGE_KEY);

  if (value === "pro" || value === "free") {
    return value;
  }

  return null;
}

export function setFakePlan(plan: AppPlan) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FAKE_PLAN_STORAGE_KEY, plan);
}

export function clearFakePlan() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(FAKE_PLAN_STORAGE_KEY);
}

export function getEffectivePlan(userPlan: string | null | undefined): AppPlan {
  const fakePlan = getFakePlan();

  if (fakePlan) {
    return fakePlan;
  }

  return userPlan === "pro" ? "pro" : "free";
}