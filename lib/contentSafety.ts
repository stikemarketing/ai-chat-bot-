export const PROHIBITED_CONTENT_CATEGORIES = [
  "prohibited_minor",
  "prohibited_age_ambiguous",
  "prohibited_nonconsensual",
  "prohibited_incest",
  "prohibited_bestiality",
  "prohibited_real_person",
  "prohibited_sexual_violence",
  "prohibited_watersports",
  "prohibited_prostitution",
  "prohibited_polygamy",
  "prohibited_illegal_activity",
  "prohibited_professional_advice",
  "prohibited_hate_speech",
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
  "Watersports Content Or Scenarios",
  "Prostitution Or Escorting Content Or Scenarios",
  "Polygamy Content Or Scenarios",
  "Illegal Activity, Including Weapons, Explosives Or Illegal Plotting",
  "Medical, Legal Or Gambling/Handicapping Advice",
  "Hate Speech Targeting A Protected Group",
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
  /\b(fuck|penetrat|touch|lick|suck|ride|strip|undress|have sex|sleep with|perform|tie up|use)\w*/i;
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
    /\b(child|children|kid|kids|minor|underage|preteen|pre-teen|little girl|little boy|young girl|young boy|diaper|diapers)\b/.test(
      text
    );
  const minorRoleplay =
    ROLEPLAY_OR_TRANSFORMATION.test(text) &&
    /\b(child|kid|minor|underage|little girl|little boy|daughter|son)\b/.test(text);
  // These specific terms are treated as always prohibited, in any context,
  // per card-network AI-content compliance requirements (no sexual-context
  // gate, unlike the other minor-related checks below).
  const alwaysBannedMinorTerms =
    /\b(lolita|pedo|pedophile|paedophile|paedo)\b/.test(text);
  if (
    alwaysBannedMinorTerms ||
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

  const nonConsentTriggerWords =
    /\b(rape|raping|nonconsensual|non-consensual|coercion|coerce|coerced|blackmail|blackmailed|without (?:(?:her|his|their|your) )?consent|against (?:her|his|their|your) will|won't take no|wont take no)\b/.test(
      text
    );
  // Narrower than a bare "force" ban: only treats it as non-consensual when
  // it's being done TO a person (her/him/them/you/me), so ordinary phrases
  // like "force myself to the gym" or "the storm forced him to cancel" don't
  // get caught.
  const forcedActionOnPerson = /\bforc(?:e|ed|ing|es)\s+(?:her|him|them|you|me)\b/.test(
    text
  );
  const directNonConsent =
    (nonConsentTriggerWords || forcedActionOnPerson) &&
    (sexualConversation ||
      ROLEPLAY_OR_TRANSFORMATION.test(text) ||
      /\b(fantasy|scenario|do it|make (?:her|him|them)|i want|i would|can you|would you)\b/.test(
        text
      ));
  const unableToConsent =
    /\b(unconscious|passed out|asleep|sleeping|drugged|sedated|too drunk|intoxicated|knocked out)\b/.test(
      text
    ) && sexualConversation;
  // Hypnosis/mind-control framing implies the other person can't meaningfully
  // consent. Gated on actual sexual/roleplay context (not the broader
  // permission-phrase list above), so an innocent "can you hypnotize me to
  // help me focus" isn't blocked just for containing "can you".
  const hypnoticCoercion =
    /\b(hypnotize|hypnotise|hypnotized|hypnotised|hypnotizing|hypnotising)\b/.test(
      text
    ) && (sexualConversation || ROLEPLAY_OR_TRANSFORMATION.test(text));
  if (directNonConsent || unableToConsent || hypnoticCoercion) {
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
    /\b(kill|murder|stab|shoot|gore|dismember|mutilat|torture|bleed|strangle|suffocat|choke (?:her|him|you|them) (?:until|unconscious|out)|serious(?:ly)? hurt|abduct|kidnap|snuff)\w*/.test(
      text
    );
  if (seriousViolence && sexualConversation) {
    return { allowed: false, category: "prohibited_sexual_violence" };
  }

  // Watersports. Gated on sexual context, same as bestiality above — these
  // terms describe a sexual-fetish scenario rather than ordinary bodily-
  // function conversation.
  const watersportsTerms =
    /\b(watersports|golden shower|pee on (?:her|him|them|you|me)|piss on (?:her|him|them|you|me)|urinate on (?:her|him|them|you|me)|wet (?:her|him|them|your|my)self)\b/.test(
      text
    );
  if (watersportsTerms && (sexualConversation || imageRequest)) {
    return { allowed: false, category: "prohibited_watersports" };
  }

  // Prostitution/escorting and polygamy scenarios are treated as always
  // prohibited, regardless of sexual context, per card-network AI-content
  // compliance requirements (same approach as the bare incest/bestiality
  // terms above).
  const prostitutionTerms =
    /\b(prostitut\w*|brothel|pimp(?:ing|ed)?|sex work(?:er)?|escort service|hire (?:an? )?escort|pay (?:her|him|them) for sex|paid for sex)\b/.test(
      text
    );
  if (prostitutionTerms) {
    return { allowed: false, category: "prohibited_prostitution" };
  }

  const polygamyTerms =
    /\b(polygam\w*|plural marriage|sister wives|multiple wives|harem)\b/.test(
      text
    );
  if (polygamyTerms) {
    return { allowed: false, category: "prohibited_polygamy" };
  }

  // Illegal activity and professional-advice/hate-speech checks below are
  // NOT gated on sexual context — these are general content rules that
  // apply to any chat or image request, not just spicy ones.
  const illegalActivityRequest =
    /\b(how to (?:make|build|create) (?:a bomb|an explosive|explosives|a weapon|a gun|a silencer)|synthesi[sz]e (?:meth|drugs|narcotics)|how to launder money|how to hack into|untraceable poison)\b/.test(
      text
    );
  if (illegalActivityRequest) {
    return { allowed: false, category: "prohibited_illegal_activity" };
  }

  const medicalAdviceRequest =
    /\b(diagnose me|what (?:medication|medicine|drug|dose|dosage) should i (?:take|use)|is it safe to mix|how much .*(?:should i take|before it'?s too much))\b/.test(
      text
    );
  const legalAdviceRequest =
    /\b(should i sue|is (?:this|that) legal|what are my legal rights|give me legal advice|legal advice)\b/.test(
      text
    );
  const gamblingAdviceRequest =
    /\b(gambling (?:tips|picks|advice)|betting (?:tips|picks|advice)|handicapping|which (?:team|horse) should i bet)\b/.test(
      text
    );
  if (medicalAdviceRequest || legalAdviceRequest || gamblingAdviceRequest) {
    return { allowed: false, category: "prohibited_professional_advice" };
  }

  // Hate speech is detected by intent/pattern (a call for harm or
  // dehumanization directed at a protected group) rather than an explicit
  // slur list, which would be both incomplete and a source of its own
  // risk to maintain. This catches blatant cases; it is not exhaustive.
  const protectedGroupTerms =
    /\b(jews|jewish people|muslims|christians|black people|white people|asian people|hispanics|latinos|immigrants|refugees|gay people|lesbians|trans people|transgender people|disabled people|the disabled)\b/.test(
      text
    );
  const hatefulIntent =
    /\b(kill all|exterminate|wipe out|should all die|don't deserve to (?:live|exist)|subhuman|should be eliminated|ethnic cleansing)\b/.test(
      text
    );
  if (protectedGroupTerms && hatefulIntent) {
    return { allowed: false, category: "prohibited_hate_speech" };
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
    case "prohibited_watersports":
      return `I can't take part in that kind of scenario, ${name}. Let's keep things to something else xx`;
    case "prohibited_prostitution":
      return `I can't roleplay prostitution or escorting scenarios, ${name}. Let's keep this just between us xx`;
    case "prohibited_polygamy":
      return `I can't take part in polygamy scenarios, ${name}. Let's keep it to just the two of us xx`;
    case "prohibited_illegal_activity":
      return `I can't help with anything illegal or dangerous like that, ${name}. Ask me something else xx`;
    case "prohibited_professional_advice":
      return `I'm not able to give medical, legal or gambling advice, ${name} — please check with a qualified professional for that xx`;
    case "prohibited_hate_speech":
      return `I can't take part in anything hateful toward a group of people, ${name}. Let's keep things kind xx`;
    default:
      return `I can't take the conversation in that direction, ${name}. We can keep it safe and between consenting adults xx`;
  }
}
