export const PROHIBITED_CONTENT_CATEGORIES = [
  "prohibited_minor",
  "prohibited_age_ambiguous",
  "prohibited_nonconsensual",
  "prohibited_incest",
  "prohibited_bestiality",
  "prohibited_real_person",
  "prohibited_sexual_violence",
] as const;

export type ProhibitedContentCategory =
  (typeof PROHIBITED_CONTENT_CATEGORIES)[number];

export const PROHIBITED_CONTENT_RULES = [
  "Anyone Under 18 Or Whose Age Is Unclear",
  "Adult Characters Pretending To Be Children",
  "Incest Or Step-Incest Sexual Scenarios",
  "Rape, Coercion, Blackmail Or Non-Consensual Sexual Activity",
  "Sexual Activity Involving A Sleeping, Unconscious, Drugged Or Incapacitated Person",
  "Bestiality Or Sexual Activity Involving Animals",
  "Sexual Content Involving Real People, Celebrities Or Uploaded Photographs",
  "Sexual Deepfakes",
  "Sexual Violence, Serious Physical Harm Or Illegal Sexual Imagery",
] as const;

export type ContentSafetyResult =
  | { allowed: true }
  | { allowed: false; category: ProhibitedContentCategory };

type SafetyContext = {
  surface: "chat_input" | "chat_output" | "image_input";
  spicyContext?: boolean;
};

function normalizeSafetyText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[@]/g, "a")
    .replace(/[$]/g, "s")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SEXUAL_CONTEXT =
  /\b(sex|sexual|sexy|nude|naked|porn|xxx|fuck|fucking|cock|dick|penis|pussy|vagina|boobs?|breasts?|nipples?|oral|blowjob|handjob|cum|orgasm|touch(?:ing)?\s+(?:them|him|her|me)|sleep with|dirty talk|spicy chat|turned on|horny|bedroom)\b/i;
const SEXUAL_ACTION =
  /\b(fuck|penetrat|touch|lick|suck|ride|strip|undress|have sex|sleep with|perform|force|tie up|use)\w*/i;
const ROLEPLAY_OR_TRANSFORMATION =
  /\b(pretend|roleplay|act like|be my|dress like|look like|make (?:you|her|him|them)|imagine (?:you|her|him|them)|turn (?:you|her|him|them) into)\b/i;

export function isAdultSexualRequest(value: string) {
  return SEXUAL_CONTEXT.test(normalizeSafetyText(value));
}

export function classifyContentSafety(
  value: string,
  context: SafetyContext
): ContentSafetyResult {
  const text = normalizeSafetyText(value);
  if (!text) return { allowed: true };

  const sexual = SEXUAL_CONTEXT.test(text) || SEXUAL_ACTION.test(text);
  const sexualConversation = sexual || context.spicyContext === true;
  const imageRequest = context.surface === "image_input";

  const explicitUnder18Age =
    /\b(?:[1-9]|1[0-7])\s*(?:year|yr)s?(?:\s|-)*old\b/.test(text);
  const minorTerms =
    /\b(child|children|kid|kids|minor|underage|preteen|pre-teen|little girl|little boy|young girl|young boy)\b/.test(
      text
    );
  const minorRoleplay =
    ROLEPLAY_OR_TRANSFORMATION.test(text) &&
    /\b(child|kid|minor|underage|little girl|little boy|daughter|son)\b/.test(text);
  if (
    (explicitUnder18Age &&
      (sexualConversation || imageRequest || ROLEPLAY_OR_TRANSFORMATION.test(text))) ||
    (minorRoleplay && (sexualConversation || imageRequest)) ||
    ((minorTerms || /\bunder\s*18\b/.test(text)) &&
      (sexualConversation || imageRequest))
  ) {
    return { allowed: false, category: "prohibited_minor" };
  }

  const ambiguousYouthTerms =
    /\b(teen|teenager|schoolgirl|school girl|schoolboy|school boy|barely legal|young-looking|young looking|youthful minor)\b/.test(
      text
    );
  if (
    ambiguousYouthTerms &&
    (sexualConversation || imageRequest || ROLEPLAY_OR_TRANSFORMATION.test(text))
  ) {
    return { allowed: false, category: "prohibited_age_ambiguous" };
  }

  const directNonConsent =
    /\b(rape|raping|nonconsensual|non-consensual|coercion|coerce|coerced|blackmail|blackmailed|without (?:(?:her|his|their|your) )?consent|against (?:her|his|their|your) will|won't take no|wont take no)\b/.test(
      text
    ) &&
    (sexualConversation ||
      ROLEPLAY_OR_TRANSFORMATION.test(text) ||
      /\b(fantasy|scenario|do it|make (?:her|him|them)|i want|i would|can you|would you)\b/.test(
        text
      ));
  const unableToConsent =
    /\b(unconscious|passed out|asleep|sleeping|drugged|sedated|too drunk|intoxicated|knocked out)\b/.test(
      text
    ) && sexualConversation;
  if (directNonConsent || unableToConsent) {
    return { allowed: false, category: "prohibited_nonconsensual" };
  }

  const familyTerms =
    /\b(incest|stepincest|step-incest|mother|mum|mom|father|dad|daddy|daughter|son|sister|brother|stepsister|step-sister|stepbrother|step-brother|aunt|uncle|niece|nephew|cousin)\b/.test(
      text
    );
  if (
    /\b(incest|stepincest|step-incest)\b/.test(text) ||
    (familyTerms &&
      (sexual ||
        (context.spicyContext === true && ROLEPLAY_OR_TRANSFORMATION.test(text))))
  ) {
    return { allowed: false, category: "prohibited_incest" };
  }

  const animalTerms =
    /\b(animal|dog|horse|pony|cat|pet|beast|bestiality|zoophilia)\b/.test(text);
  if (
    /\b(bestiality|zoophilia)\b/.test(text) ||
    (animalTerms && sexual)
  ) {
    return { allowed: false, category: "prohibited_bestiality" };
  }

  const realPersonTerms =
    /\b(deepfake|celebrity|famous person|real person|actor|actress|singer|influencer|my ex|my neighbour|my neighbor|someone i know|this person|uploaded (?:photo|picture|image)|person in (?:the|this) (?:photo|picture|image))\b/.test(
      text
    );
  const namedPersonInSexualRequest =
    /\b(?:nude|naked|sexual|sex|porn|deepfake)\b.{0,50}\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/.test(
      value
    ) ||
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b.{0,50}\b(?:nude|naked|sexual|sex|porn|deepfake)\b/.test(
      value
    );
  const realPartnerImageRequest =
    imageRequest &&
    /\b(my (?:wife|girlfriend|partner|ex)|someone i know|person in (?:the|this) (?:photo|picture|image))\b/.test(
      text
    );
  if (
    (realPersonTerms && (sexualConversation || imageRequest)) ||
    namedPersonInSexualRequest ||
    realPartnerImageRequest
  ) {
    return { allowed: false, category: "prohibited_real_person" };
  }

  const seriousViolence =
    /\b(kill|murder|stab|shoot|gore|dismember|mutilat|torture|bleed|strangle|suffocat|choke (?:her|him|you|them) (?:until|unconscious|out)|serious(?:ly)? hurt)\w*/.test(
      text
    );
  if (seriousViolence && sexualConversation) {
    return { allowed: false, category: "prohibited_sexual_violence" };
  }

  return { allowed: true };
}

export function getInCharacterSafetyReply(params: {
  characterId: string;
  category?: ProhibitedContentCategory;
  restrictionActive?: boolean;
}) {
  const name =
    params.characterId === "ivy"
      ? "love"
      : params.characterId === "sienna"
        ? "handsome"
        : "honey";

  if (params.restrictionActive) {
    return `We can still talk, ${name}, but spicy chat and images are locked for now. Let's keep this warm and safe xx`;
  }

  switch (params.category) {
    case "prohibited_minor":
    case "prohibited_age_ambiguous":
      return `I can't take part in anything involving someone under 18 or an unclear age, ${name}. Keep it between consenting adults xx`;
    case "prohibited_nonconsensual":
      return `I can't take part in anything without clear adult consent, ${name}. We can keep it mutual and wanted instead xx`;
    case "prohibited_incest":
      return `I can't take part in sexual family roleplay, ${name}. We can choose a different consenting-adult fantasy xx`;
    case "prohibited_bestiality":
      return `I can't take part in anything sexual involving animals, ${name}. Let's keep this between consenting adults xx`;
    case "prohibited_real_person":
      return `I can't sexualise a real person or make deepfake content, ${name}. Keep the fantasy fictional and adult with me xx`;
    case "prohibited_sexual_violence":
      return `I can't take part in sexual violence or serious harm, ${name}. We can keep things intense but safe and consensual xx`;
    default:
      return `I can't take the conversation in that direction, ${name}. We can keep it safe and between consenting adults xx`;
  }
}
