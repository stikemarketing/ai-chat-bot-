import { fal } from "@fal-ai/client";

const FAL_KEY = process.env.FAL_KEY;

if (!FAL_KEY) {
  throw new Error("Missing FAL_KEY in .env.local");
}

fal.config({
  credentials: FAL_KEY,
});

const LORA_URL =
  "https://v3b.fal.media/files/b/0aa06d42/hocTMYLeOYlfn5xBR2V1w_pytorch_lora_weights.safetensors";

const result = await fal.subscribe("fal-ai/flux/dev", {
  input: {
    prompt:
      "a realistic phone selfie of Luna, dark brunette wavy hair, warm hazel eyes, soft romantic smile, cream cardigan, cosy bedroom, natural light, high detail, realistic photography",
    image_size: "portrait_4_3",
    num_inference_steps: 28,
    guidance_scale: 3.5,
    num_images: 1,
    loras: [
      {
        path: LORA_URL,
        scale: 1,
      },
    ],
  },
  logs: true,
  onQueueUpdate(update) {
    if (update.status === "IN_PROGRESS" && update.logs) {
      for (const log of update.logs) {
        console.log(log.message);
      }
    }
  },
});

console.log("\nResult:\n");
console.log(JSON.stringify(result.data, null, 2));

const imageUrl = result?.data?.images?.[0]?.url;

if (imageUrl) {
  console.log("\nGenerated image URL:");
  console.log(imageUrl);
} else {
  console.log("\nNo image URL returned.");
}