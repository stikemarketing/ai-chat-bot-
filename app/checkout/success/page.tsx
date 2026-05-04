import Link from "next/link";

export default function CheckoutSuccessPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
          Payment successful
        </p>

        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
          You are upgrading to Pro
        </h1>

        <p className="mt-4 text-sm leading-6 text-zinc-300 sm:text-base">
          Your payment was received. If the webhook is set correctly, your account
          will switch to Pro shortly.
        </p>

        <div className="mt-6">
          <Link
            href="/chat/luna"
            className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
          >
            Back to chat
          </Link>
        </div>
      </div>
    </div>
  );
}