// app/page.tsx
import Link from "next/link";

const features = [
  "Chat with AI companion characters in a private web app",
  "Choose different personalities and conversation styles",
  "Saved message history for returning users",
  "Optional Pro plan for unlimited saved messages",
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-white/10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <p className="text-xl font-bold">AI Companion</p>
            <p className="text-sm text-zinc-400">
              Subscription-based AI companion chat app
            </p>
          </div>

          <nav className="hidden items-center gap-6 text-sm text-zinc-300 md:flex">
            <a href="#features" className="hover:text-white">
              Features
            </a>
            <a href="#pricing" className="hover:text-white">
              Pricing
            </a>
            <a href="#contact" className="hover:text-white">
              Contact
            </a>
            <Link
              href="/characters"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 font-semibold text-white transition hover:bg-white/10"
            >
              Open app
            </Link>
          </nav>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
              AI Companion
            </p>

            <h1 className="max-w-4xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              A subscription-based AI companion chat experience
            </h1>

            <p className="max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
              AI Companion is a web app where users can chat with AI companion
              characters in a warm, engaging, and conversational format. Users
              can access a free experience first, then upgrade to Pro for
              unlimited saved messages and extended use.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/characters"
                className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
              >
                Try the app
              </Link>

              <a
                href="#pricing"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                View pricing
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Example experience
              </p>

              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
                    User
                  </p>
                  <p className="text-sm text-zinc-200">
                    Hey, how’s your evening going?
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Assistant
                  </p>
                  <p className="text-sm text-zinc-200">
                    Pretty good now you’re here. What have you been up to today?
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
                    User
                  </p>
                  <p className="text-sm text-zinc-200">
                    Just winding down and looking for someone to chat with.
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Assistant
                  </p>
                  <p className="text-sm text-zinc-200">
                    Then you’re in the right place. I’m here to keep you company.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-white/10">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 space-y-3">
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
              Features
            </p>
            <h2 className="text-3xl font-bold sm:text-4xl">
              What the product offers
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base">
              AI Companion is designed as a consumer web app for ongoing AI chat
              interaction and companion-style conversations.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {features.map((feature) => (
              <div
                key={feature}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <p className="text-sm leading-6 text-zinc-200">{feature}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t border-white/10">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 space-y-3">
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
              Pricing
            </p>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Simple subscription pricing
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-lg font-semibold">Free</p>
              <p className="mt-3 text-4xl font-bold">£0</p>
              <p className="mt-2 text-sm text-zinc-400">Trial access</p>

              <div className="mt-6 space-y-3 text-sm text-zinc-300">
                <p>• Limited saved messages</p>
                <p>• Access to the starter experience</p>
                <p>• Good for first-time users</p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/20 bg-white/10 p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold">Pro</p>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white">
                  Main plan
                </span>
              </div>

              <p className="mt-3 text-4xl font-bold">£14.99</p>
              <p className="mt-2 text-sm text-zinc-400">per month</p>

              <div className="mt-6 space-y-3 text-sm text-zinc-200">
                <p>• Unlimited saved user messages</p>
                <p>• Ongoing access to the companion chat experience</p>
                <p>• Full subscription access for regular users</p>
              </div>

              <div className="mt-6">
                <Link
                  href="/upgrade"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
                >
                  Upgrade
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="border-t border-white/10">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
                Support
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                Contact email:
              </p>
              <p className="mt-1 text-sm font-semibold text-white break-all">
                digitalstrikemarketing@outlook.com
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
                Privacy
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                Read how user information is handled.
              </p>
              <Link
                href="/privacy"
                className="mt-4 inline-flex text-sm font-semibold text-white hover:text-zinc-300"
              >
                View Privacy Policy
              </Link>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
                Terms
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                Review the platform terms and usage rules.
              </p>
              <Link
                href="/terms"
                className="mt-4 inline-flex text-sm font-semibold text-white hover:text-zinc-300"
              >
                View Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-zinc-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>© 2026 AI Companion. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
            <Link href="/upgrade" className="hover:text-white">
              Upgrade
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}