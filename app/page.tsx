// app/page.tsx
import Link from "next/link";
import Image from "next/image";
import HomeBackToChatButton from "@/components/HomeBackToChatButton";
import HomeCompanionButton from "@/components/HomeCompanionButton";

const companions = [
  {
    id: "luna",
    name: "Luna",
    age: 27,
    vibe: "Warm & playful",
    summary: "Late-night chats, teasing energy, and easy chemistry.",
    detail:
      "Affectionate, curious, and easy to talk to. Luna remembers the little things and makes every conversation feel personal.",
    image: "/companions/luna-main.png",
  },
  {
    id: "ivy",
    name: "Ivy",
    age: 22,
    vibe: "Bold & teasing",
    summary: "Confident, witty, stylish, and always ready to tease.",
    detail:
      "Independent and playful with a mysterious edge. Ivy brings strong opinions, easy confidence, and lively chemistry.",
    image: "/companions/ivy-main.png",
  },
  {
    id: "sienna",
    name: "Sienna",
    age: 20,
    vibe: "Caring & confident",
    summary: "Warm, thoughtful, supportive, and boldly romantic.",
    detail:
      "Attentive and grounded with a talent for practical advice. Sienna listens closely and knows when to take the lead.",
    image: "/companions/sienna-main.png",
  },
] as const;

const benefits = [
  {
    title: "Private chat",
    text: "One-to-one conversations in a calm, personal space.",
  },
  {
    title: "Remembers your vibe",
    text: "The experience feels more consistent over time.",
  },
  {
    title: "Available anytime",
    text: "Drop in whenever you want company or conversation.",
  },
  {
    title: "Distinct personalities",
    text: "Every companion has her own tone, chemistry, and emotional energy.",
  },
] as const;

export default function HomePage() {
  const featured = companions[0];

  return (
    <main className="min-h-screen bg-[#f7eeee] text-[#111111]">
      <section className="px-4 pb-6 pt-5 sm:px-6 sm:pb-8 sm:pt-8 lg:px-8 lg:pb-10 lg:pt-10">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-[#c1123f]/10 bg-white/72 p-5 shadow-[0_20px_60px_rgba(111,0,23,0.05)] sm:p-8 lg:p-9">
          <div className="grid items-center gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
            <div className="space-y-6">
              <div className="inline-flex rounded-full border border-[#c1123f]/20 bg-[#fff1f4] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c1123f] sm:text-xs">
                Luxury companion experience
              </div>

              <div className="max-w-2xl space-y-4">
                <h1 className="max-w-xl text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-black sm:text-5xl lg:text-6xl">
                  Meet an AI companion that feels personal
                </h1>

                <p className="max-w-xl text-base leading-8 text-black/65 sm:text-lg">
                  Private, flirty, emotionally engaging conversations with
                  beautifully designed companions that feel warm, memorable, and
                  easy to return to.
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                <HomeBackToChatButton />

                <Link
                  href="/about"
                  className="inline-flex min-h-14 items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-7 py-3 font-semibold transition hover:border-[#c1123f]/25 hover:bg-[#fff7f8]"
                >
                  <span className="text-base text-black">About the app</span>
                </Link>

                <Link
                  href="/characters"
                  className="inline-flex min-h-14 items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-7 py-3 font-semibold transition hover:border-[#c1123f]/25 hover:bg-[#fff7f8]"
                >
                  <span className="text-base text-black">Browse companions</span>
                </Link>
              </div>

              <div className="grid gap-3 pt-1 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-[#c1123f]/8 bg-white px-5 py-5">
                  <h2 className="text-lg font-semibold tracking-tight text-black">
                    Private by design
                  </h2>
                  <p className="mt-2 text-base leading-7 text-black/65">
                    A calm, personal space for ongoing one-to-one conversation.
                  </p>
                </div>

                <div className="rounded-[1.5rem] border border-[#c1123f]/8 bg-white px-5 py-5">
                  <h2 className="text-lg font-semibold tracking-tight text-black">
                    Personality-led companions
                  </h2>
                  <p className="mt-2 text-base leading-7 text-black/65">
                    Distinct energy, tone, and chemistry with every character.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-x-10 top-6 h-24 rounded-full bg-[#d72652]/35 blur-3xl" />
              <div className="rounded-[2rem] border border-[#c1123f]/10 bg-[#fcf5f6] p-3 sm:p-4">
                <div className="relative overflow-hidden rounded-[1.8rem]">
                  <div className="relative aspect-[4/5] w-full">
                    <Image
                      src={featured.image}
                      alt={`${featured.name} featured companion`}
                      fill
                      priority
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 40vw"
                    />
                  </div>

                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.34)_0%,transparent_36%)]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/8 to-transparent" />

                  <div className="absolute left-4 top-4 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-black shadow-sm backdrop-blur">
                    Featured companion
                  </div>

                  <div className="absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4">
                    <div className="rounded-[1.6rem] border border-white/35 bg-white/78 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur sm:p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9d1134] sm:text-xs">
                        {featured.vibe}
                      </p>
                      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-black sm:text-4xl">
                        {featured.name}, {featured.age}
                      </h2>
                      <p className="mt-2 max-w-md text-base leading-7 text-black/62">
                        Always up for a late-night chat and a little teasing.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 pb-1 pt-4">
                  <span className="h-2.5 w-8 rounded-full bg-[#c1123f]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#c1123f] sm:text-[13px]">
              Featured companions
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-black sm:text-4xl lg:text-5xl">
              Curated personalities, not endless noise
            </h2>
            <p className="mt-3 max-w-2xl text-lg leading-8 text-black/65">
              Browse a smaller, more intentional collection of companions with
              distinct personalities, energy, and conversation style.
            </p>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {companions.map((companion) => (
              <article
                key={companion.id}
                className="overflow-hidden rounded-[2rem] border border-[#c1123f]/8 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.03)]"
              >
                <div className="relative aspect-[4/4.25] w-full overflow-hidden">
                  <Image
                    src={companion.image}
                    alt={`${companion.name} companion portrait`}
                    fill
                    className="object-cover transition duration-500 hover:scale-[1.02]"
                    sizes="(max-width: 1024px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/18 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <h3 className="text-3xl font-semibold tracking-tight text-white">
                      {companion.name}
                      <span className="ml-2 text-white/90">{companion.age}</span>
                    </h3>
                    <p className="mt-1 text-base font-medium text-white/92">
                      {companion.vibe}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 p-5 sm:p-6">
                  <p className="text-base leading-7 text-black/72">
                    {companion.summary}
                  </p>

                  <div className="rounded-[1.35rem] bg-[#f9f2f3] p-4">
                    <p className="text-[15px] leading-7 text-black/62">
                      {companion.detail}
                    </p>
                  </div>

                  <HomeCompanionButton companionId={companion.id} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-[#c1123f]/8 bg-white/72 p-5 sm:p-8 lg:p-9">
          <div className="max-w-3xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#c1123f] sm:text-[13px]">
              Why users love it
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-black sm:text-4xl lg:text-5xl">
              Built for chemistry, comfort, and consistency
            </h2>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="rounded-[1.75rem] border border-[#c1123f]/8 bg-[#fff8f8] px-5 py-6 sm:px-6"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ffe3ea] text-xl text-[#b10f38]">
                  ✦
                </div>
                <h3 className="mt-4 text-2xl font-semibold tracking-tight text-black">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-base leading-7 text-black/65">
                  {benefit.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-[#c1123f]/8 bg-white/72 px-5 py-8 sm:px-8 lg:px-9 lg:py-10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#c1123f] sm:text-[13px]">
            What it feels like
          </p>
          <blockquote className="mt-4 max-w-5xl text-3xl font-semibold leading-[1.18] tracking-[-0.03em] text-black sm:text-4xl lg:text-5xl">
            “It feels more like stepping into a familiar conversation than
            opening another app.”
          </blockquote>
          <p className="mt-5 text-lg text-black/45">— Early test user</p>
        </div>
      </section>

      <section className="px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] bg-black px-5 py-8 text-white shadow-[0_25px_70px_rgba(0,0,0,0.18)] sm:px-8 lg:px-9 lg:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#ff8fa8] sm:text-[13px]">
                Pricing preview
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl lg:text-5xl">
                Start free, upgrade when you want more
              </h2>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-white/75">
                Try the experience first, move to Pro for regular companion
                access, or choose Unlimited for the full image experience.
              </p>
            </div>

            <Link
              href="/upgrade"
              className="inline-flex min-h-14 items-center justify-center self-start rounded-full bg-white px-7 py-3 font-semibold transition hover:bg-white/90"
            >
              <span className="text-base text-black">View plans</span>
            </Link>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.06] p-6">
              <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-white/55 sm:text-[13px]">
                Free
              </p>
              <p className="mt-3 text-5xl font-semibold tracking-tight text-white">
                £0
              </p>
              <p className="mt-5 text-lg leading-8 text-white/75">
                Trial access with limited saved messages and no included image
                generation.
              </p>
              <div className="mt-5 space-y-2 text-sm leading-6 text-white/58">
                <p>• 15 messages per day</p>
                <p>• One active companion</p>
                <p>• Images not included</p>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-[#ff6b8f]/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(193,18,63,0.16))] p-6">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-white/75 sm:text-[13px]">
                  Pro
                </p>
                <span className="rounded-full bg-white/12 px-4 py-2 text-sm font-medium text-white">
                  Main plan
                </span>
              </div>

              <p className="mt-3 text-5xl font-semibold tracking-tight text-white">
                £14.99
              </p>
              <p className="mt-5 text-lg leading-8 text-white/82">
                Unlimited saved messages, 10 personal selfies per day, and 3
                spicy images per day.
              </p>
              <div className="mt-5 space-y-2 text-sm leading-6 text-white/65">
                <p>• Unlimited saved messages</p>
                <p>• 10 personal selfies daily</p>
                <p>• 3 spicy images daily</p>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-[#ff8fa8]/30 bg-[linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,143,168,0.18))] p-6">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-white/75 sm:text-[13px]">
                  Unlimited
                </p>
                <span className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black">
                  Full access
                </span>
              </div>

              <p className="mt-3 text-5xl font-semibold tracking-tight text-white">
                £29.99
              </p>
              <p className="mt-5 text-lg leading-8 text-white/82">
                Full companion access with unlimited saved messages, personal
                selfies, and spicy images.
              </p>
              <div className="mt-5 space-y-2 text-sm leading-6 text-white/65">
                <p>• Unlimited saved messages</p>
                <p>• Unlimited personal selfies</p>
                <p>• Unlimited spicy images</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-10 pt-5 sm:px-6 sm:pb-12 sm:pt-7 lg:px-8 lg:pb-16 lg:pt-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-[#c1123f]/8 bg-white/72 px-5 py-8 text-center sm:px-8 lg:px-9 lg:py-10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#c1123f] sm:text-[13px]">
            Ready to explore?
          </p>

          <h2 className="mx-auto mt-3 max-w-4xl text-3xl font-semibold tracking-[-0.03em] text-black sm:text-4xl lg:text-5xl">
            Find the companion that fits your energy
          </h2>

          <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-black/65">
            Start with a lighter free experience, browse distinct personalities,
            and come back whenever you want company.
          </p>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <HomeBackToChatButton />

            <Link
              href="/characters"
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-7 py-3 font-semibold transition hover:border-[#c1123f]/25 hover:bg-[#fff7f8]"
            >
              <span className="text-base text-black">Browse companions</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
