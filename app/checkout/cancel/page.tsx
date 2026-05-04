// app/checkout/cancel/page.tsx
import Link from "next/link";

export default function CheckoutCancelPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
          Checkout canceled
        </p>

        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
          No worries
        </h1>

        <p className="mt-4 text-sm leading-6 text-zinc-300 sm:text-base">
          Your payment was not completed. You can come back and upgrade whenever
          you want.
        </p>

        <div className="mt-6">
          <Link
            href="/upgrade"
            className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
          >
            Back to plans
          </Link>
        </div>
      </div>
    </div>
  );
}