// app/signup/page.tsx
"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveUser } from "@/lib/user";
import { saveUserToFirestore } from "@/firebase/users";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSaving, setIsSaving] = useState(false);

  const characterId = searchParams.get("character") || "luna";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    if (!name || !email) {
      return;
    }

    const userId = `user_${crypto.randomUUID()}`;
    const user = {
      id: userId,
      name,
      email,
      selectedCharacter: characterId,
      timezone,
      plan: "free" as const,
      trialActive: true as const,
    };

    try {
      setIsSaving(true);

      saveUser(user);
      await saveUserToFirestore(user);

      router.push(`/chat/${characterId}`);
    } catch (error) {
      console.error("Failed to save user:", error);
      alert("Something went wrong while saving your account. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <div className="mb-8 space-y-3 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
            Sign up
          </p>

          <h1 className="text-3xl font-bold sm:text-4xl">
            Create your account
          </h1>

          <p className="text-sm leading-6 text-zinc-300 sm:text-base">
            Start your free trial and save your chat experience.
          </p>

          <p className="text-sm text-zinc-400">
            Selected character:{" "}
            <span className="font-semibold text-white">{characterId}</span>
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-zinc-200">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Enter your name"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-white/30"
              required
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-zinc-200">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="Enter your email"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-white/30"
              required
              disabled={isSaving}
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex w-full items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? "Saving..." : "Start free trial"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
            <p className="text-sm text-zinc-400">Loading signup...</p>
          </div>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}