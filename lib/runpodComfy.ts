type ComfyWorkflowNode = {
  inputs?: Record<string, unknown>;
  class_type?: string;
  _meta?: {
    title?: string;
  };
};

type ComfyWorkflow = Record<string, ComfyWorkflowNode>;

type ComfyPromptResponse = {
  prompt_id?: string;
  number?: number;
  node_errors?: Record<string, unknown>;
};

type ComfyHistoryImage = {
  filename?: string;
  subfolder?: string;
  type?: string;
};

type ComfyHistoryOutput = {
  images?: ComfyHistoryImage[];
};

type ComfyHistoryItem = {
  outputs?: Record<string, ComfyHistoryOutput>;
  status?: {
    status_str?: string;
    completed?: boolean;
    messages?: unknown[];
  };
};

type ComfyHistoryResponse = Record<string, ComfyHistoryItem>;

type RunpodComfyImageKind = "normal" | "spicy";

type RequestRunpodComfyImageParams = {
  characterId: string;
  characterName: string;
  userPrompt: string;
  imageKind: RunpodComfyImageKind;
};

export type RunpodComfyImageResult = {
  ok: true;
  imageUrl: string;
  imagePrompt: string;
  status: "complete";
};

const DEFAULT_CHECKPOINT = "juggernaut_xl_v9.safetensors";
const DEFAULT_WIDTH = 768;
const DEFAULT_HEIGHT = 1224;
const DEFAULT_STEPS = 20;
const DEFAULT_CFG = 6;
const DEFAULT_TIMEOUT_MS = 240_000;

function getRunpodComfyUrl() {
  const url = process.env.RUNPOD_COMFY_URL?.trim();

  if (!url) {
    throw new Error("Missing RUNPOD_COMFY_URL.");
  }

  return url.replace(/\/$/, "");
}

function getRunpodComfyCheckpoint() {
  return process.env.RUNPOD_COMFY_CHECKPOINT?.trim() || DEFAULT_CHECKPOINT;
}

function getRunpodComfyTimeoutMs() {
  const rawTimeout = process.env.RUNPOD_COMFY_TIMEOUT_MS?.trim();

  if (!rawTimeout) {
    return DEFAULT_TIMEOUT_MS;
  }

  const timeout = Number(rawTimeout);

  if (!Number.isFinite(timeout) || timeout < 30_000) {
    return DEFAULT_TIMEOUT_MS;
  }

  return timeout;
}

function getCharacterIdentity(characterId: string, characterName: string) {
  if (characterId === "ivy") {
    return [
      `one fictional 27-year-old adult woman named ${characterName}`,
      "polished blonde hair",
      "elegant feminine features",
      "confident calm expression",
      "slim toned adult body",
      "premium editorial beauty",
    ].join(", ");
  }

  if (characterId === "sienna") {
    return [
      `one fictional 27-year-old adult woman named ${characterName}`,
      "soft auburn brown hair",
      "warm passionate expression",
      "feminine curvy adult build",
      "romantic premium beauty",
    ].join(", ");
  }

  return [
    `one fictional 27-year-old adult woman named ${characterName}`,
    "long wavy dark brunette hair",
    "warm brown eyes",
    "soft feminine features",
    "slim softly curvy adult figure",
    "natural makeup",
  ].join(", ");
}

function cleanPrompt(prompt: string) {
  return prompt.trim().replace(/\s+/g, " ");
}

function containsAny(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function isNudeRequest(prompt: string) {
  return containsAny(prompt, [
    "nude",
    "naked",
    "fully naked",
    "fully nude",
    "topless",
    "bare",
    "unclothed",
    "without clothes",
    "no clothes",
    "nothing on",
    "show everything",
    "show her body",
    "nsfw",
  ]);
}

function isFullNudeRequest(prompt: string) {
  return containsAny(prompt, [
    "fully nude",
    "fully naked",
    "completely nude",
    "completely naked",
    "show everything",
    "nothing on",
    "no clothes",
    "completely bare",
  ]);
}

function buildSharedQualityPrompt() {
  return [
    "photorealistic",
    "realistic skin texture",
    "natural anatomy",
    "natural hands",
    "highly detailed",
    "cinematic lighting",
    "professional photography",
    "luxury bedroom setting",
    "soft warm indoor lighting",
    "one woman only",
    "fictional adult subject",
  ].join(", ");
}

function buildRunpodPositivePrompt(params: RequestRunpodComfyImageParams) {
  const identity = getCharacterIdentity(params.characterId, params.characterName);
  const userPrompt = cleanPrompt(params.userPrompt);
  const sharedQuality = buildSharedQualityPrompt();

  if (params.imageKind === "spicy" && isNudeRequest(userPrompt)) {
    const fullNude = isFullNudeRequest(userPrompt);

    return [
      `photorealistic adult glamour image of ${identity}`,
      fullNude
        ? "completely nude adult woman"
        : "topless or nude adult woman",
      "clearly visible uncovered breasts",
      "visible nipples",
      fullNude
        ? "fully unclothed body, no clothing at all"
        : "minimal or no clothing, chest clearly uncovered",
      "sexy adult pose",
      "seductive eye contact",
      "erotic premium glamour scene",
      "full body or three-quarter body composition",
      "not cropped above the chest",
      "clearly visible adult body",
      sharedQuality,
      `user request: ${userPrompt}`,
    ].join(", ");
  }

  if (params.imageKind === "spicy") {
    return [
      `photorealistic adult glamour image of ${identity}`,
      "wearing revealing black lace lingerie",
      "visible cleavage",
      "sexy adult pose",
      "seductive expression",
      "premium erotic glamour styling",
      "full body or three-quarter body composition",
      sharedQuality,
      `user request: ${userPrompt}`,
    ].join(", ");
  }

  return [
    `beautiful photorealistic image of ${identity}`,
    "cute warm girlfriend selfie",
    "wearing a flattering outfit",
    "soft romantic expression",
    "modern bedroom setting",
    "elegant feminine styling",
    sharedQuality,
    `user request: ${userPrompt}`,
  ].join(", ");
}

function buildRunpodNegativePrompt(params: {
  imageKind: RunpodComfyImageKind;
  userPrompt: string;
}) {
  const sharedNegative = [
    "text",
    "watermark",
    "logo",
    "signature",
    "blurry",
    "low quality",
    "bad anatomy",
    "deformed anatomy",
    "deformed hands",
    "extra fingers",
    "missing fingers",
    "extra limbs",
    "distorted face",
    "crossed eyes",
    "multiple people",
    "two women",
    "man",
    "child",
    "teen",
    "young",
    "underage",
    "cartoon",
    "anime",
    "illustration",
    "cgi",
    "3d render",
  ];

  if (params.imageKind === "spicy" && isNudeRequest(params.userPrompt)) {
    return [
      ...sharedNegative,
      "bra",
      "bikini top",
      "bikini",
      "lingerie covering breasts",
      "shirt",
      "dress",
      "robe",
      "sweater",
      "cardigan",
      "jacket",
      "bodysuit",
      "underwear covering chest",
      "covered chest",
      "covered breasts",
      "covered nipples",
      "clothed",
      "fully clothed",
      "nude colored top",
      "beige top",
      "cream top",
      "wrap top",
      "off shoulder top",
      "strategic covering",
      "arms covering breasts",
      "hands covering breasts",
      "sheet covering breasts",
      "blanket covering body",
      "cropped chest",
      "close-up portrait only",
    ].join(", ");
  }

  if (params.imageKind === "spicy") {
    return [
      ...sharedNegative,
      "boring outfit",
      "plain t-shirt",
      "sweater",
      "covered body",
      "fully clothed",
    ].join(", ");
  }

  return sharedNegative.join(", ");
}

function createSimpleComfyWorkflow(params: {
  checkpointName: string;
  positivePrompt: string;
  negativePrompt: string;
}) {
  return {
    "3": {
      inputs: {
        seed: Math.floor(Math.random() * 999_999_999_999_999),
        steps: DEFAULT_STEPS,
        cfg: DEFAULT_CFG,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
      class_type: "KSampler",
      _meta: {
        title: "KSampler",
      },
    },
    "4": {
      inputs: {
        ckpt_name: params.checkpointName,
      },
      class_type: "CheckpointLoaderSimple",
      _meta: {
        title: "Load Checkpoint",
      },
    },
    "5": {
      inputs: {
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        batch_size: 1,
      },
      class_type: "EmptyLatentImage",
      _meta: {
        title: "Empty Latent Image",
      },
    },
    "6": {
      inputs: {
        text: params.positivePrompt,
        clip: ["4", 1],
      },
      class_type: "CLIPTextEncode",
      _meta: {
        title: "Positive Prompt",
      },
    },
    "7": {
      inputs: {
        text: params.negativePrompt,
        clip: ["4", 1],
      },
      class_type: "CLIPTextEncode",
      _meta: {
        title: "Negative Prompt",
      },
    },
    "8": {
      inputs: {
        samples: ["3", 0],
        vae: ["4", 2],
      },
      class_type: "VAEDecode",
      _meta: {
        title: "VAE Decode",
      },
    },
    "9": {
      inputs: {
        filename_prefix: "ai_companion_runpod",
        images: ["8", 0],
      },
      class_type: "SaveImage",
      _meta: {
        title: "Save Image",
      },
    },
  } satisfies ComfyWorkflow;
}

async function comfyFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const serverUrl = getRunpodComfyUrl();

  const response = await fetch(`${serverUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Origin: serverUrl,
      Referer: `${serverUrl}/`,
      "User-Agent": "AI Companion RunPod ComfyUI",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(
      `ComfyUI request failed: ${response.status} ${response.statusText} ${rawText}`
    );
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new Error(`ComfyUI returned non-JSON response: ${rawText}`);
  }
}

async function queueComfyPrompt(workflow: ComfyWorkflow) {
  const data = await comfyFetchJson<ComfyPromptResponse>("/prompt", {
    method: "POST",
    body: JSON.stringify({
      prompt: workflow,
      client_id: crypto.randomUUID(),
    }),
  });

  if (!data.prompt_id) {
    throw new Error(
      `ComfyUI did not return a prompt_id: ${JSON.stringify(data)}`
    );
  }

  return data.prompt_id;
}

async function waitForComfyHistory(promptId: string) {
  const timeoutMs = getRunpodComfyTimeoutMs();
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const history = await comfyFetchJson<ComfyHistoryResponse>(
      `/history/${promptId}`,
      {
        method: "GET",
      }
    );

    const historyItem = history[promptId];

    if (historyItem) {
      return historyItem;
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error(`Timed out waiting for ComfyUI prompt result: ${promptId}`);
}

function getFirstImageFromHistory(historyItem: ComfyHistoryItem) {
  const outputs = historyItem.outputs;

  if (!outputs) {
    throw new Error("ComfyUI history returned no outputs.");
  }

  for (const output of Object.values(outputs)) {
    if (!output?.images?.length) {
      continue;
    }

    const image = output.images.find((item) => item.filename);

    if (image?.filename) {
      return image;
    }
  }

  throw new Error("ComfyUI history returned no image.");
}

function buildComfyViewUrl(image: ComfyHistoryImage) {
  const serverUrl = getRunpodComfyUrl();

  const searchParams = new URLSearchParams({
    filename: image.filename || "",
    subfolder: image.subfolder || "",
    type: image.type || "output",
  });

  return `${serverUrl}/view?${searchParams.toString()}`;
}

export async function requestRunpodComfyImage(
  params: RequestRunpodComfyImageParams
): Promise<RunpodComfyImageResult> {
  const positivePrompt = buildRunpodPositivePrompt(params);
  const negativePrompt = buildRunpodNegativePrompt({
    imageKind: params.imageKind,
    userPrompt: params.userPrompt,
  });

  const workflow = createSimpleComfyWorkflow({
    checkpointName: getRunpodComfyCheckpoint(),
    positivePrompt,
    negativePrompt,
  });

  const promptId = await queueComfyPrompt(workflow);
  const historyItem = await waitForComfyHistory(promptId);
  const image = getFirstImageFromHistory(historyItem);
  const imageUrl = buildComfyViewUrl(image);

  return {
    ok: true,
    imageUrl,
    imagePrompt: positivePrompt,
    status: "complete",
  };
}