import { fal } from "@fal-ai/client";
import fs from "node:fs/promises";

const FAL_KEY = process.env.FAL_KEY;

if (!FAL_KEY) {
  throw new Error("Missing FAL_KEY in .env.local");
}

fal.config({
  credentials: FAL_KEY,
});

const LORA_URL =
  process.env.FAL_LUNA_LORA_URL ||
  "https://v3b.fal.media/files/b/0aa06d42/hocTMYLeOYlfn5xBR2V1w_pytorch_lora_weights.safetensors";

const prompt = [
  "realistic iPhone selfie photo",
  "fictional adult woman named Luna",
  "long dark brunette wavy hair",
  "warm hazel brown eyes",
  "soft natural smile",
  "minimal makeup",
  "natural skin texture",
  "cosy modern bedroom in the background",
  "soft window light",
  "casual white top",
  "real camera photo",
  "not glamour",
  "not stylised",
].join(", ");

async function downloadImage(url, outputPath) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
}

async function generateWithoutLora() {
  console.log("\nGenerating A: WITHOUT Luna LoRA...\n");

  const result = await fal.subscribe("fal-ai/flux/dev", {
    input: {
      prompt,
      image_size: "portrait_4_3",
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
    },
    logs: true,
  });

  const imageUrl = result.data?.images?.[0]?.url;

  if (!imageUrl) {
    throw new Error("No image URL returned for no-LoRA test.");
  }

  console.log("A without LoRA:");
  console.log(imageUrl);

  await downloadImage(imageUrl, "luna-a-without-lora.jpg");

  return imageUrl;
}

async function generateWithLora() {
  console.log("\nGenerating B: WITH Luna LoRA...\n");

  const result = await fal.subscribe("fal-ai/flux/dev", {
    input: {
      prompt: `pp_luna_character, ${prompt}`,
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
  });

  const imageUrl = result.data?.images?.[0]?.url;

  if (!imageUrl) {
    throw new Error("No image URL returned for LoRA test.");
  }

  console.log("B with LoRA:");
  console.log(imageUrl);

  await downloadImage(imageUrl, "luna-b-with-lora.jpg");

  return imageUrl;
}

const withoutLoraUrl = await generateWithoutLora();
const withLoraUrl = await generateWithLora();

console.log("\nDone.\n");
console.log("A without LoRA:");
console.log(withoutLoraUrl);
console.log("\nB with LoRA:");
console.log(withLoraUrl);
console.log("\nSaved files:");
console.log("luna-a-without-lora.jpg");
console.log("luna-b-with-lora.jpg");