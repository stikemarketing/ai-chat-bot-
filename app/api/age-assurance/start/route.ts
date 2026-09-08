import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const [scheme, token] = (request.headers.get("authorization") || "").split(" ");
  return scheme === "Bearer" ? token?.trim() || "" : "";
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Authentication Is Required." }, { status: 401 });
    }

    await getAdminAuth().verifyIdToken(token);

    if (!process.env.AGECHECKED_API_KEY?.trim()) {
      return NextResponse.json(
        {
          error:
            "AgeChecked Is Not Connected Yet. Add The Merchant Credentials Before Enabling Live Age Verification.",
          setupRequired: true,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error:
          "AgeChecked Credentials Are Present, But The Approved Merchant Integration Details Still Need To Be Configured.",
        setupRequired: true,
      },
      { status: 503 }
    );
  } catch (error) {
    console.error("Age assurance start failed:", error);
    return NextResponse.json(
      { error: "The Private Age Check Could Not Be Started." },
      { status: 500 }
    );
  }
}
