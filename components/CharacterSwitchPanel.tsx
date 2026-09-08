"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth } from "@/firebase/config";
import { waitForFirebaseAuthUser } from "@/lib/user";

type CharacterSwitchStatus = {
  plan?: "free" | "pro" | "unlimited";
  eligible?: boolean;
  reason?: string;
  error?: string;
};

async function getFirebaseIdToken() {
  const firebaseUser = auth.currentUser || (await waitForFirebaseAuthUser());
  return firebaseUser ? firebaseUser.getIdToken() : "";
}

export default function CharacterSwitchPanel({
  source,
}: {
  source: "web" | "app";
}) {
  const [status, setStatus] = useState<CharacterSwitchStatus | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadStatus() {
      try {
        const token = await getFirebaseIdToken();

        if (!token) {
          return;
        }

        const response = await fetch("/api/character-switch", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await response.json()) as CharacterSwitchStatus;

        if (isActive) {
          setStatus(data);
        }
      } catch (error) {
        console.error("Failed to load character switch status:", error);
      }
    }

    void loadStatus();
    return () => {
      isActive = false;
    };
  }, []);

  if (!status?.plan) {
    return null;
  }

  const description =
    status.plan === "free"
      ? "Free accounts stay with their original companion. To choose another companion, create a separate account with a different email address."
      : status.plan === "pro"
      ? "Pro includes one character switch for the lifetime of the account. Switching permanently deletes your current chat and starts a completely fresh conversation."
      : "Unlimited includes one character switch per calendar month. Switching permanently deletes your current chat and starts a completely fresh conversation.";

  return (
    <section className="mb-8 rounded-[2rem] border border-[#c1123f]/10 bg-white/72 p-5 shadow-[0_20px_60px_rgba(111,0,23,0.05)] sm:p-6">
      <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#c1123f]">
        Character switching
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-black">
        Switch companion
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-black/65 sm:text-base">
        {description}
      </p>
      <p className="mt-3 text-sm font-semibold text-black/70">
        {status.reason}
      </p>

      {status.eligible ? (
        <Link
          href={`/characters?switch=1&source=${source}`}
          className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-[#b10f38] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#970d31]"
        >
          Choose a new companion
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-black/8 px-6 py-3 text-sm font-semibold text-black/40 disabled:cursor-not-allowed"
        >
          Switch locked
        </button>
      )}
    </section>
  );
}
