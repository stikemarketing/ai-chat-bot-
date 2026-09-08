// app/install/page.tsx
import Link from "next/link";

const installSteps = [
  {
    title: "iPhone or iPad",
    browser: "Safari",
    steps: [
      "Open Close Too You in Safari.",
      "Tap the Share button at the bottom of the screen.",
      "Scroll down and tap Add to Home Screen.",
      "Tap Add.",
      "Open Close Too You from your home screen like a normal app.",
    ],
  },
  {
    title: "Android",
    browser: "Chrome",
    steps: [
      "Open Close Too You in Chrome.",
      "Tap the three-dot menu in the top corner.",
      "Tap Install app or Add to Home screen.",
      "Tap Install or Add.",
      "Open Close Too You from your home screen.",
    ],
  },
  {
    title: "Desktop",
    browser: "Chrome, Edge, or supported browsers",
    steps: [
      "Open Close Too You in your browser.",
      "Look for the install icon in the address bar.",
      "Click Install.",
      "Open Close Too You from your apps or dock.",
    ],
  },
] as const;

export default function InstallPage() {
  return (
    <main className="min-h-screen bg-[#f7eeee] px-4 py-6 text-[#111111] sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm font-medium text-black/50 transition hover:text-[#c1123f]"
          >
            ← Back home
          </Link>
        </div>

        <section className="rounded-[2rem] border border-[#c1123f]/10 bg-white/72 p-6 shadow-[0_20px_60px_rgba(111,0,23,0.05)] sm:p-8 lg:p-10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#c1123f] sm:text-[13px]">
            Install app
          </p>

          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-black sm:text-5xl">
            Add Close Too You to your home screen
          </h1>

          <p className="mt-4 max-w-3xl text-base leading-8 text-black/65 sm:text-lg">
            Close Too You can be opened from your phone like an app. You do not
            need to download it from the App Store or Google Play during this
            web app version.
          </p>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {installSteps.map((section) => (
              <article
                key={section.title}
                className="rounded-[1.75rem] border border-[#c1123f]/8 bg-white p-5 shadow-[0_10px_30px_rgba(111,0,23,0.04)] sm:p-6"
              >
                <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#c1123f]">
                  {section.browser}
                </p>

                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-black">
                  {section.title}
                </h2>

                <ol className="mt-5 space-y-3">
                  {section.steps.map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#b10f38] text-sm font-semibold text-white">
                        {index + 1}
                      </span>

                      <span className="text-sm leading-7 text-black/68 sm:text-base">
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-[1.75rem] border border-[#c1123f]/8 bg-[#fff8f8] p-5 sm:p-6">
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-black">
              Notifications
            </h2>

            <p className="mt-3 text-base leading-8 text-black/65">
              After signing in, you can enable notifications in chat or after
              checkout. This lets your companion send good morning texts and
              occasional check-ins when notifications are supported on your
              device.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup?character=luna"
              className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#b10f38] px-7 py-3 font-semibold transition hover:bg-[#970d31]"
            >
              <span className="text-base text-white">Start chatting</span>
            </Link>

            <Link
              href="/characters"
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-[#c1123f]/14 bg-white px-7 py-3 font-semibold transition hover:border-[#c1123f]/25 hover:bg-[#fff7f8]"
            >
              <span className="text-base text-black">Browse companions</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}