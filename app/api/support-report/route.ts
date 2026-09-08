import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, getAdminStorageBucket } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

const SUPPORT_EMAIL = "digitalstrikesupport@gmail.com";
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const ALLOWED_SCREENSHOT_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const REPORT_TYPES = new Set([
  "prohibited-content",
  "copyright-or-likeness",
  "account-restriction",
  "technical-or-other",
]);
const REPORT_LOCATIONS = new Set([
  "chat",
  "image-generation",
  "account",
  "website",
  "other",
]);

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  let screenshotPath = "";

  try {
    const formData = await request.formData();
    const honeypot = getText(formData, "website");

    if (honeypot) {
      return NextResponse.json({ ok: true });
    }

    const name = getText(formData, "name");
    const email = getText(formData, "email").toLowerCase();
    const reportType = getText(formData, "reportType");
    const location = getText(formData, "location");
    const description = getText(formData, "description");
    const screenshot = formData.get("screenshot");

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json(
        { error: "Please Enter Your Name." },
        { status: 400 }
      );
    }

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { error: "Please Enter A Valid Email Address." },
        { status: 400 }
      );
    }

    if (!REPORT_TYPES.has(reportType) || !REPORT_LOCATIONS.has(location)) {
      return NextResponse.json(
        { error: "Please Select The Type And Location Of The Problem." },
        { status: 400 }
      );
    }

    if (description.length < 20 || description.length > 5000) {
      return NextResponse.json(
        { error: "Please Describe The Problem In 20 To 5,000 Characters." },
        { status: 400 }
      );
    }

    const reportId = randomUUID();

    if (screenshot instanceof File && screenshot.size > 0) {
      const extension = ALLOWED_SCREENSHOT_TYPES.get(screenshot.type);

      if (!extension || screenshot.size > MAX_SCREENSHOT_BYTES) {
        return NextResponse.json(
          { error: "Screenshots Must Be JPG, PNG, Or WebP And No Larger Than 5 MB." },
          { status: 400 }
        );
      }

      screenshotPath = `support-reports/${reportId}/screenshot.${extension}`;
      const file = getAdminStorageBucket().file(screenshotPath);
      await file.save(Buffer.from(await screenshot.arrayBuffer()), {
        resumable: false,
        metadata: {
          contentType: screenshot.type,
          cacheControl: "private, no-store, max-age=0",
          metadata: {
            supportReportId: reportId,
          },
        },
      });
    }

    await getAdminDb().collection("supportReports").doc(reportId).set({
      name,
      email,
      reportType,
      location,
      description,
      screenshotPath: screenshotPath || null,
      supportDestination: SUPPORT_EMAIL,
      status: "received",
      emailDeliveryStatus: "not-connected",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, reportId });
  } catch (error) {
    console.error("Support report submission failed:", error);

    if (screenshotPath) {
      try {
        await getAdminStorageBucket().file(screenshotPath).delete({ ignoreNotFound: true });
      } catch (cleanupError) {
        console.error("Support screenshot cleanup failed:", cleanupError);
      }
    }

    return NextResponse.json(
      { error: "The Report Could Not Be Submitted. Please Try Again." },
      { status: 500 }
    );
  }
}
