import { NextRequest, NextResponse } from "next/server";
import { isAgeAssuranceEnforced } from "@/lib/ageAssurance";
import { FieldValue } from "firebase-admin/firestore";
import { fal } from "@fal-ai/client";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import {
  checkImageEntitlement,
  detectImageKindFromPrompt,
  getImageUsageDocId,
  type ImageKind,
  type ImageUsageCounts,
} from "@/lib/imageEntitlements";
import {
  getRandomLunaNormalImageCaption,
  getRandomLunaSpicyImageCaption,
} from "@/lib/imageCaptions";
import {
  buildFalPrompt,
  buildFalRetryPrompt,
  getFalNegativePrompt,
  type DailyImageProfile,
} from "@/lib/imagePrompts";
import { requestRunpodComfyImage } from "@/lib/runpodComfy";
import {
  classifyContentSafety,
  getInCharacterSafetyReply,
} from "@/lib/contentSafety";
import {
  deleteProhibitedUserMessage,
  getActiveSpicySafetyRestriction,
  recordProhibitedSafetyEvent,
} from "@/lib/serverContentSafety";

const VLLM_BASE_URL = process.env.VLLM_BASE_URL;
const MODEL_NAME = "Qwen/Qwen2.5-7B-Instruct";
const IMAGE_CAPTION_TIMEOUT_MS = 45_000;
const IMAGE_VALIDATION_TIMEOUT_MS = 20_000;
const IMAGE_VALIDATION_RETRY_LIMIT = 1;
const MIN_VALID_IMAGE_BYTES = 2_048;

const FAL_STANDARD_MODEL = "fal-ai/flux/dev";
const FAL_LORA_MODEL = "fal-ai/flux-lora";

const LUNA_FAL_LORA_URL =
  process.env.LUNA_FAL_LORA_URL?.trim() ||
  "https://v3b.fal.media/files/b/0aa41899/VoYqN-GXe_lJNynT0A1l8_pytorch_lora_weights.safetensors";

type ImageGenerateRequestBody = {
  userId?: string;
  characterId?: string;
  characterName?: string;
  prompt?: string;
  userMessageId?: string;
};

type AdminUserRecord = {
  id?: string;
  plan?: string;
  selectedCharacter?: string;
  timezone?: string;
  paidNormalImageCredits?: number;
  adultVerified?: boolean;
  safetySpicyLockedUntil?: unknown;
};

type ImageUsageRecord = {
  normalImagesToday?: number;
  spicyImagesToday?: number;
};

type ImageGeneratorRawResponse = {
  ok?: boolean;
  image_url?: string;
  image_base64?: string;
  mime_type?: string;
  image_prompt?: string;
  character_id?: string;
  status?: string;
  error?: string;
};

type NormalizedImageGeneratorResponse = {
  ok: true;
  imageUrl: string;
  imagePrompt: string;
  characterId?: string;
  status: string;
  provider?: string;
  imageModel?: string;
};

type FalImageResult = {
  images?: Array<{
    url?: string;
    width?: number;
    height?: number;
    content_type?: string;
  }>;
  prompt?: string;
  seed?: number;
  has_nsfw_concepts?: boolean[];
};

type FalImageInput = {
  prompt: string;
  negative_prompt?: string;
  image_size: string;
  num_inference_steps: number;
  guidance_scale: number;
  num_images: number;
};

type FalLoraImageInput = FalImageInput & {
  loras: Array<{
    path: string;
    scale?: number;
  }>;
};

type NudeTemplateApiResponse = {
  ok?: boolean;
  filename?: string;
  image_url?: string;
  error?: string;
  detail?: string;
};

type VllmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type VllmChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type VerifiedImageUser = {
  userId: string;
  user: AdminUserRecord;
};

function getSafeCharacterId(characterId: string) {
  const cleanCharacterId = characterId.trim().toLowerCase();

  if (cleanCharacterId === "luna") {
    return "luna";
  }

  if (cleanCharacterId === "ivy") {
    return "ivy";
  }

  if (cleanCharacterId === "sienna") {
    return "sienna";
  }

  return "luna";
}

function getCharacterNameFromId(characterId: string) {
  if (characterId === "ivy") {
    return "Ivy";
  }

  if (characterId === "sienna") {
    return "Sienna";
  }

  return "Luna";
}

function getBearerToken(request: NextRequest) {
  const authorizationHeader = request.headers.get("authorization") || "";
  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token?.trim()) {
    return "";
  }

  return token.trim();
}

async function getVerifiedImageUser(
  request: NextRequest
): Promise<VerifiedImageUser> {
  const token = getBearerToken(request);

  if (!token) {
    throw new Error("Missing Firebase authentication token.");
  }

  const decodedToken = await getAdminAuth().verifyIdToken(token);
  const userId = decodedToken.uid;

  const db = getAdminDb();
  const userSnapshot = await db.collection("users").doc(userId).get();

  if (!userSnapshot.exists) {
    throw new Error("Authenticated user was not found.");
  }

  return {
    userId,
    user: userSnapshot.data() as AdminUserRecord,
  };
}

function getImageProvider() {
  return process.env.IMAGE_PROVIDER?.trim().toLowerCase() || "modal";
}

function getImageGeneratorBaseUrl() {
  return process.env.IMAGE_GENERATOR_URL?.trim() || "http://127.0.0.1:8001";
}

function getImageGeneratorEndpoint() {
  return getImageGeneratorBaseUrl().replace(/\/$/, "");
}

function getRunpodNudeTemplateApiUrl() {
  return (
    process.env.RUNPOD_NUDE_TEMPLATE_API_URL?.trim().replace(/\/$/, "") || ""
  );
}

function getFalKey() {
  return process.env.FAL_KEY?.trim();
}

function getFalModelForCharacter(characterId: string) {
  if (characterId === "luna" && LUNA_FAL_LORA_URL) {
    return FAL_LORA_MODEL;
  }

  return FAL_STANDARD_MODEL;
}

function getImageModelLabel(params: {
  provider: string;
  characterId: string;
}) {
  if (params.provider === "runpod-nude-template") {
    return "runpod-nude-template";
  }

  if (params.provider === "runpod") {
    return (
      process.env.RUNPOD_COMFY_CHECKPOINT?.trim() ||
      "juggernaut_xl_v9.safetensors"
    );
  }

  if (params.provider === "fal") {
    return getFalModelForCharacter(params.characterId);
  }

  return "modal";
}

function getDailyImageProfileDocId(params: {
  date: Date;
  timezone?: string | null;
  characterId: string;
}) {
  const dateId = getImageUsageDocId(params.date, params.timezone);
  return `${dateId}_${params.characterId}`;
}

function isNudeTemplateRequest(prompt: string) {
  const cleanPrompt = prompt.toLowerCase();

  const nudeTerms = [
    "nude",
    "naked",
    "fully nude",
    "full nude",
    "topless",
    "bare breasts",
    "bare chest",
    "no clothes",
    "without clothes",
    "uncovered breasts",
    "strip",
    "stripped",
    "undress",
    "undressed",
  ];

  return nudeTerms.some((term) => cleanPrompt.includes(term));
}

function getDefaultDailyOutfitForCharacter(
  characterId: string,
  dateId: string
) {
  const lunaOutfits = [
    "soft cream fitted top with light lounge shorts",
    "white ribbed vest top with soft grey lounge shorts",
    "champagne satin cami with cosy cream cardigan",
    "black fitted long-sleeve top with soft lounge trousers",
    "blush pink cami with relaxed cream shorts",
  ];

  const ivyOutfits = [
    "ivory silk blouse with tailored black trousers",
    "black fitted top with elegant cream cardigan",
    "soft white camisole with chic high-waisted trousers",
    "cream knit top with simple gold jewellery",
    "black satin cami with tailored lounge trousers",
  ];

  const siennaOutfits = [
    "warm mocha fitted top with cream lounge trousers",
    "soft terracotta cami with cosy cardigan",
    "wine-coloured fitted top with relaxed cream trousers",
    "cream satin cami with warm brown cardigan",
    "soft blush top with elegant lounge shorts",
  ];

  const outfits =
    characterId === "ivy"
      ? ivyOutfits
      : characterId === "sienna"
      ? siennaOutfits
      : lunaOutfits;

  let seed = 0;

  for (const char of `${dateId}_${characterId}`) {
    seed += char.charCodeAt(0);
  }

  return outfits[seed % outfits.length];
}

function getDefaultHairAndMakeupForCharacter(characterId: string) {
  if (characterId === "ivy") {
    return "soft polished blonde hair, subtle elegant makeup, simple gold jewellery";
  }

  if (characterId === "sienna") {
    return "soft auburn-brown hair, warm glowing makeup, delicate jewellery";
  }

  return "loose dark brunette waves, fresh youthful natural makeup, delicate gold necklace";
}

async function getOrCreateDailyImageProfile(params: {
  userId: string;
  characterId: string;
  timezone?: string | null;
}): Promise<DailyImageProfile> {
  const db = getAdminDb();
  const now = new Date();
  const date = getImageUsageDocId(now, params.timezone);
  const docId = getDailyImageProfileDocId({
    date: now,
    timezone: params.timezone,
    characterId: params.characterId,
  });

  const profileRef = db
    .collection("users")
    .doc(params.userId)
    .collection("dailyImageProfiles")
    .doc(docId);

  const profileSnapshot = await profileRef.get();

  if (profileSnapshot.exists) {
    const data = profileSnapshot.data() as Partial<DailyImageProfile>;

    return {
      id: docId,
      date,
      characterId: params.characterId,
      casualOutfit:
        typeof data.casualOutfit === "string" && data.casualOutfit.trim()
          ? data.casualOutfit.trim()
          : getDefaultDailyOutfitForCharacter(params.characterId, date),
      hairAndMakeup:
        typeof data.hairAndMakeup === "string" && data.hairAndMakeup.trim()
          ? data.hairAndMakeup.trim()
          : getDefaultHairAndMakeupForCharacter(params.characterId),
      mirrorPhone:
        typeof data.mirrorPhone === "string" && data.mirrorPhone.trim()
          ? data.mirrorPhone.trim()
          : "black iPhone 16 Pro",
    };
  }

  const profile: DailyImageProfile = {
    id: docId,
    date,
    characterId: params.characterId,
    casualOutfit: getDefaultDailyOutfitForCharacter(params.characterId, date),
    hairAndMakeup: getDefaultHairAndMakeupForCharacter(params.characterId),
    mirrorPhone: "black iPhone 16 Pro",
  };

  await profileRef.set({
    ...profile,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return profile;
}

function normalizeImageGeneratorResponse(
  data: ImageGeneratorRawResponse,
  fallbackPrompt: string
): NormalizedImageGeneratorResponse {
  if (!data.ok) {
    throw new Error(data.error || "Image generator returned an error.");
  }

  if (data.image_url) {
    return {
      ok: true,
      imageUrl: data.image_url,
      imagePrompt: data.image_prompt || fallbackPrompt,
      characterId: data.character_id,
      status: data.status || "complete",
    };
  }

  if (data.image_base64) {
    const mimeType = data.mime_type || "image/png";

    return {
      ok: true,
      imageUrl: `data:${mimeType};base64,${data.image_base64}`,
      imagePrompt: data.image_prompt || fallbackPrompt,
      characterId: data.character_id,
      status: data.status || "complete",
    };
  }

  throw new Error("Image generator returned no usable image.");
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text) as VllmChatResponse;
  } catch {
    return null;
  }
}

function getCaptionCharacterStyle(characterId: string) {
  if (characterId === "ivy") {
    return [
      "You are Ivy.",
      "Your tone is elegant, confident, polished, and subtly teasing.",
      "You sound calm, feminine, self-assured, and a little seductive.",
    ].join("\n");
  }

  if (characterId === "sienna") {
    return [
      "You are Sienna.",
      "Your tone is warm, romantic, bold, passionate, and emotionally inviting.",
      "You sound affectionate, a little more intense, and naturally intimate.",
    ].join("\n");
  }

  return [
    "You are Luna.",
    "Your tone is warm, playful, flirty, affectionate, and easygoing.",
    "You sound soft, teasing, feminine, and naturally engaging.",
  ].join("\n");
}

function sanitizeGeneratedCaption(text: string) {
  return text
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getFallbackImageMessageText(params: {
  characterId: string;
  imageKind: ImageKind;
}) {
  const fallbackOptions =
    params.characterId === "ivy"
      ? params.imageKind === "spicy"
        ? [
            "You can look, but don’t blame me if I distract you 😏",
            "Mm… I had a feeling you’d enjoy that one.",
            "Try not to stare too hard, alright?",
            "There… now tell me what that did to you.",
          ]
        : [
            "Thought you might like this one 😘",
            "There you go… tell me what you think.",
            "A little something for you, handsome.",
            "I couldn’t resist sending you that.",
          ]
      : params.characterId === "sienna"
      ? params.imageKind === "spicy"
        ? [
            "Mmm… that one was definitely meant for you 🤍",
            "Tell me honestly… did I leave you wanting more?",
            "I was in a teasing mood when I sent that.",
            "That one feels a little dangerous… in a good way.",
          ]
        : [
            "I wanted to send you something sweet 🤍",
            "There you go… I hope that made you smile.",
            "A little picture for you, just because.",
            "Now come closer and tell me what you think.",
          ]
      : params.imageKind === "spicy"
      ? [
          "Mmm… be honest, do you like looking at me like that? 😘",
          "There you go, trouble… now tell me what you think.",
          "I had a feeling you’d enjoy that one 😏",
          "Try not to get too distracted by me now.",
        ]
      : [
          "There you go 😘 hope you like it.",
          "A little something for you, babe.",
          "Couldn’t resist sending you that one.",
          "Now tell me… did I make you smile?",
        ];

  const index = Math.floor(Math.random() * fallbackOptions.length);
  return fallbackOptions[index];
}

async function generateImageMessageText(params: {
  characterId: string;
  characterName: string;
  userPrompt: string;
  imageKind: ImageKind;
}) {
  if (params.characterId === "luna" && params.imageKind === "normal") {
    return getRandomLunaNormalImageCaption();
  }

  if (params.characterId === "luna" && params.imageKind === "spicy") {
    return getRandomLunaSpicyImageCaption();
  }

  const baseUrl = VLLM_BASE_URL?.trim();

  if (!baseUrl) {
    return getFallbackImageMessageText({
      characterId: params.characterId,
      imageKind: params.imageKind,
    });
  }

  const systemPrompt = [
    "You are writing the short text message that appears with an image just sent in a private AI companion chat.",
    getCaptionCharacterStyle(params.characterId),
    params.imageKind === "spicy"
      ? "The image was a spicy adult image request. Be a bit more teasing and intimate, but still classy, tasteful, and consensual."
      : "The image was a normal selfie or photo request. Be warm, playful, natural, and lightly flirty.",
    "Write exactly one short natural chat reply.",
    "Use 1 or 2 short sentences only.",
    "Keep it under 30 words total.",
    "It should feel like a real text message from the companion, not a description or narration.",
    "Do not mention the app, image generation, prompts, policies, or technical details.",
    "Do not say 'here is a picture from' or mention the character by name unless it feels absolutely natural.",
    "Do not use quotation marks.",
    "At most one short question.",
    "Keep it emotionally engaging and natural.",
  ].join("\n");

  const messages: VllmMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: [
        `The user asked for this image: "${params.userPrompt.trim()}".`,
        `The companion who sent the image is ${params.characterName}.`,
        "Write the short accompanying message now.",
      ].join(" "),
    },
  ];

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        model: MODEL_NAME,
        messages,
        temperature: 0.9,
        max_tokens: 80,
      }),
      signal: AbortSignal.timeout(IMAGE_CAPTION_TIMEOUT_MS),
    });

    const rawText = await response.text();
    const data = tryParseJson(rawText);

    if (!response.ok) {
      throw new Error(
        data?.error?.message || rawText || "Caption generation failed."
      );
    }

    if (!data) {
      throw new Error(
        `Caption generation returned non-JSON response: ${rawText}`
      );
    }

    const rawReply = data.choices?.[0]?.message?.content?.trim();

    if (!rawReply) {
      throw new Error("Generated image caption was empty.");
    }

    const caption = sanitizeGeneratedCaption(rawReply);

    if (!caption) {
      throw new Error("Generated image caption was empty after sanitising.");
    }

    return caption;
  } catch (error) {
    console.warn("Falling back to static image caption:", error);

    return getFallbackImageMessageText({
      characterId: params.characterId,
      imageKind: params.imageKind,
    });
  }
}

async function getImageUsageCounts(params: {
  userId: string;
  timezone?: string | null;
  paidNormalImageCredits?: number;
}): Promise<ImageUsageCounts> {
  const db = getAdminDb();
  const usageDocId = getImageUsageDocId(new Date(), params.timezone);

  const usageRef = db
    .collection("users")
    .doc(params.userId)
    .collection("imageUsage")
    .doc(usageDocId);

  const usageSnapshot = await usageRef.get();

  if (!usageSnapshot.exists) {
    return {
      normalImagesToday: 0,
      spicyImagesToday: 0,
      paidNormalImageCredits: params.paidNormalImageCredits || 0,
    };
  }

  const usage = usageSnapshot.data() as ImageUsageRecord;

  return {
    normalImagesToday: usage.normalImagesToday || 0,
    spicyImagesToday: usage.spicyImagesToday || 0,
    paidNormalImageCredits: params.paidNormalImageCredits || 0,
  };
}

async function incrementImageUsageWithAdmin(params: {
  userId: string;
  timezone?: string | null;
  imageKind: ImageKind;
  shouldUsePaidNormalCredit: boolean;
}) {
  const db = getAdminDb();
  const usageDocId = getImageUsageDocId(new Date(), params.timezone);

  const usageRef = db
    .collection("users")
    .doc(params.userId)
    .collection("imageUsage")
    .doc(usageDocId);

  const userRef = db.collection("users").doc(params.userId);

  await usageRef.set(
    {
      date: usageDocId,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      normalImagesToday:
        params.imageKind === "normal"
          ? FieldValue.increment(1)
          : FieldValue.increment(0),
      spicyImagesToday:
        params.imageKind === "spicy"
          ? FieldValue.increment(1)
          : FieldValue.increment(0),
    },
    { merge: true }
  );

  if (params.shouldUsePaidNormalCredit) {
    await userRef.set(
      {
        paidNormalImageCredits: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
}

async function saveImageMessageWithAdmin(params: {
  userId: string;
  characterId: string;
  characterName: string;
  imageUrl: string;
  imagePrompt: string;
  imageKind: ImageKind;
  text: string;
}) {
  const db = getAdminDb();

  const conversationRef = db
    .collection("conversations")
    .doc(params.userId)
    .collection("characters")
    .doc(params.characterId);

  await conversationRef.set(
    {
      userId: params.userId,
      characterId: params.characterId,
      characterName: params.characterName,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await conversationRef.collection("messages").add({
    role: "assistant",
    type: "image",
    text: params.text,
    imageUrl: params.imageUrl,
    imagePrompt: params.imagePrompt,
    imageKind: params.imageKind,
    imageStatus: "complete",
    createdAt: FieldValue.serverTimestamp(),
  });

  await conversationRef.set(
    {
      updatedAt: FieldValue.serverTimestamp(),
      characterId: params.characterId,
      characterName: params.characterName,
    },
    { merge: true }
  );
}

async function requestImageFromModal(params: {
  userId: string;
  characterId: string;
  prompt: string;
}) {
  const endpoint = getImageGeneratorEndpoint();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      user_id: params.userId,
      character_id: params.characterId,
      prompt: params.prompt,
      style: "realistic",
    }),
  });

  const data = (await response.json()) as ImageGeneratorRawResponse;

  if (!response.ok) {
    throw new Error(data.error || "Image generator request failed.");
  }

  return normalizeImageGeneratorResponse(data, params.prompt);
}

async function requestImageFromFal(params: {
  characterId: string;
  characterName: string;
  prompt: string;
  imageKind: ImageKind;
  dailyImageProfile?: DailyImageProfile | null;
}) {
  const falKey = getFalKey();

  if (!falKey) {
    throw new Error("Missing FAL_KEY.");
  }

  fal.config({
    credentials: falKey,
  });

  const promptAttempts = [
    buildFalPrompt({
      characterId: params.characterId,
      characterName: params.characterName,
      userPrompt: params.prompt,
      imageKind: params.imageKind,
      dailyImageProfile: params.dailyImageProfile,
    }),
    buildFalRetryPrompt({
      characterId: params.characterId,
      characterName: params.characterName,
      userPrompt: params.prompt,
      imageKind: params.imageKind,
      dailyImageProfile: params.dailyImageProfile,
    }),
  ];

  const negativePrompt = getFalNegativePrompt({
    characterId: params.characterId,
    imageKind: params.imageKind,
    userPrompt: params.prompt,
  });

  const model = getFalModelForCharacter(params.characterId);
  const isLunaLora = params.characterId === "luna" && model === FAL_LORA_MODEL;

  let lastError: unknown = null;

  for (const falPrompt of promptAttempts) {
    try {
      let result;

      if (isLunaLora) {
        const input: FalLoraImageInput = {
          prompt: falPrompt,
          negative_prompt: negativePrompt,
          image_size: "portrait_4_3",
          num_inference_steps: 30,
          guidance_scale: 3.5,
          num_images: 1,
          loras: [
            {
              path: LUNA_FAL_LORA_URL,
              scale: 1,
            },
          ],
        };

        result = await fal.subscribe(FAL_LORA_MODEL, {
          input: input as any,
          logs: false,
        });
      } else {
        const input: FalImageInput = {
          prompt: falPrompt,
          negative_prompt: negativePrompt,
          image_size: "portrait_4_3",
          num_inference_steps: 30,
          guidance_scale: 3.5,
          num_images: 1,
        };

        result = await fal.subscribe(FAL_STANDARD_MODEL, {
          input: input as any,
          logs: false,
        });
      }

      const data = result.data as FalImageResult;
      const imageUrl = data.images?.[0]?.url;

      if (!imageUrl) {
        throw new Error("fal returned no image URL.");
      }

      return {
        ok: true,
        imageUrl,
        imagePrompt: data.prompt || falPrompt,
        characterId: params.characterId,
        status: "complete",
      } satisfies NormalizedImageGeneratorResponse;
    } catch (error) {
      lastError = error;
      console.warn("fal image attempt failed, trying fallback prompt:", error);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("fal image generation failed.");
}

async function requestImageFromRunpod(params: {
  characterId: string;
  characterName: string;
  prompt: string;
  imageKind: ImageKind;
}) {
  return requestRunpodComfyImage({
    characterId: params.characterId,
    characterName: params.characterName,
    userPrompt: params.prompt,
    imageKind: params.imageKind,
  });
}

async function requestImageFromRunpodNudeTemplate(params: {
  characterId: string;
  prompt: string;
}) {
  const baseUrl = getRunpodNudeTemplateApiUrl();

  if (!baseUrl) {
    throw new Error("Missing RUNPOD_NUDE_TEMPLATE_API_URL.");
  }

  const response = await fetch(`${baseUrl}/random-template-json`, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  const data = (await response.json()) as NudeTemplateApiResponse;

  if (!response.ok || !data.ok || !data.image_url) {
    throw new Error(
      data.error ||
        data.detail ||
        "RunPod nude template API returned no usable image."
    );
  }

  return {
    ok: true,
    imageUrl: data.image_url,
    imagePrompt: `RunPod nude template: ${
      data.filename || "random-template"
    }. User prompt: ${params.prompt}`,
    characterId: params.characterId,
    status: "complete",
    provider: "runpod-nude-template",
    imageModel: "runpod-nude-template",
  } satisfies NormalizedImageGeneratorResponse;
}

async function requestImage(params: {
  userId: string;
  characterId: string;
  characterName: string;
  prompt: string;
  imageKind: ImageKind;
  dailyImageProfile?: DailyImageProfile | null;
}): Promise<NormalizedImageGeneratorResponse> {
  const provider = getImageProvider();

  if (
    params.characterId === "luna" &&
    params.imageKind === "spicy" &&
    isNudeTemplateRequest(params.prompt)
  ) {
    return requestImageFromRunpodNudeTemplate({
      characterId: params.characterId,
      prompt: params.prompt,
    });
  }

  if (provider === "runpod") {
    const result = await requestImageFromRunpod({
      characterId: params.characterId,
      characterName: params.characterName,
      prompt: params.prompt,
      imageKind: params.imageKind,
    });

    return {
      ok: true,
      imageUrl: result.imageUrl,
      imagePrompt: result.imagePrompt,
      characterId: params.characterId,
      status: result.status || "complete",
    };
  }

  if (provider === "fal") {
    return requestImageFromFal({
      characterId: params.characterId,
      characterName: params.characterName,
      prompt: params.prompt,
      imageKind: params.imageKind,
      dailyImageProfile: params.dailyImageProfile,
    });
  }

  return requestImageFromModal({
    userId: params.userId,
    characterId: params.characterId,
    prompt: params.prompt,
  });
}

function getDataUrlByteLength(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");

  if (commaIndex === -1) {
    return 0;
  }

  const base64 = dataUrl.slice(commaIndex + 1).trim();

  if (!base64) {
    return 0;
  }

  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;

  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

async function validateGeneratedImageUrl(imageUrl: string) {
  const cleanImageUrl = imageUrl.trim();

  if (!cleanImageUrl) {
    throw new Error("Generated image URL was empty.");
  }

  if (cleanImageUrl.startsWith("data:image/")) {
    const byteLength = getDataUrlByteLength(cleanImageUrl);

    if (byteLength < MIN_VALID_IMAGE_BYTES) {
      throw new Error("Generated base64 image was too small.");
    }

    return;
  }

  const response = await fetch(cleanImageUrl, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(IMAGE_VALIDATION_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Generated image could not be loaded. Status: ${response.status}.`
    );
  }

  const contentType = (response.headers.get("content-type") || "").toLowerCase();

  if (!contentType.startsWith("image/")) {
    throw new Error("Generated image URL did not return an image file.");
  }

  const contentLengthHeader = response.headers.get("content-length");

  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);

    if (Number.isFinite(contentLength) && contentLength < MIN_VALID_IMAGE_BYTES) {
      throw new Error("Generated image file was too small.");
    }
  }
}

async function requestImageWithValidationRetry(params: {
  userId: string;
  characterId: string;
  characterName: string;
  prompt: string;
  imageKind: ImageKind;
  dailyImageProfile?: DailyImageProfile | null;
}): Promise<NormalizedImageGeneratorResponse> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= IMAGE_VALIDATION_RETRY_LIMIT; attempt += 1) {
    try {
      const imageResult = await requestImage(params);

      await validateGeneratedImageUrl(imageResult.imageUrl);

      return imageResult;
    } catch (error) {
      lastError = error;
      console.warn(
        `Generated image failed validation on attempt ${attempt + 1}:`,
        error
      );
    }
  }

  if (lastError instanceof Error) {
    throw new Error(`Image failed to generate properly. ${lastError.message}`);
  }

  throw new Error("Image failed to generate properly. Please try again.");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ImageGenerateRequestBody;
    const verifiedUser = await getVerifiedImageUser(request);

    const userId = verifiedUser.userId;
    const user = verifiedUser.user;

    if (isAgeAssuranceEnforced() && user.adultVerified !== true) {
      return NextResponse.json(
        { error: "Age Verification Is Required Before Requesting Images.", ageVerificationRequired: true },
        { status: 403 }
      );
    }

    const characterId = getSafeCharacterId(
      body.characterId || user.selectedCharacter || "luna"
    );
    const characterName = getCharacterNameFromId(characterId);
    const prompt = body.prompt?.trim() || "Send me a picture";
    const imageKind = detectImageKindFromPrompt(prompt);

    if (user.selectedCharacter && user.selectedCharacter !== characterId) {
      return NextResponse.json(
        {
          error: "This account is locked to a different companion.",
        },
        { status: 403 }
      );
    }

    const inputSafety = classifyContentSafety(prompt, {
      surface: "image_input",
      spicyContext: imageKind === "spicy",
    });
    if (!inputSafety.allowed) {
      await deleteProhibitedUserMessage({
        userId,
        characterId,
        messageId: body.userMessageId?.trim() || "",
        expectedText: prompt,
      });
      const safetyEvent = await recordProhibitedSafetyEvent({
        userId,
        category: inputSafety.category,
      });
      return NextResponse.json(
        {
          error: "This Image Request Is Not Available.",
          reply: getInCharacterSafetyReply({
            characterId,
            category: inputSafety.category,
          }),
          safetyBlocked: true,
          safetyCategory: inputSafety.category,
          showSafetyTerms: safetyEvent.restricted,
          spicyLockedUntil: safetyEvent.lockedUntil?.toISOString() || null,
          imageKind,
        },
        { status: 403 }
      );
    }

    const activeSafetyRestriction = getActiveSpicySafetyRestriction(user);
    if (imageKind === "spicy" && activeSafetyRestriction) {
      return NextResponse.json(
        {
          error: "Spicy Images Are Temporarily Locked.",
          reply: getInCharacterSafetyReply({
            characterId,
            restrictionActive: true,
          }),
          safetyBlocked: true,
          safetyRestrictionActive: true,
          showSafetyTerms: false,
          spicyLockedUntil: activeSafetyRestriction.toISOString(),
          imageKind,
        },
        { status: 403 }
      );
    }

    const usage = await getImageUsageCounts({
      userId,
      timezone: user.timezone,
      paidNormalImageCredits: user.paidNormalImageCredits || 0,
    });

    const entitlement = checkImageEntitlement({
      plan: user.plan,
      imageKind,
      usage,
    });

    if (!entitlement.allowed) {
      return NextResponse.json(
        {
          error: entitlement.reason,
          imageKind: entitlement.imageKind,
          plan: entitlement.plan,
          dailyLimit: entitlement.dailyLimit,
          remainingToday: entitlement.remainingToday,
          paidNormalImageCredits: entitlement.paidNormalImageCredits,
          upgradeRequired: entitlement.upgradeRequired || false,
          paymentRequired: entitlement.paymentRequired || false,
        },
        { status: 403 }
      );
    }

    const shouldUsePaidNormalCredit = entitlement.shouldUsePaidNormalCredit;

    const dailyImageProfile =
      imageKind === "normal"
        ? await getOrCreateDailyImageProfile({
            userId,
            characterId,
            timezone: user.timezone,
          })
        : null;

    const imageResult = await requestImageWithValidationRetry({
      userId,
      characterId,
      characterName,
      prompt,
      imageKind,
      dailyImageProfile,
    });

    const imageMessageText = await generateImageMessageText({
      characterId,
      characterName,
      userPrompt: prompt,
      imageKind,
    });

    await saveImageMessageWithAdmin({
      userId,
      characterId,
      characterName,
      imageUrl: imageResult.imageUrl,
      imagePrompt: imageResult.imagePrompt,
      imageKind,
      text: imageMessageText,
    });

    await incrementImageUsageWithAdmin({
      userId,
      timezone: user.timezone,
      imageKind,
      shouldUsePaidNormalCredit,
    });

    const provider = imageResult.provider || getImageProvider();

    return NextResponse.json({
      ok: true,
      imageUrl: imageResult.imageUrl,
      status: imageResult.status,
      provider,
      imageModel:
        imageResult.imageModel ||
        getImageModelLabel({
          provider,
          characterId,
        }),
      imageKind,
      plan: entitlement.plan,
      dailyLimit: entitlement.dailyLimit,
      remainingToday:
        entitlement.remainingToday === null
          ? null
          : Math.max(entitlement.remainingToday - 1, 0),
      paidNormalImageCreditsUsed: shouldUsePaidNormalCredit,
      text: imageMessageText,
      dailyImageProfile:
        dailyImageProfile && imageKind === "normal"
          ? {
              date: dailyImageProfile.date,
              casualOutfit: dailyImageProfile.casualOutfit,
              mirrorPhone: dailyImageProfile.mirrorPhone,
            }
          : null,
    });
  } catch (error) {
    console.error("API /api/images/generate error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown image generation error.";

    const status =
      message.includes("authentication token") ||
      message.includes("Firebase ID token")
        ? 401
        : message.includes("Authenticated user was not found")
        ? 404
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
