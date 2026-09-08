import { fal } from "@fal-ai/client";

const FAL_KEY = process.env.FAL_KEY;

if (!FAL_KEY) {
  throw new Error("Missing FAL_KEY in .env.local");
}

fal.config({
  credentials: FAL_KEY,
});

const result = await fal.subscribe("fal-ai/flux-lora-fast-training", {
  input: {
    images_data_url:
      "https://v3b.fal.media/files/b/0aa06cf5/EsAmCgrdL_sIoP0vUaWQk_luna-fal-selected.zip",
    trigger_word: "pp_luna_character",
    is_style: false,
    steps: 1000,
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

console.log("\nTraining complete:\n");
console.log(JSON.stringify(result, null, 2));