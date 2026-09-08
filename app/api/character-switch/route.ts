import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { normalizePlan, type AppPlan } from "@/lib/plans";

const CHARACTER_IDS = ["luna", "ivy", "sienna"] as const;
type CharacterId = (typeof CHARACTER_IDS)[number];

type SwitchUser = {
  plan?: string;
  timezone?: string;
  selectedCharacter?: string;
  characterSwitchCount?: number;
  lastCharacterSwitchMonth?: string;
};

type SwitchRequestBody = {
  characterId?: string;
  confirmPermanentDeletion?: boolean;
};

function getBearerToken(request: NextRequest) {
  const authorizationHeader = request.headers.get("authorization") || "";
  const [scheme, token] = authorizationHeader.split(" ");
  return scheme === "Bearer" && token?.trim() ? token.trim() : "";
}

function getCharacterId(value: unknown): CharacterId | null {
  return CHARACTER_IDS.includes(value as CharacterId)
    ? (value as CharacterId)
    : null;
}

function getSafeTimezone(value: unknown) {
  const timezone = typeof value === "string" && value.trim() ? value : "UTC";

  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "UTC";
  }
}

function getCalendarMonth(date: Date, timezoneValue: unknown) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: getSafeTimezone(timezoneValue),
    year: "numeric",
    month: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "00";
  return `${year}-${month}`;
}

function getNextMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, month, 1));
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(nextMonth);
}

function getEligibility(user: SwitchUser, now = new Date()) {
  const plan = normalizePlan(user.plan);
  const switchCount = Math.max(user.characterSwitchCount || 0, 0);
  const currentMonth = getCalendarMonth(now, user.timezone);

  if (plan === "free") {
    return {
      plan,
      eligible: false,
      reason: "Character switching is not included on Free.",
      nextAvailableLabel: null,
    };
  }

  if (plan === "pro") {
    const eligible = switchCount === 0;
    return {
      plan,
      eligible,
      reason: eligible
        ? "Your one-time Pro character switch is available."
        : "Your one-time Pro character switch has already been used.",
      nextAvailableLabel: null,
    };
  }

  const eligible = user.lastCharacterSwitchMonth !== currentMonth;
  return {
    plan,
    eligible,
    reason: eligible
      ? "Your Unlimited character switch is available this month."
      : `Your next Unlimited character switch is available in ${getNextMonthLabel(
          currentMonth
        )}.`,
    nextAvailableLabel: eligible ? null : getNextMonthLabel(currentMonth),
  };
}

async function getVerifiedUser(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    throw new Error("Missing Firebase authentication token.");
  }

  const decodedToken = await getAdminAuth().verifyIdToken(token);
  const userRef = getAdminDb().collection("users").doc(decodedToken.uid);
  const snapshot = await userRef.get();

  if (!snapshot.exists) {
    throw new Error("Authenticated user account was not found.");
  }

  return {
    userId: decodedToken.uid,
    userRef,
    user: snapshot.data() as SwitchUser,
  };
}

async function deleteConversation(userId: string, characterId: CharacterId) {
  const db = getAdminDb();
  const conversationRef = db
    .collection("conversations")
    .doc(userId)
    .collection("characters")
    .doc(characterId);

  await db.recursiveDelete(conversationRef);
}

function getErrorStatus(message: string) {
  if (message.includes("authentication token") || message.includes("ID token")) {
    return 401;
  }

  if (message.includes("not found")) {
    return 404;
  }

  return 500;
}

export async function GET(request: NextRequest) {
  try {
    const verified = await getVerifiedUser(request);
    const selectedCharacter = getCharacterId(verified.user.selectedCharacter);

    return NextResponse.json({
      ...getEligibility(verified.user),
      selectedCharacter,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not check character switching.";
    return NextResponse.json({ error: message }, { status: getErrorStatus(message) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const verified = await getVerifiedUser(request);
    const body = (await request.json()) as SwitchRequestBody;
    const newCharacter = getCharacterId(body.characterId);

    if (!newCharacter) {
      return NextResponse.json(
        { error: "Choose Luna, Ivy, or Sienna." },
        { status: 400 }
      );
    }

    if (body.confirmPermanentDeletion !== true) {
      return NextResponse.json(
        { error: "Confirm that the current chat will be permanently deleted." },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    let oldCharacter: CharacterId | null = null;
    let finalPlan: AppPlan = "free";

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(verified.userRef);
      const user = snapshot.data() as SwitchUser;
      const currentCharacter = getCharacterId(user.selectedCharacter);
      const eligibility = getEligibility(user);

      if (!currentCharacter) {
        throw new Error("The account does not have a valid current companion.");
      }

      if (currentCharacter === newCharacter) {
        throw new Error("Choose a different companion before switching.");
      }

      if (!eligibility.eligible) {
        throw new Error(eligibility.reason);
      }

      oldCharacter = currentCharacter;
      finalPlan = eligibility.plan;

      transaction.set(
        verified.userRef,
        {
          selectedCharacter: newCharacter,
          goodMorningCharacterId: newCharacter,
          characterSwitchCount: FieldValue.increment(1),
          lastCharacterSwitchAt: Timestamp.now(),
          lastCharacterSwitchMonth: getCalendarMonth(new Date(), user.timezone),
          previousCharacter: currentCharacter,
          relationshipMemory: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    if (!oldCharacter) {
      throw new Error("The previous companion could not be identified.");
    }

    await deleteConversation(verified.userId, oldCharacter);

    return NextResponse.json({
      ok: true,
      plan: finalPlan,
      selectedCharacter: newCharacter,
      deletedCharacter: oldCharacter,
      conversationDeleted: true,
    });
  } catch (error) {
    console.error("Failed to switch character:", error);
    const message =
      error instanceof Error ? error.message : "Could not switch character.";
    const knownConflict =
      message.includes("already been used") ||
      message.includes("available in") ||
      message.includes("not included") ||
      message.includes("different companion");
    return NextResponse.json(
      { error: message },
      { status: knownConflict ? 409 : getErrorStatus(message) }
    );
  }
}
