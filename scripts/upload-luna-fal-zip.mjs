import { readFile } from "node:fs/promises";
import { fal } from "@fal-ai/client";

const FAL_KEY = process.env.FAL_KEY;

if (!FAL_KEY) {
  throw new Error("Missing FAL_KEY in .env.local");
}

fal.config({
  credentials: FAL_KEY,
});

const zipPath =
  "/Users/daniellesmith/ai-companion-image-generator/training-data/luna-fal-selected.zip";

const zipBytes = await readFile(zipPath);

const zipFile = new File([zipBytes], "luna-fal-selected.zip", {
  type: "application/zip",
});

console.log("Uploading luna-fal-selected.zip to fal...");

const fileUrl = await fal.storage.upload(zipFile);

console.log("");
console.log("Upload complete:");
console.log(fileUrl);
console.log("");