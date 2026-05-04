"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { characters } from "@/lib/characters";
import { getUser, type StoredUser } from "@/lib/user";

export default function CharactersPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setUser(getUser());
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-10 space-y-3">
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
          Choose your chat
        </p>

        <h1 className="text-3xl font-bold sm:text-4xl">
          Select a character
        </h1>

        <p className="max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base">
          Pick a character to open a private conversation.
        </p>

        {mounted && user ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
            Your active character is{" "}
            <span className="font-semibold text-white">{user.selectedCharacter}</span>.
            For the MVP, each account is locked to one character.
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {characters.map((character) => {
          const isReturningUser = mounted && !!user;
          const isActiveCharacter = user?.selectedCharacter === character.id;

          let href = `/signup?character=${character.id}`;
          let buttonLabel = "Chat now";
          let isLocked = false;

          if (isReturningUser) {
            if (isActiveCharacter) {
              href = `/chat/${character.id}`;
            } else {
              href = "/characters";
              buttonLabel = "Locked";
              isLocked = true;
            }
          }

          return (
            <article
              key={character.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur"
            >
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold">{character.name}</h2>
                <p className="text-sm text-zinc-400">{character.mood}</p>
                <p className="text-sm leading-6 text-zinc-300">{character.bio}</p>

                {isLocked ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled
                      className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-zinc-800 px-5 py-3 text-sm font-semibold text-zinc-500"
                    >
                      {buttonLabel}
                    </button>
                    <p className="text-xs text-zinc-500">
                      This account is currently locked to {user?.selectedCharacter}.
                    </p>
                  </div>
                ) : (
                  <Link
                    href={href}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
                  >
                    {buttonLabel}
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}