import { fal } from "@fal-ai/client";
import fs from "fs";

fal.config({
  credentials: process.env.FAL_KEY,
});

const result = await fal.subscribe("fal-ai/flux-pro/kontext/text-to-image", {
  input: {
    prompt:
      "realistic premium dating app selfie of a fictional adult woman named Luna, long dark brunette wavy hair, warm hazel brown eyes, soft romantic smile, tan olive skin, cream cardigan, cosy bedroom, natural window light, elegant and tasteful",
    aspect_ratio: "2:3",
    output_format: "jpeg",
  },
});

console.log("fal result:");
console.log(JSON.stringify(result, null, 2));

const imageUrl = result.data?.images?.[0]?.url;

if (!imageUrl) {
  throw new Error("No image URL returned from fal.");
}

const imageResponse = await fetch(imageUrl);
const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

fs.writeFileSync("fal-luna-test.jpg", imageBuffer);

console.log("Saved image to fal-luna-test.jpg");