export type ImagePlan = "free" | "pro" | "unlimited";

export type ImageKind = "normal" | "spicy";

export type ImageEntitlementResult =
  | {
      allowed: true;
      plan: ImagePlan;
      imageKind: ImageKind;
      dailyLimit: number | null;
      remainingToday: number | null;
      shouldUsePaidNormalCredit: false;
      reason: string;
    }
  | {
      allowed: false;
      plan: ImagePlan;
      imageKind: ImageKind;
      dailyLimit: number | null;
      remainingToday: number | null;
      paidNormalImageCredits: number;
      reason: string;
      upgradeRequired?: boolean;
      paymentRequired?: boolean;
    };

export type ImageUsageCounts = {
  normalImagesToday: number;
  spicyImagesToday: number;
  paidNormalImageCredits?: number;
};

type ImageDailyLimits = Record<
  ImagePlan,
  {
    includedNormalImages: number | null;
    includedSpicyImages: number | null;
  }
>;

export const IMAGE_DAILY_LIMITS: ImageDailyLimits = {
  free: {
    includedNormalImages: 0,
    includedSpicyImages: 0,
  },
  pro: {
    includedNormalImages: 10,
    includedSpicyImages: 3,
  },
  unlimited: {
    includedNormalImages: null,
    includedSpicyImages: null,
  },
};

export function normalizeImagePlan(plan: string | undefined | null): ImagePlan {
  const cleanPlan = String(plan || "free").trim().toLowerCase();

  if (cleanPlan === "unlimited") {
    return "unlimited";
  }

  if (cleanPlan === "pro") {
    return "pro";
  }

  return "free";
}

export function getSafeTimezone(value: string | undefined | null) {
  const timezone =
    typeof value === "string" && value.trim() ? value.trim() : "UTC";

  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "UTC";
  }
}

export function getDailyUsageDocId(params?: {
  date?: Date;
  timezone?: string | null;
}) {
  const date = params?.date || new Date();
  const timezone = getSafeTimezone(params?.timezone || "UTC");

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

export function getImageUsageDocId(
  date = new Date(),
  timezone?: string | null
) {
  return getDailyUsageDocId({
    date,
    timezone,
  });
}

function normalisePromptForImageKind(prompt: string) {
  return prompt
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasWholeWord(text: string, word: string) {
  const escapedWord = escapeRegExp(word);
  const regex = new RegExp(`(^|\\s)${escapedWord}(\\s|$)`, "i");
  return regex.test(text);
}

function hasPhrase(text: string, phrase: string) {
  const cleanPhrase = phrase
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanPhrase) {
    return false;
  }

  return text.includes(cleanPhrase);
}

function hasAnyWholeWord(text: string, words: string[]) {
  return words.some((word) => hasWholeWord(text, word));
}

function hasAnyPhrase(text: string, phrases: string[]) {
  return phrases.some((phrase) => hasPhrase(text, phrase));
}

function hasNearWords(params: {
  text: string;
  firstWords: string[];
  secondWords: string[];
  maxWordsBetween?: number;
}) {
  const maxWordsBetween = params.maxWordsBetween ?? 5;
  const words = params.text.split(/\s+/).filter(Boolean);

  for (let firstIndex = 0; firstIndex < words.length; firstIndex += 1) {
    const firstWord = words[firstIndex];

    if (!params.firstWords.includes(firstWord)) {
      continue;
    }

    const endIndex = Math.min(words.length, firstIndex + maxWordsBetween + 2);

    for (
      let secondIndex = firstIndex + 1;
      secondIndex < endIndex;
      secondIndex += 1
    ) {
      if (params.secondWords.includes(words[secondIndex])) {
        return true;
      }
    }
  }

  return false;
}

export function detectImageKindFromPrompt(prompt: string): ImageKind {
  const cleanPrompt = normalisePromptForImageKind(prompt);

  if (!cleanPrompt) {
    return "normal";
  }

  const directSpicyWords = [
    "spicy",
    "sexy",
    "seductive",
    "sensual",
    "naughty",
    "dirty",
    "freaky",
    "provocative",
    "revealing",
    "risque",
    "teasing",
    "tempting",
    "sultry",
    "horny",
    "nsfw",
  ];

  const adultImageWords = [
    "lingerie",
    "underwear",
    "bra",
    "panties",
    "bikini",
    "thong",
    "stockings",
    "garter",
    "corset",
    "bodysuit",
    "nightie",
    "robe",
    "fishnets",
    "babydoll",
  ];

  const strongAdultWords = [
    "nude",
    "naked",
    "topless",
    "bare",
    "strip",
    "stripped",
    "undress",
    "undressed",
    "oiled",
    "oil",
    "wet",
    "shower",
    "bath",
  ];

  const bodyFocusWords = [
    "body",
    "figure",
    "curves",
    "legs",
    "bum",
    "ass",
    "boobs",
    "tits",
    "chest",
    "cleavage",
  ];

  const romanticStyleWords = [
    "bedroom",
    "bed",
    "mirror",
    "outfit",
    "selfie",
    "photo",
    "picture",
    "pic",
    "pose",
    "look",
  ];

  const spicyPhrases = [
    "bedroom outfit",
    "bedroom photo",
    "bedroom picture",
    "bedroom selfie",
    "in lingerie",
    "wearing lingerie",
    "in underwear",
    "wearing underwear",
    "in a robe",
    "wearing a robe",
    "in bed wearing",
    "on the bed wearing",
    "something spicy",
    "something sexy",
    "something hot",
    "something naughty",
    "something dirty",
    "sexy photo",
    "sexy picture",
    "sexy selfie",
    "hot photo",
    "hot picture",
    "hot selfie",
    "spicy photo",
    "spicy picture",
    "spicy selfie",
    "revealing outfit",
    "naughty picture",
    "naughty photo",
    "naughty selfie",
    "dirty picture",
    "dirty photo",
    "dirty selfie",
    "freaky picture",
    "freaky photo",
    "adult picture",
    "adult photo",
    "adult selfie",
    "send me something naughty",
    "send me something spicy",
    "send me something sexy",
    "send me something dirty",
    "send me something hot",
    "show me something naughty",
    "show me something spicy",
    "show me something sexy",
    "show me something dirty",
    "show me something hot",
    "what im in for",
    "what i'm in for",
  ];

  const normalOnlyPhrases = [
    "cute picture",
    "cute photo",
    "cute selfie",
    "sweet picture",
    "sweet photo",
    "sweet selfie",
    "normal picture",
    "normal photo",
    "normal selfie",
    "casual picture",
    "casual photo",
    "casual selfie",
    "gym picture",
    "gym photo",
    "gym selfie",
    "workout picture",
    "workout photo",
    "workout selfie",
  ];

  if (
    hasAnyPhrase(cleanPrompt, normalOnlyPhrases) &&
    !hasAnyWholeWord(cleanPrompt, directSpicyWords) &&
    !hasAnyWholeWord(cleanPrompt, adultImageWords) &&
    !hasAnyWholeWord(cleanPrompt, strongAdultWords)
  ) {
    return "normal";
  }

  if (hasAnyPhrase(cleanPrompt, spicyPhrases)) {
    return "spicy";
  }

  if (hasAnyWholeWord(cleanPrompt, directSpicyWords)) {
    return "spicy";
  }

  if (hasAnyWholeWord(cleanPrompt, adultImageWords)) {
    return "spicy";
  }

  if (
    hasAnyWholeWord(cleanPrompt, strongAdultWords) &&
    (hasAnyWholeWord(cleanPrompt, romanticStyleWords) ||
      hasAnyWholeWord(cleanPrompt, bodyFocusWords))
  ) {
    return "spicy";
  }

  if (
    hasNearWords({
      text: cleanPrompt,
      firstWords: ["show", "send", "give"],
      secondWords: [
        "body",
        "curves",
        "legs",
        "bum",
        "ass",
        "boobs",
        "tits",
        "lingerie",
        "underwear",
      ],
      maxWordsBetween: 6,
    })
  ) {
    return "spicy";
  }

  return "normal";
}

function getPaidNormalImageCredits(usage: ImageUsageCounts) {
  return Math.max(usage.paidNormalImageCredits || 0, 0);
}

export function checkImageEntitlement(params: {
  plan: string | undefined | null;
  imageKind: ImageKind;
  usage: ImageUsageCounts;
}): ImageEntitlementResult {
  const plan = normalizeImagePlan(params.plan);
  const limits = IMAGE_DAILY_LIMITS[plan];
  const paidNormalImageCredits = getPaidNormalImageCredits(params.usage);

  if (params.imageKind === "spicy") {
    const dailyLimit = limits.includedSpicyImages;
    const usedToday = params.usage.spicyImagesToday;

    if (plan === "free") {
      return {
        allowed: false,
        plan,
        imageKind: params.imageKind,
        dailyLimit,
        remainingToday: 0,
        paidNormalImageCredits,
        reason: "Spicy images are not available on the free plan.",
        upgradeRequired: true,
      };
    }

    if (dailyLimit === null) {
      return {
        allowed: true,
        plan,
        imageKind: params.imageKind,
        dailyLimit,
        remainingToday: null,
        shouldUsePaidNormalCredit: false,
        reason: "Unlimited spicy images are available on this plan.",
      };
    }

    const remainingToday = Math.max(dailyLimit - usedToday, 0);

    if (remainingToday <= 0) {
      return {
        allowed: false,
        plan,
        imageKind: params.imageKind,
        dailyLimit,
        remainingToday,
        paidNormalImageCredits,
        reason:
          "Daily spicy image limit reached. Wait for your daily reset or upgrade to Unlimited for unrestricted image access.",
        upgradeRequired: plan === "pro",
      };
    }

    return {
      allowed: true,
      plan,
      imageKind: params.imageKind,
      dailyLimit,
      remainingToday,
      shouldUsePaidNormalCredit: false,
      reason: "Spicy image allowance available.",
    };
  }

  const dailyLimit = limits.includedNormalImages;
  const usedToday = params.usage.normalImagesToday;

  if (plan === "free") {
    return {
      allowed: false,
      plan,
      imageKind: params.imageKind,
      dailyLimit,
      remainingToday: 0,
      paidNormalImageCredits,
      reason:
        "Free plan does not include images. Upgrade to Pro to unlock image messages.",
      upgradeRequired: true,
    };
  }

  if (dailyLimit === null) {
    return {
      allowed: true,
      plan,
      imageKind: params.imageKind,
      dailyLimit,
      remainingToday: null,
      shouldUsePaidNormalCredit: false,
      reason: "Unlimited normal images are available on this plan.",
    };
  }

  const remainingToday = Math.max(dailyLimit - usedToday, 0);

  if (remainingToday <= 0) {
    return {
      allowed: false,
      plan,
      imageKind: params.imageKind,
      dailyLimit,
      remainingToday,
      paidNormalImageCredits,
      reason:
        "Daily normal image limit reached. Wait for your daily reset or upgrade to Unlimited for unrestricted image access.",
      upgradeRequired: plan === "pro",
    };
  }

  return {
    allowed: true,
    plan,
    imageKind: params.imageKind,
    dailyLimit,
    remainingToday,
    shouldUsePaidNormalCredit: false,
    reason: "Normal image allowance available.",
  };
}