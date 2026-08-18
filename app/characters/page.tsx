// app/characters/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { characters } from "@/lib/characters";
import { getUserWithFirestoreFallback, type StoredUser } from "@/lib/user";
import { normalizePlan } from "@/lib/plans";

const characterImages: Record<string, string> = {
  luna: "/companions/luna-main.png",
  ivy: "/companions/ivy-main.png",
  sienna: "/companions/sienna-main.png",
};

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
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        setMounted(true);

        const savedUser = await getUserWithFirestoreFallback();
        setUser(savedUser);
      } catch (error) {
        console.error("Failed to load saved user on characters page:", error);
      } finally {
        setIsLoadingUser(false);
      }
    }

    loadUser();
  }, []);

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
              Curated companions with real personality
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
                        {character.name}
                      </h2>
                    </div>
                  </div>

                  <div className="space-y-4 p-5 sm:p-6">
                    <p className="text-base leading-7 text-black/72">
                      {character.bio}
                    </p>

                    <div className="rounded-[1.35rem] bg-[#f9f2f3] p-4">
                      <p className="text-[15px] leading-7 text-black/62">
                        {isActiveCharacter
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
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}