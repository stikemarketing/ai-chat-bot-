// app/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Companion = {
  name: string;
  age: number;
  tag: string;
  teaser: string;
  story: string;
  heroImage: string;
  cardImage: string;
};

const featuredCompanions: Companion[] = [
  {
    name: "Luna",
    age: 24,
    tag: "Warm & playful",
    teaser: "Always up for a late-night chat and a little teasing.",
    story:
      "Luna is affectionate, curious, and easy to talk to. She remembers the small details and makes every conversation feel personal.",
    heroImage: "/companions/luna-main.png",
    cardImage: "/companions/luna-main.png",
  },
  {
    name: "Ivy",
    age: 27,
    tag: "Elegant & magnetic",
    teaser: "Polished, confident, and quietly impossible to ignore.",
    story:
      "Ivy brings a refined, luxury energy to every conversation. She feels poised, sophisticated, and effortlessly captivating.",
    heroImage: "/companions/ivy-main.png",
    cardImage: "/companions/ivy-main.png",
  },
  {
    name: "Sienna",
    age: 26,
    tag: "Romantic & bold",
    teaser: "Warm, passionate, and made for unforgettable evenings.",
    story:
      "Sienna is expressive, intimate, and full of date-night energy. She feels rich, confident, and emotionally magnetic.",
    heroImage: "/companions/sienna-main.png",
    cardImage: "/companions/sienna-main.png",
  },
];

const benefitItems = [
  {
    title: "Private chat",
    description: "One-to-one conversations in a calm, personal space.",
  },
  {
    title: "Remembers you",
    description: "The experience feels more consistent over time.",
  },
  {
    title: "Always available",
    description: "Drop in whenever you want company or conversation.",
  },
  {
    title: "Warm energy",
    description: "Choose companions with flirty, soft, or playful vibes.",
  },
];

const vibeItems = ["Sweet", "Flirty", "Romantic", "Playful", "Confident"];

export default function HomePage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeCompanion = useMemo(
    () => featuredCompanions[activeIndex],
    [activeIndex]
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % featuredCompanions.length);
    }, 4500);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fff8f7_0%,#fff4f1_24%,#fffaf9_46%,#fff_100%)] text-zinc-950">
      <section className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <button
            type="button"
            aria-label="Open menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/5 bg-white text-zinc-900 shadow-sm transition hover:bg-zinc-50"
          >
            <span className="relative block h-4 w-5">
              <span className="absolute left-0 top-0 block h-0.5 w-5 rounded-full bg-current" />
              <span className="absolute left-0 top-[7px] block h-0.5 w-5 rounded-full bg-current" />
              <span className="absolute left-0 top-[14px] block h-0.5 w-5 rounded-full bg-current" />
            </span>
          </button>

          <Link
            href="/"
            className="text-lg font-semibold tracking-[-0.03em] text-zinc-950"
          >
            AI Companion
          </Link>

          <Link
            href="/characters"
            className="inline-flex items-center justify-center rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-50"
          >
            Sign in
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-black/5 bg-white/80 p-5 shadow-[0_20px_80px_rgba(24,24,27,0.08)] sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-rose-700">
                Luxury companion experience
              </div>

              <div className="space-y-4">
                <h1 className="max-w-xl text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-zinc-950 sm:text-5xl">
                  Meet an AI companion that feels personal
                </h1>

                <p className="max-w-lg text-base leading-7 text-zinc-600 sm:text-lg">
                  Private, flirty, emotionally engaging conversations with
                  beautifully designed companions that feel warm, memorable, and
                  easy to return to.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/characters"
                  className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  Start chatting
                </Link>

                <a
                  href="#featured-companions"
                  className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-6 py-3.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
                >
                  Browse companions
                </a>
              </div>

              <div className="grid gap-3 text-sm text-zinc-600 sm:grid-cols-2">
                <div className="rounded-2xl border border-black/5 bg-white/90 p-4">
                  <p className="font-semibold text-zinc-900">Private by design</p>
                  <p className="mt-1 leading-6">
                    A calm, personal space for ongoing one-to-one conversation.
                  </p>
                </div>

                <div className="rounded-2xl border border-black/5 bg-white/90 p-4">
                  <p className="font-semibold text-zinc-900">
                    Personality-led companions
                  </p>
                  <p className="mt-1 leading-6">
                    Distinct energy, tone, and chemistry with every character.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-x-4 top-6 h-28 rounded-full bg-rose-200/40 blur-3xl" />

              <div className="relative overflow-hidden rounded-[2rem] border border-black/5 bg-[linear-gradient(180deg,#fff,#fff6f6)] p-4 shadow-[0_16px_60px_rgba(236,72,153,0.12)] sm:p-5">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-zinc-100">
                  <Image
                    key={activeCompanion.heroImage}
                    src={activeCompanion.heroImage}
                    alt={`${activeCompanion.name} featured companion`}
                    fill
                    priority
                    className="object-cover transition duration-700"
                    sizes="(max-width: 1024px) 100vw, 40vw"
                  />

                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.42)_0%,transparent_45%)]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />

                  <div className="absolute left-5 top-5 rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm backdrop-blur">
                    Featured companion
                  </div>

                  <div className="absolute bottom-4 left-4 right-4 rounded-[1.5rem] border border-white/40 bg-white/72 p-4 shadow-lg backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      {activeCompanion.tag}
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-zinc-950">
                      {activeCompanion.name}, {activeCompanion.age}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">
                      {activeCompanion.teaser}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-2">
                  {featuredCompanions.map((companion, index) => (
                    <button
                      key={companion.name}
                      type="button"
                      aria-label={`Show ${companion.name}`}
                      onClick={() => setActiveIndex(index)}
                      className={`h-2.5 rounded-full transition ${
                        activeIndex === index
                          ? "w-7 bg-rose-500"
                          : "w-2.5 bg-zinc-300 hover:bg-zinc-400"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="featured-companions"
        className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8"
      >
        <div className="mb-5 space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-rose-600">
            Featured companions
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.04em] text-zinc-950">
            Curated personalities, not endless noise
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">
            Browse a smaller, more intentional collection of companions with
            distinct personalities, energy, and conversation style.
          </p>
        </div>

        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
          {featuredCompanions.map((companion) => (
            <article
              key={companion.name}
              className="group min-w-[18rem] max-w-[18rem] snap-start overflow-hidden rounded-[1.75rem] border border-black/5 bg-white shadow-[0_12px_40px_rgba(24,24,27,0.06)]"
            >
              <div className="relative h-72 overflow-hidden bg-zinc-100">
                <Image
                  src={companion.cardImage}
                  alt={`${companion.name} companion card`}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  sizes="18rem"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                  <p className="text-2xl font-semibold tracking-[-0.04em]">
                    {companion.name} {companion.age}
                  </p>
                  <p className="mt-1 text-sm text-white/90">{companion.tag}</p>
                </div>
              </div>

              <div className="space-y-3 p-5">
                <p className="text-sm leading-6 text-zinc-600">
                  {companion.teaser}
                </p>

                <div className="rounded-2xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600 transition group-hover:bg-rose-50">
                  {companion.story}
                </div>

                <Link
                  href="/characters"
                  className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  View companion
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-black/5 bg-white p-6 shadow-[0_12px_40px_rgba(24,24,27,0.05)] sm:p-8">
          <div className="mb-6 space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-rose-600">
              Why users love it
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-zinc-950">
              Built for chemistry, comfort, and consistency
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {benefitItems.map((item) => (
              <div
                key={item.title}
                className="rounded-[1.5rem] border border-black/5 bg-[linear-gradient(180deg,#fff,#fff7f7)] p-5"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-lg">
                  ✦
                </div>
                <p className="text-lg font-semibold tracking-[-0.02em] text-zinc-950">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-black/5 bg-white p-6 shadow-[0_12px_40px_rgba(24,24,27,0.05)] sm:p-8">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-rose-600">
              Find your vibe
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-zinc-950">
              Choose the energy that suits you
            </h2>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {vibeItems.map((item) => (
              <button
                key={item}
                type="button"
                className="rounded-full border border-black/8 bg-[linear-gradient(180deg,#fff,#fff6f6)] px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:border-rose-200 hover:bg-rose-50"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-black/5 bg-[linear-gradient(180deg,#fff,#fff6fb)] p-6 shadow-[0_12px_40px_rgba(24,24,27,0.05)] sm:p-8">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-rose-600">
            What it feels like
          </p>

          <blockquote className="mt-4 text-2xl font-semibold leading-tight tracking-[-0.04em] text-zinc-950 sm:text-3xl">
            “It feels more like stepping into a familiar conversation than
            opening another app.”
          </blockquote>

          <p className="mt-4 text-sm text-zinc-500">— Early test user</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-black/5 bg-zinc-950 p-6 text-white shadow-[0_20px_60px_rgba(24,24,27,0.12)] sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-rose-300">
                Pricing preview
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                Start free, upgrade when you want more
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base">
                Try the experience first, then move to Pro for unlimited saved
                messages and longer-term conversation.
              </p>
            </div>

            <Link
              href="/upgrade"
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100"
            >
              Upgrade
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-zinc-400">
                Free
              </p>
              <p className="mt-2 text-4xl font-semibold tracking-[-0.05em]">
                £0
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                Trial access with limited saved messages and a lighter starter
                experience.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-rose-300/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(244,114,182,0.10))] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm uppercase tracking-[0.18em] text-rose-200">
                  Pro
                </p>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
                  Main plan
                </span>
              </div>
              <p className="mt-2 text-4xl font-semibold tracking-[-0.05em]">
                £14.99
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-200">
                Unlimited saved messages and full ongoing access for regular
                users.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-black/5 bg-white p-6 text-center shadow-[0_12px_40px_rgba(24,24,27,0.05)] sm:p-10">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-rose-600">
            Ready to explore?
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-4xl">
            Find the companion that fits your energy
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">
            Start with a lighter free experience, browse distinct personalities,
            and come back whenever you want company.
          </p>

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/characters"
              className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Start chatting
            </Link>
            <Link
              href="/upgrade"
              className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-6 py-3.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
            >
              View upgrade
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/5 bg-white/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-zinc-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>© 2026 AI Companion. All rights reserved.</p>

          <div className="flex flex-wrap items-center gap-4">
            <Link href="/privacy" className="transition hover:text-zinc-950">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-zinc-950">
              Terms
            </Link>
            <a
              href="mailto:digitalstrikemarketing@outlook.com"
              className="transition hover:text-zinc-950"
            >
              Support
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}