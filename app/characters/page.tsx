// app/characters/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { characters } from "@/lib/characters";
import { auth } from "@/firebase/config";
import {
  getUserWithFirestoreFallback,
  saveUser,
  waitForFirebaseAuthUser,
  type StoredUser,
} from "@/lib/user";
import { normalizePlan } from "@/lib/plans";

const characterImages: Record<string, string> = {
  luna: "/companions/luna-main.png",
  ivy: "/companions/ivy-main.png",
  sienna: "/companions/sienna-main.png",
};

type CharacterSwitchStatus = {
  eligible?: boolean;
  reason?: string;
  error?: string;
};

type CharacterSwitchResponse = {
  ok?: boolean;
  selectedCharacter?: string;
  error?: string;
};

async function getFirebaseIdToken() {
  const firebaseUser = auth.currentUser || (await waitForFirebaseAuthUser());
  return firebaseUser ? firebaseUser.getIdToken() : "";
}

function getPlanLabel(plan: string | null | undefined) {
  const safePlan = normalizePlan(plan);

  if (safePlan === "unlimited") {
    return "Unlimited";
  }

  if (safePlan === "pro") {
    return "Pro";
  }

  return "Free";
}

export default function CharactersPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isSwitchMode, setIsSwitchMode] = useState(false);
  const [switchSource, setSwitchSource] = useState<"web" | "app">("web");
  const [switchStatus, setSwitchStatus] =
    useState<CharacterSwitchStatus | null>(null);
  const [pendingSwitchCharacterId, setPendingSwitchCharacterId] = useState("");
  const [switchingToCharacter, setSwitchingToCharacter] = useState("");
  const [switchError, setSwitchError] = useState("");

  useEffect(() => {
    async function loadUser() {
      try {
        setMounted(true);

        const savedUser = await getUserWithFirestoreFallback();
        setUser(savedUser);

        const params = new URLSearchParams(window.location.search);
        const switchMode = params.get("switch") === "1";
        const source = params.get("source") === "app" ? "app" : "web";
        setIsSwitchMode(switchMode);
        setSwitchSource(source);

        if (switchMode && savedUser?.id) {
          const token = await getFirebaseIdToken();
          const response = await fetch("/api/character-switch", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = (await response.json()) as CharacterSwitchStatus;
          setSwitchStatus(data);
        }
      } catch (error) {
        console.error("Failed to load saved user on characters page:", error);
      } finally {
        setIsLoadingUser(false);
      }
    }

    loadUser();
  }, []);

  function openSwitchConfirmation(characterId: string) {
    setSwitchError("");
    setPendingSwitchCharacterId(characterId);
  }

  async function handleCharacterSwitch() {
    if (
      !user?.id ||
      !switchStatus?.eligible ||
      !pendingSwitchCharacterId
    ) {
      return;
    }

    const characterId = pendingSwitchCharacterId;

    try {
      setSwitchingToCharacter(characterId);
      setSwitchError("");
      const token = await getFirebaseIdToken();

      if (!token) {
        throw new Error("Please sign in again before switching companion.");
      }

      const response = await fetch("/api/character-switch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          characterId,
          confirmPermanentDeletion: true,
        }),
      });
      const data = (await response.json()) as CharacterSwitchResponse;

      if (!response.ok || !data.ok || !data.selectedCharacter) {
        throw new Error(data.error || "Could not switch companion.");
      }

      const updatedUser = {
        ...user,
        selectedCharacter: data.selectedCharacter,
        goodMorningCharacterId: data.selectedCharacter,
      };
      saveUser(updatedUser);
      setUser(updatedUser);

      router.replace(
        switchSource === "app"
          ? `/app/chat/${data.selectedCharacter}`
          : `/chat/${data.selectedCharacter}`
      );
    } catch (error) {
      console.error("Failed to switch companion:", error);
      setSwitchError(
        error instanceof Error ? error.message : "Could not switch companion."
      );
    } finally {
      setSwitchingToCharacter("");
    }
  }

  const activeCharacter = useMemo(() => {
    if (!user?.selectedCharacter) {
      return null;
    }

    return (
      characters.find((character) => character.id === user.selectedCharacter) ??
      null
    );
  }, [user]);

  return (
    <main className="min-h-screen bg-[#f7eeee] px-4 py-6 text-[#111111] sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-7xl">
        <section className="rounded-[2rem] border border-[#c1123f]/10 bg-white/72 px-5 py-7 shadow-[0_20px_60px_rgba(111,0,23,0.05)] sm:px-8 sm:py-9">
          <div className="max-w-3xl space-y-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#c1123f] sm:text-[13px]">
              Choose your companion
            </p>

            <h1 className="text-4xl font-semibold tracking-[-0.04em] text-black sm:text-5xl">
              Curated companions with distinct personality
            </h1>

            <p className="max-w-2xl text-base leading-8 text-black/65 sm:text-lg">
              Browse a smaller, more intentional collection of companions with
              distinct chemistry, tone, and conversation style.
            </p>

            {mounted && isLoadingUser ? (
              <div className="rounded-[1.5rem] border border-[#c1123f]/8 bg-[#fff8f8] px-5 py-4 text-sm leading-7 text-black/60">
                Checking your saved account...
              </div>
            ) : null}

            {mounted && !isLoadingUser && user && activeCharacter ? (
              <div className="rounded-[1.5rem] border border-[#c1123f]/8 bg-[#fff8f8] px-5 py-4 text-sm leading-7 text-black/70">
                <p>
                  You are currently chatting with{" "}
                  <span className="font-semibold text-black">
                    {activeCharacter.name}
                  </span>
                  . Your current plan is{" "}
                  <span className="font-semibold text-black">
                    {getPlanLabel(user.plan)}
                  </span>
                  .
                </p>

                <p className="mt-2">
                  For now, each account is locked to one active companion.
                </p>
              </div>
            ) : null}

            {isSwitchMode && user ? (
              <div className="rounded-[1.5rem] border border-[#c1123f]/18 bg-[#fff1f4] px-5 py-4 text-sm leading-7 text-[#8f0d2f]">
                <p className="font-semibold">Choose your new companion carefully.</p>
                <p className="mt-2">
                  Confirming a switch permanently deletes your complete current
                  conversation and its image records. Your new chat starts empty,
                  and the change cannot be undone.
                </p>
                {switchStatus?.reason ? (
                  <p className="mt-2 font-semibold">{switchStatus.reason}</p>
                ) : null}
                {switchError ? (
                  <p className="mt-2 font-semibold">{switchError}</p>
                ) : null}

                <Link
                  href={
                    switchSource === "app"
                      ? `/app/chat/${user.selectedCharacter}`
                      : `/chat/${user.selectedCharacter}`
                  }
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-[#c1123f]/18 bg-white px-5 py-2 text-sm font-semibold text-[#8f0d2f] transition hover:bg-[#fff9fa]"
                >
                  Back to chat
                </Link>
              </div>
            ) : null}
          </div>
        </section>

        <section className="pt-6 sm:pt-8">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {characters.map((character) => {
              const imageSrc =
                characterImages[character.id] ?? "/companions/luna-main.png";

              const hasSavedUser = Boolean(user?.id);
              const isActiveCharacter =
                hasSavedUser && user?.selectedCharacter === character.id;
              const isLockedCharacter =
                hasSavedUser && user?.selectedCharacter !== character.id;

              const href = isActiveCharacter
                ? `/chat/${character.id}`
                : isLockedCharacter
                  ? `/chat/${user?.selectedCharacter}`
                  : `/signup?character=${character.id}`;

              const buttonText = isActiveCharacter
                ? "Continue chat"
                : isLockedCharacter
                  ? "Locked"
                  : "Start chatting";

              return (
                <article
                  key={character.id}
                  className={`overflow-hidden rounded-[2rem] border bg-white shadow-[0_12px_36px_rgba(0,0,0,0.04)] ${
                    isActiveCharacter
                      ? "border-[#c1123f]/25"
                      : "border-[#c1123f]/8"
                  }`}
                >
                  <div className="relative aspect-[4/4.8] w-full overflow-hidden">
                    <Image
                      src={imageSrc}
                      alt={character.name}
                      fill
                      className={`object-cover ${
                        isLockedCharacter ? "opacity-70" : ""
                      }`}
                      sizes="(max-width: 1024px) 100vw, 33vw"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/18 to-transparent" />

                    <div className="absolute left-4 top-4">
                      <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-black shadow-sm backdrop-blur">
                        {isActiveCharacter
                          ? "Active"
                          : isLockedCharacter
                            ? "Locked"
                            : character.mood}
                      </span>
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                      <h2 className="text-3xl font-semibold tracking-[-0.03em] text-white">
                        {character.name}, {character.age}
                      </h2>
                    </div>
                  </div>

                  <div className="space-y-4 p-5 sm:p-6">
                    <p className="text-base leading-7 text-black/72">
                      {character.bio}
                    </p>

                    <div className="rounded-[1.35rem] bg-[#f9f2f3] p-4">
                      <p className="text-[15px] leading-7 text-black/62">
                        {isSwitchMode && isActiveCharacter
                          ? `${character.name} is your current companion. Choose a different companion below to use your available switch.`
                          : isSwitchMode
                          ? `Switching to ${character.name} permanently deletes your current chat and starts a new empty conversation.`
                          : isActiveCharacter
                          ? `${character.name} is your active companion. Continue your saved private conversation.`
                          : isLockedCharacter
                            ? `This browser is already locked to ${
                                activeCharacter?.name ||
                                user?.selectedCharacter ||
                                "another companion"
                              }. Reset user only if you intentionally want to test a fresh account.`
                            : `Start with ${character.name} to unlock a private, more personal conversation flow built around her energy and style.`}
                      </p>
                    </div>

                    {isSwitchMode ? (
                      <button
                        type="button"
                        onClick={() => openSwitchConfirmation(character.id)}
                        disabled={
                          isActiveCharacter ||
                          !switchStatus?.eligible ||
                          Boolean(switchingToCharacter)
                        }
                        className={`inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 py-3 font-semibold transition disabled:cursor-not-allowed ${
                          isActiveCharacter || !switchStatus?.eligible
                            ? "border border-black/10 bg-black/5 text-black/40"
                            : "bg-[#b10f38] text-white hover:bg-[#970d31] disabled:bg-black/20"
                        }`}
                      >
                        {switchingToCharacter === character.id
                          ? "Switching..."
                          : isActiveCharacter
                          ? "Current companion"
                          : switchStatus?.eligible
                          ? `Switch to ${character.name}`
                          : "Switch locked"}
                      </button>
                    ) : (
                      <Link
                        href={href}
                        className={`inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 py-3 font-semibold transition ${
                          isLockedCharacter
                            ? "border border-[#c1123f]/14 bg-white text-black hover:border-[#c1123f]/25 hover:bg-[#fff7f8]"
                            : "bg-[#b10f38] hover:bg-[#970d31]"
                        }`}
                      >
                        <span
                          className={`text-base ${
                            isLockedCharacter ? "text-black" : "text-white"
                          }`}
                        >
                          {buttonText}
                        </span>
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {pendingSwitchCharacterId && user && activeCharacter ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-sm"
          onClick={() => {
            if (!switchingToCharacter) {
              setPendingSwitchCharacterId("");
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="switch-confirmation-title"
            className="w-full max-w-lg rounded-[2rem] border border-[#c1123f]/14 bg-white p-6 shadow-[0_30px_100px_rgba(0,0,0,0.28)] sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#c1123f]">
              Final confirmation
            </p>
            <h2
              id="switch-confirmation-title"
              className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-black"
            >
              Switch from {activeCharacter.name} to{" "}
              {characters.find(
                (character) => character.id === pendingSwitchCharacterId
              )?.name || "your new companion"}
              ?
            </h2>

            <div className="mt-5 rounded-[1.4rem] border border-[#c1123f]/16 bg-[#fff1f4] p-4 text-sm leading-7 text-[#8f0d2f]">
              <p className="font-semibold">This action cannot be undone.</p>
              <p className="mt-2">
                Your complete chat with {activeCharacter.name}, including its
                image records and relationship memory, will be permanently
                deleted. Your new companion will begin with an empty chat.
              </p>
            </div>

            {switchError ? (
              <p className="mt-4 rounded-[1.2rem] border border-[#c1123f]/12 bg-[#fff4f6] px-4 py-3 text-sm leading-6 text-[#8f0d2f]">
                {switchError}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingSwitchCharacterId("")}
                disabled={Boolean(switchingToCharacter)}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Keep {activeCharacter.name}
              </button>
              <button
                type="button"
                onClick={handleCharacterSwitch}
                disabled={Boolean(switchingToCharacter)}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#b10f38] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#970d31] disabled:cursor-not-allowed disabled:bg-black/20"
              >
                {switchingToCharacter
                  ? "Switching and deleting chat..."
                  : `Permanently switch to ${
                      characters.find(
                        (character) =>
                          character.id === pendingSwitchCharacterId
                      )?.name || "new companion"
                    }`}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
