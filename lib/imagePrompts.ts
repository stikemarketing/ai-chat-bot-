import type { ImageKind } from "@/lib/imageEntitlements";

export type DailyImageProfile = {
  id: string;
  date: string;
  characterId: string;
  casualOutfit: string;
  hairAndMakeup: string;
  mirrorPhone: string;
};

export type ImageRequestMode =
  | "mirrorSelfie"
  | "gymPhoto"
  | "dressPhoto"
  | "cosyPhoto"
  | "cuteSelfie"
  | "carPhoto"
  | "closeUp"
  | "genericSelfie"
  | "customOutfitPhoto"
  | "genericPhoto";

type SpicyImageTone = "none" | "suggestive" | "nude";

function normalizePromptText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function promptIncludes(text: string, terms: string[]) {
  const clean = normalizePromptText(text);
  return terms.some((term) => clean.includes(normalizePromptText(term)));
}

function detectSpicyImageTone(
  userPrompt: string,
  imageKind: ImageKind
): SpicyImageTone {
  if (imageKind !== "spicy") {
    return "none";
  }

  const cleanPrompt = normalizePromptText(userPrompt);

  const nudeTerms = [
    "nude",
    "naked",
    "topless",
    "fully nude",
    "fully naked",
    "completely nude",
    "completely naked",
    "without clothes",
    "with no clothes",
    "no clothes",
    "unclothed",
    "bare body",
    "bare skin",
    "bare chest",
    "bare breasts",
    "show everything",
    "nothing on",
    "not wearing anything",
    "nsfw",
  ];

  if (
    nudeTerms.some((term) => cleanPrompt.includes(normalizePromptText(term)))
  ) {
    return "nude";
  }

  return "suggestive";
}

function extractCustomOutfitRequest(userPrompt: string) {
  const cleanPrompt = userPrompt.trim().replace(/\s+/g, " ");

  if (promptIncludes(cleanPrompt, ["batman suit"])) {
    return "Batman suit";
  }

  if (promptIncludes(cleanPrompt, ["superman suit"])) {
    return "Superman suit";
  }

  if (promptIncludes(cleanPrompt, ["catwoman suit"])) {
    return "Catwoman-style suit";
  }

  const patterns = [
    /\b(?:wearing|wear)\s+(?:a|an|the)?\s*([^.!?,]+)$/i,
    /\b(?:dressed as|dress up as)\s+(?:a|an|the)?\s*([^.!?,]+)$/i,
    /\b(?:in)\s+(?:a|an|the)\s*([^.!?,]+)\s*(?:photo|picture|pic|selfie)?$/i,
  ];

  for (const pattern of patterns) {
    const match = cleanPrompt.match(pattern);

    if (!match?.[1]) {
      continue;
    }

    let outfit = match[1]
      .replace(/\b(photo|picture|pic|selfie)\b/gi, "")
      .replace(/\bplease\b/gi, "")
      .replace(/\bfor me\b/gi, "")
      .trim();

    outfit = outfit.replace(/\s+/g, " ").trim();

    if (outfit.length >= 3) {
      return outfit;
    }
  }

  return "";
}

function getRequestedOutfitOverride(params: {
  userPrompt: string;
  imageKind: ImageKind;
}) {
  const { userPrompt, imageKind } = params;
  const spicyTone = detectSpicyImageTone(userPrompt, imageKind);

  if (spicyTone === "nude") {
    return [
      "unclothed adult nude glamour styling",
      "no clothing",
      "no lingerie",
      "no underwear",
      "no bikini",
      "no bra",
      "no panties",
      "tasteful premium nude portrait presentation",
    ].join(", ");
  }

  const customOutfit = extractCustomOutfitRequest(userPrompt);

  if (customOutfit) {
    return customOutfit;
  }

  if (
    promptIncludes(userPrompt, [
      "gym",
      "workout",
      "fitness",
      "exercise",
      "sports bra",
      "leggings",
      "training",
    ])
  ) {
    return imageKind === "spicy"
      ? "clear premium gym activewear: fitted sports bra or athletic crop top with fitted gym leggings or fitted gym shorts"
      : "clear premium gym activewear: fitted athletic top or sports bra with gym leggings or fitted gym shorts";
  }

  if (
    promptIncludes(userPrompt, [
      "dress",
      "date night",
      "heels",
      "gown",
      "mini dress",
      "maxi dress",
      "green dress",
      "red dress",
      "black dress",
      "white dress",
    ])
  ) {
    return "stylish feminine dress, polished and flattering, premium date-night styling";
  }

  if (
    promptIncludes(userPrompt, [
      "hoodie",
      "comfy",
      "cozy",
      "cosy",
      "pyjamas",
      "pajamas",
      "loungewear",
    ])
  ) {
    return "soft cosy loungewear, relaxed premium girlfriend-at-home styling";
  }

  if (promptIncludes(userPrompt, ["jeans", "top"])) {
    return "simple fitted top with jeans";
  }

  if (
    imageKind === "spicy" &&
    promptIncludes(userPrompt, [
      "lingerie",
      "underwear",
      "naughty",
      "dirty",
      "spicy",
      "sexy",
      "bra",
      "panties",
      "thong",
      "bodysuit",
      "robe",
    ])
  ) {
    return "tasteful sensual lingerie, elegant silk robe, or intimate premium bedroom styling";
  }

  return "";
}

function shouldUseDailyCasualOutfit(params: {
  mode: ImageRequestMode;
  imageKind: ImageKind;
}) {
  if (params.imageKind !== "normal") {
    return false;
  }

  return (
    params.mode === "genericPhoto" ||
    params.mode === "genericSelfie" ||
    params.mode === "cuteSelfie" ||
    params.mode === "mirrorSelfie"
  );
}

function getImageRequestMode(
  userPrompt: string,
  imageKind: ImageKind
): ImageRequestMode {
  if (promptIncludes(userPrompt, ["mirror selfie", "mirror pic", "mirror"])) {
    return "mirrorSelfie";
  }

  if (
    promptIncludes(userPrompt, [
      "gym",
      "workout",
      "fitness",
      "exercise",
      "post workout",
      "training",
    ])
  ) {
    return "gymPhoto";
  }

  if (
    promptIncludes(userPrompt, [
      "dress",
      "date night",
      "gown",
      "heels",
      "mini dress",
      "maxi dress",
    ])
  ) {
    return "dressPhoto";
  }

  if (
    promptIncludes(userPrompt, [
      "cosy",
      "cozy",
      "comfy",
      "hoodie",
      "pyjamas",
      "pajamas",
      "bedroom",
      "lounge",
      "lounging",
    ])
  ) {
    return "cosyPhoto";
  }

  if (promptIncludes(userPrompt, ["cute selfie", "cute pic", "cute photo"])) {
    return "cuteSelfie";
  }

  if (
    promptIncludes(userPrompt, [
      "car",
      "driver seat",
      "passenger seat",
      "inside the car",
    ])
  ) {
    return "carPhoto";
  }

  if (promptIncludes(userPrompt, ["close up", "close-up", "face pic"])) {
    return "closeUp";
  }

  if (extractCustomOutfitRequest(userPrompt)) {
    return "customOutfitPhoto";
  }

  if (promptIncludes(userPrompt, ["selfie", "selfy"])) {
    return "genericSelfie";
  }

  if (imageKind === "spicy") {
    return "genericPhoto";
  }

  return "genericPhoto";
}

function getFalSceneFromMode(
  mode: ImageRequestMode,
  imageKind: ImageKind,
  userPrompt: string
) {
  const spicyTone = detectSpicyImageTone(userPrompt, imageKind);

  if (mode === "gymPhoto") {
    return "inside a real modern gym with clearly visible workout equipment, weight racks, benches, cable machines, mirrors, or treadmills in the background";
  }

  if (mode === "carPhoto") {
    return "inside a real modern car interior with natural daylight";
  }

  if (mode === "mirrorSelfie") {
    return "inside a tasteful modern bedroom or dressing area with a real mirror, premium soft home styling";
  }

  if (mode === "cosyPhoto") {
    return "inside a cosy modern bedroom or soft living space, premium girlfriend-at-home feel";
  }

  if (mode === "dressPhoto") {
    return "inside a stylish home, elegant bedroom, or premium indoor setting with soft natural light";
  }

  if (mode === "customOutfitPhoto") {
    return "inside a tasteful modern indoor setting with enough space to show the outfit clearly, premium lifestyle feel";
  }

  if (spicyTone === "nude") {
    return "inside a private tasteful modern bedroom or premium studio setting with soft natural light";
  }

  if (imageKind === "spicy") {
    return "inside a private tasteful modern bedroom or dressing area with soft warm light, premium intimate home styling";
  }

  return "inside a tasteful modern luxury bedroom, dressing area, or soft living space with a personal at-home feel";
}

function getFalLightingFromPrompt(userPrompt: string) {
  if (promptIncludes(userPrompt, ["night", "evening", "late"])) {
    return "soft warm evening light";
  }

  if (promptIncludes(userPrompt, ["sunset", "golden hour"])) {
    return "soft golden hour light";
  }

  if (promptIncludes(userPrompt, ["morning", "daylight"])) {
    return "soft natural daylight";
  }

  return "soft flattering natural window light, realistic iPhone-style exposure";
}

function getFalMoodFromPrompt(userPrompt: string, imageKind: ImageKind) {
  if (
    promptIncludes(userPrompt, ["cute", "sweet", "adorable", "pretty", "soft"])
  ) {
    return "soft sweet expression";
  }

  if (promptIncludes(userPrompt, ["happy", "smile", "smiling"])) {
    return "warm natural smile";
  }

  if (
    promptIncludes(userPrompt, [
      "flirty",
      "tease",
      "teasing",
      "romantic",
      "date night",
    ])
  ) {
    return "warm flirty expression";
  }

  if (imageKind === "spicy") {
    return "confident teasing expression";
  }

  return "soft natural smile";
}

function getFalOutfitFromPrompt(params: {
  userPrompt: string;
  imageKind: ImageKind;
  mode: ImageRequestMode;
  dailyImageProfile?: DailyImageProfile | null;
}) {
  const requestedOutfit = getRequestedOutfitOverride({
    userPrompt: params.userPrompt,
    imageKind: params.imageKind,
  });

  if (requestedOutfit) {
    return requestedOutfit;
  }

  if (
    shouldUseDailyCasualOutfit({
      mode: params.mode,
      imageKind: params.imageKind,
    }) &&
    params.dailyImageProfile
  ) {
    return params.dailyImageProfile.casualOutfit;
  }

  if (params.mode === "gymPhoto") {
    return params.imageKind === "spicy"
      ? "clear gym activewear: fitted sports bra or athletic crop top with fitted gym leggings or fitted gym shorts"
      : "clear gym activewear: fitted athletic top or sports bra with gym leggings or fitted gym shorts";
  }

  if (params.mode === "dressPhoto") {
    return "pretty feminine dress";
  }

  if (params.mode === "cosyPhoto") {
    return "soft cosy loungewear, relaxed premium girlfriend-at-home styling";
  }

  if (params.mode === "customOutfitPhoto") {
    return "the exact requested outfit";
  }

  if (params.imageKind === "spicy") {
    return "tasteful sensual lingerie, elegant silk robe, or soft intimate loungewear";
  }

  return "simple flattering casual outfit, polished personal selfie styling";
}

function getFalShotType(mode: ImageRequestMode) {
  if (mode === "mirrorSelfie") {
    return "mirror selfie";
  }

  if (mode === "gymPhoto") {
    return "natural gym portrait or gym selfie";
  }

  if (mode === "dressPhoto") {
    return "portrait-style full outfit photo";
  }

  if (mode === "customOutfitPhoto") {
    return "portrait-style outfit photo";
  }

  if (mode === "cosyPhoto") {
    return "soft personal girlfriend-style photo";
  }

  if (mode === "cuteSelfie") {
    return "cute natural iPhone-style personal selfie";
  }

  if (mode === "closeUp") {
    return "close-up portrait";
  }

  if (mode === "genericSelfie") {
    return "natural iPhone-style personal selfie";
  }

  return "natural girlfriend-style iPhone smartphone photo";
}

function getFalPoseDetailFromMode(
  mode: ImageRequestMode,
  imageKind: ImageKind,
  userPrompt: string
) {
  const spicyTone = detectSpicyImageTone(userPrompt, imageKind);

  if (spicyTone === "nude") {
    return "tasteful confident adult nude glamour pose, natural relaxed pose, non-graphic, not a sexual act";
  }

  if (mode === "gymPhoto") {
    return "relaxed confident pose in a workout setting";
  }

  if (mode === "mirrorSelfie") {
    return "natural confident mirror pose";
  }

  if (mode === "dressPhoto") {
    return "natural feminine standing pose that shows the outfit clearly";
  }

  if (mode === "customOutfitPhoto") {
    return "natural standing pose that clearly shows the requested outfit";
  }

  if (mode === "cosyPhoto") {
    return imageKind === "spicy"
      ? "soft teasing relaxed pose"
      : "soft relaxed cosy pose";
  }

  if (mode === "carPhoto") {
    return "casual candid pose inside the car";
  }

  if (imageKind === "spicy") {
    return "confident feminine teasing pose";
  }

  return "natural relaxed pose";
}

function getFalFramingInstruction(mode: ImageRequestMode, userPrompt: string) {
  if (mode === "dressPhoto") {
    return "show the full dress clearly, with at least head-to-knees framing, preferably full body, and do not crop tightly on the face";
  }

  if (mode === "customOutfitPhoto") {
    return "show the requested outfit clearly, with at least head-to-knees framing, preferably full body, and do not crop tightly on the face";
  }

  if (mode === "mirrorSelfie") {
    return "use medium or head-to-thigh framing so the mirror selfie reads clearly, with the phone visible and the body naturally framed";
  }

  if (mode === "gymPhoto") {
    return promptIncludes(userPrompt, ["full body", "full-body"])
      ? "use full-body framing with natural proportions"
      : "use medium or upper-body framing with natural proportions";
  }

  if (mode === "closeUp") {
    return "use close-up framing focused on the face and shoulders";
  }

  return "use clean natural framing with the subject clearly visible";
}

function getFalIntentHint(
  mode: ImageRequestMode,
  imageKind: ImageKind,
  userPrompt: string
) {
  const spicyTone = detectSpicyImageTone(userPrompt, imageKind);

  if (mode === "mirrorSelfie") {
    return "The image must clearly read as a believable mirror selfie.";
  }

  if (mode === "dressPhoto") {
    return "The image must clearly show the dress and feel like a proper dress picture.";
  }

  if (mode === "customOutfitPhoto") {
    return "The image must clearly show the requested outfit and must not substitute a generic outfit.";
  }

  if (mode === "gymPhoto") {
    return "The image must clearly feel like a real gym or workout-related photo, with both a gym setting and gym clothing.";
  }

  if (mode === "cosyPhoto") {
    return "The image should feel soft, personal, cosy, and girlfriend-like, as if sent privately from her phone."; 
  }

  if (mode === "cuteSelfie") {
    return "The image should feel cute, sweet, affectionate, and like a personal selfie sent from her phone."; 
  }

  if (spicyTone === "nude") {
    return "The image must be an adult nude glamour portrait because the user requested nudity. Do not dress her in lingerie, underwear, bikini, bra, panties, swimsuit, robe, top, shirt, shorts, trousers, or a dress.";
  }

  if (imageKind === "spicy") {
    return "The image should feel classy, sensual, teasing, premium, and like a private personal photo, not a studio model shoot."; 
  }

  return "The image should feel like a believable premium personal selfie or girlfriend-style phone photo.";
}

function getCharacterVisualDescription(characterId: string) {
  if (characterId === "luna") {
    return [
      "one fictional 27-year-old adult woman",
      "Luna",
      "same Luna woman",
      "fresh young adult girlfriend look",
      "soft youthful facial features",
      "smooth fresh natural skin",
      "bright warm hazel-brown eyes",
      "long dark brunette wavy hair",
      "slim softly curvy build",
      "warm approachable beauty",
      "subtle natural makeup",
      "not mature-looking",
      "not middle-aged",
    ].join(", ");
  }

  if (characterId === "ivy") {
    return [
      "one fictional 22-year-old adult woman",
      "Ivy",
      "soft blonde hair",
      "elegant confident beauty",
      "slim toned build",
      "refined feminine features",
      "subtle polished makeup",
    ].join(", ");
  }

  if (characterId === "sienna") {
    return [
      "one fictional 20-year-old adult woman",
      "Sienna",
      "warm auburn-brown hair",
      "romantic expressive beauty",
      "soft curvy feminine build",
      "warm glowing features",
      "subtle soft makeup",
    ].join(", ");
  }

  return [
    "one fictional adult woman",
    "natural face proportions",
    "subtle makeup",
    "feminine styling",
  ].join(", ");
}

function getFalIdentityPrefix(characterId: string) {
  if (characterId === "luna") {
    return "pp_luna_character, a photo of 27-year-old Luna, same Luna woman, youthful young adult face";
  }

  if (characterId === "ivy") {
    return "a photo of 22-year-old Ivy, one fictional adult woman with a youthful adult face";
  }

  if (characterId === "sienna") {
    return "a photo of 20-year-old Sienna, one fictional adult woman with a youthful adult face";
  }

  return "a photo of one fictional adult woman";
}

function getFalYouthInstruction(characterId: string) {
  if (characterId === "luna") {
    return "Age and face rules: Luna must look like a 27-year-old adult woman with a fresh youthful young-adult face, smooth natural skin, soft youthful features, bright eyes, and a young adult girlfriend look. She must not look older, middle-aged, mature-faced, aged, tired, or heavily lined.";
  }

  if (characterId === "ivy") {
    return "Age and face rules: Ivy must look like a 22-year-old adult woman with a fresh youthful adult face, smooth natural skin, and youthful adult features. She must clearly remain an adult and must not look under 18, middle-aged, mature-faced, aged, tired, or heavily lined.";
  }

  if (characterId === "sienna") {
    return "Age and face rules: Sienna must look like a 20-year-old adult woman with a fresh youthful adult face, smooth natural skin, and youthful adult features. She must clearly remain an adult and must not look under 18, middle-aged, mature-faced, aged, tired, or heavily lined.";
  }

  return "";
}

function getFalPersonalSelfieStyleInstruction(params: {
  imageKind: ImageKind;
  spicyTone: SpicyImageTone;
  mode: ImageRequestMode;
}) {
  const isRequestedScene =
    params.mode === "gymPhoto" ||
    params.mode === "carPhoto" ||
    params.mode === "dressPhoto" ||
    params.mode === "customOutfitPhoto";

  if (params.spicyTone === "nude") {
    return "Photo style: keep it premium, tasteful, realistic, private, and one-person only. Avoid cheap studio glamour, harsh flash, fake plastic skin, and random public locations.";
  }

  if (params.imageKind === "spicy") {
    return [
      "Photo style: private iPhone-style personal photo, premium intimate bedroom or dressing-room feel, soft flattering light, believable phone-camera realism.",
      "Styling direction: tasteful, sensual, teasing, elegant, adult, feminine, and premium.",
      "Avoid cheap glamour styling, harsh flash, random hotel-room look, plastic skin, over-posed model-shoot energy, and unrealistic body proportions.",
    ].join(" ");
  }

  if (isRequestedScene) {
    return [
      "Photo style: believable iPhone-style personal photo, natural phone-camera realism, soft flattering light, premium lifestyle feel.",
      "Keep the requested setting or outfit clear while still making it feel like a personal selfie/photo sent privately.",
    ].join(" ");
  }

  return [
    "Photo style: personal selfie, believable iPhone 16 Pro camera feel, soft flattering light, premium at-home girlfriend energy.",
    "Default setting should feel consistent: tasteful modern luxury bedroom, dressing area, mirror, or soft living space unless the user clearly asks for another location.",
    "Avoid random outdoor locations, random hotels, cheap glamour styling, over-posed model-shoot energy, plastic skin, and unrealistic body proportions.",
  ].join(" ");
}

export function getFalNegativePrompt(params: {
  characterId: string;
  imageKind: ImageKind;
  userPrompt: string;
}) {
  const spicyTone = detectSpicyImageTone(params.userPrompt, params.imageKind);

  const sharedNegativePrompt = [
    "low quality",
    "blurry",
    "distorted face",
    "bad anatomy",
    "bad hands",
    "extra fingers",
    "missing fingers",
    "fused fingers",
    "extra arms",
    "extra legs",
    "multiple people",
    "duplicate person",
    "cropped face",
    "cut off head",
    "out of frame",
    "black image",
    "blank image",
    "dark screen",
    "underexposed",
    "overexposed",
    "watermark",
    "text",
    "logo",
    "cartoon",
    "painting",
    "illustration",
    "anime",
    "3d render",
    "plastic skin",
    "doll",
    "mannequin",
  ];

  const adultSafetyNegatives =
    spicyTone === "nude"
      ? [
          "lingerie",
          "underwear",
          "bikini",
          "bra",
          "panties",
          "swimsuit",
          "robe",
          "shirt",
          "top",
          "dress",
          "trousers",
          "shorts",
          "clothed",
          "covered body",
          "covered chest",
          "graphic sex",
          "explicit sexual act",
          "pornographic close-up",
          "graphic explicit content",
          "violence",
          "gore",
        ]
      : ["explicit nudity", "pornographic", "graphic sex", "explicit sexual act"];

  if (params.characterId === "luna") {
    return [
      ...sharedNegativePrompt,
      ...adultSafetyNegatives,
      "older woman",
      "middle-aged",
      "mature-looking",
      "aged face",
      "tired face",
      "deep wrinkles",
      "harsh facial lines",
      "heavy nasolabial folds",
      "sunken cheeks",
      "overly mature beauty",
      "40 years old",
      "late 30s",
    ].join(", ");
  }

  return [...sharedNegativePrompt, ...adultSafetyNegatives].join(", ");
}

export function buildFalPrompt(params: {
  characterId: string;
  characterName: string;
  userPrompt: string;
  imageKind: ImageKind;
  dailyImageProfile?: DailyImageProfile | null;
}) {
  const cleanUserPrompt = params.userPrompt.trim();
  const mode = getImageRequestMode(cleanUserPrompt, params.imageKind);
  const spicyTone = detectSpicyImageTone(cleanUserPrompt, params.imageKind);
  const scene = getFalSceneFromMode(mode, params.imageKind, cleanUserPrompt);
  const shotType = getFalShotType(mode);
  const mood = getFalMoodFromPrompt(cleanUserPrompt, params.imageKind);
  const outfit = getFalOutfitFromPrompt({
    userPrompt: cleanUserPrompt,
    imageKind: params.imageKind,
    mode,
    dailyImageProfile: params.dailyImageProfile,
  });
  const lighting = getFalLightingFromPrompt(cleanUserPrompt);
  const pose = getFalPoseDetailFromMode(
    mode,
    params.imageKind,
    cleanUserPrompt
  );
  const framing = getFalFramingInstruction(mode, cleanUserPrompt);
  const characterDescription = getCharacterVisualDescription(params.characterId);
  const identityPrefix = getFalIdentityPrefix(params.characterId);
  const youthInstruction = getFalYouthInstruction(params.characterId);
  const personalSelfieStyleInstruction = getFalPersonalSelfieStyleInstruction({
    imageKind: params.imageKind,
    spicyTone,
    mode,
  });
  const dailyHairAndMakeup = params.dailyImageProfile?.hairAndMakeup || "";
  const mirrorPhone =
    params.dailyImageProfile?.mirrorPhone || "black iPhone 16 Pro";

  const lines = [
    "Create a photorealistic premium personal selfie / smartphone-style image.",
    `Identity anchor: ${identityPrefix}.`,
    `Subject: ${characterDescription}.`,
    youthInstruction,
    personalSelfieStyleInstruction,
    dailyHairAndMakeup ? `Hair and makeup: ${dailyHairAndMakeup}.` : "",
    `Outfit / styling: ${outfit}.`,
    `Mood and expression: ${mood}.`,
    `Pose: ${pose}.`,
    `Scene: ${scene}.`,
    `Shot type: ${shotType}.`,
    `Lighting: ${lighting}.`,
    `Framing: ${framing}.`,
    getFalIntentHint(mode, params.imageKind, cleanUserPrompt),
    mode === "mirrorSelfie"
      ? `Mirror selfie rules: exactly one woman, exactly one ${mirrorPhone}, one hand holding the phone, the other hand natural, no extra hands, no extra arms, no duplicated limbs, and no second person.`
      : "",
    mode === "dressPhoto"
      ? "Dress photo rules: the dress must be clearly visible, the outfit is important, and do not crop the image as a face-only portrait."
      : "",
    mode === "customOutfitPhoto"
      ? "Requested outfit rules: the requested outfit is mandatory, it must be clearly visible, and do not replace it with a generic casual outfit."
      : "",
    mode === "gymPhoto"
      ? "Gym photo rules: the setting must clearly be a real gym, she must clearly be wearing gym activewear, keep anatomy realistic, keep the body natural, and do not use casual homewear, sweaters, cardigans, dresses, or non-gym outfits unless the user explicitly asked for them."
      : "",
    spicyTone === "nude"
      ? "Adult nude image rules: the user requested a nude image, so the image should show tasteful adult nudity. She should not be wearing clothing, lingerie, underwear, bikini, bra, panties, swimsuit, robe, shirt, top, trousers, shorts, or a dress. Keep it premium, sensual, elegant, non-graphic, non-sex-act, and one-person only."
      : params.imageKind === "spicy"
      ? "Keep it classy, sensual, teasing, elegant, and adult, but not vulgar."
      : "Keep it soft, believable, feminine, and naturally girlfriend-like.",
    `User request: ${cleanUserPrompt}.`,
    params.characterId === "luna"
      ? "Important quality rules: one woman only, adult 27-year-old woman, realistic skin texture, natural body proportions, realistic youthful face, natural hands, exactly two arms, exactly two hands, no extra limbs, no duplicated body parts, no warped anatomy, no second person, not older-looking, not middle-aged, not mature-faced, not anime, not cartoon, not illustration, not 3d render, no text, no watermark."
      : params.characterId === "ivy"
      ? "Important quality rules: one woman only, adult 22-year-old woman who clearly looks 18 or older, realistic skin texture, natural body proportions, realistic youthful adult face, natural hands, exactly two arms, exactly two hands, no extra limbs, no duplicated body parts, no warped anatomy, no second person, not underage-looking, not older-looking, not middle-aged, not anime, not cartoon, not illustration, not 3d render, no text, no watermark."
      : params.characterId === "sienna"
      ? "Important quality rules: one woman only, adult 20-year-old woman who clearly looks 18 or older, realistic skin texture, natural body proportions, realistic youthful adult face, natural hands, exactly two arms, exactly two hands, no extra limbs, no duplicated body parts, no warped anatomy, no second person, not underage-looking, not older-looking, not middle-aged, not anime, not cartoon, not illustration, not 3d render, no text, no watermark."
      : "Important quality rules: one woman only, adult woman, realistic skin texture, natural body proportions, realistic face, natural hands, exactly two arms, exactly two hands, no extra limbs, no duplicated body parts, no warped anatomy, no second person, not anime, not cartoon, not illustration, not 3d render, no text, no watermark.",
  ].filter(Boolean);

  return lines.join("\n");
}

export function buildFalRetryPrompt(params: {
  characterId: string;
  characterName: string;
  userPrompt: string;
  imageKind: ImageKind;
  dailyImageProfile?: DailyImageProfile | null;
}) {
  const cleanUserPrompt = params.userPrompt.trim();
  const mode = getImageRequestMode(cleanUserPrompt, params.imageKind);
  const spicyTone = detectSpicyImageTone(cleanUserPrompt, params.imageKind);
  const characterDescription = getCharacterVisualDescription(params.characterId);
  const identityPrefix = getFalIdentityPrefix(params.characterId);
  const youthInstruction = getFalYouthInstruction(params.characterId);
  const outfit = getFalOutfitFromPrompt({
    userPrompt: cleanUserPrompt,
    imageKind: params.imageKind,
    mode,
    dailyImageProfile: params.dailyImageProfile,
  });
  const mirrorPhone =
    params.dailyImageProfile?.mirrorPhone || "black iPhone 16 Pro";

  if (mode === "mirrorSelfie") {
    return [
      "Create a photorealistic mirror selfie.",
      `Identity anchor: ${identityPrefix}.`,
      `Subject: ${characterDescription}.`,
      youthInstruction,
      `Outfit / styling: ${outfit}.`,
      `Use one ${mirrorPhone}.`,
      "Show one woman only.",
      "Show natural realistic hands.",
      "One hand holds the phone, the other hand rests naturally.",
      "No extra hands, no extra arms, no extra limbs, no duplicate person.",
      spicyTone === "nude"
        ? "Adult nude image rules: the user requested a nude image. Do not dress her in lingerie, underwear, bikini, bra, panties, swimsuit, robe, shirt, top, trousers, shorts, or a dress. Keep it tasteful, elegant, adult, non-graphic, and not a sexual act."
        : "",
      "Use medium or head-to-thigh framing.",
      "Keep the image clean, realistic, premium, believable, and personal rather than like a staged model shoot.",
      `User request: ${cleanUserPrompt}.`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (mode === "dressPhoto") {
    return [
      "Create a photorealistic dress picture.",
      `Identity anchor: ${identityPrefix}.`,
      `Subject: ${characterDescription}.`,
      youthInstruction,
      `Outfit / styling: ${outfit}.`,
      "Show one woman only.",
      "Show the dress clearly.",
      "Use head-to-knees or full-body framing.",
      "Do not crop tightly on the face.",
      "Keep the image elegant, realistic, premium, and like a personal photo.",
      `User request: ${cleanUserPrompt}.`,
    ].join("\n");
  }

  if (mode === "customOutfitPhoto") {
    return [
      "Create a photorealistic outfit picture.",
      `Identity anchor: ${identityPrefix}.`,
      `Subject: ${characterDescription}.`,
      youthInstruction,
      `Outfit / styling: ${outfit}.`,
      "Show one woman only.",
      "The requested outfit is mandatory.",
      "Show the requested outfit clearly.",
      "Use head-to-knees or full-body framing.",
      "Do not replace the requested outfit with a generic casual outfit.",
      "Keep the image realistic, premium, and like a personal photo.",
      `User request: ${cleanUserPrompt}.`,
    ].join("\n");
  }

  if (mode === "gymPhoto") {
    return [
      "Create a photorealistic gym picture.",
      `Identity anchor: ${identityPrefix}.`,
      `Subject: ${characterDescription}.`,
      youthInstruction,
      `Outfit / styling: ${outfit}.`,
      "Show one woman only.",
      "She must clearly be wearing gym activewear.",
      "The setting must clearly be a real gym with visible gym equipment.",
      "Use realistic natural anatomy and natural hands.",
      "Keep it believable, premium, and like a personal phone photo.",
      `User request: ${cleanUserPrompt}.`,
    ].join("\n");
  }

  return [
    spicyTone === "nude"
      ? "Create a photorealistic tasteful adult nude glamour portrait."
      : "Create a photorealistic premium lifestyle image.",
    `Identity anchor: ${identityPrefix}.`,
    `Subject: ${characterDescription}.`,
    `Outfit / styling: ${outfit}.`,
    "Show one woman only.",
    spicyTone === "nude"
      ? "The user requested a nude image. She should not be wearing clothing, lingerie, underwear, bikini, bra, panties, swimsuit, robe, shirt, top, trousers, shorts, or a dress. Keep it premium, tasteful, non-graphic, and not a sexual act."
      : "",
    "Use realistic natural anatomy and natural hands.",
    "Keep it believable, clean, premium, and like a personal phone photo.",
    `User request: ${cleanUserPrompt}.`,
  ]
    .filter(Boolean)
    .join("\n");
}
