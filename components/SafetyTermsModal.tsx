"use client";

import Link from "next/link";
import { PROHIBITED_CONTENT_RULES } from "@/lib/contentSafety";

export default function SafetyTermsModal({
  open,
  lockedUntil,
  onClose,
}: {
  open: boolean;
  lockedUntil?: string | null;
  onClose: () => void;
}) {
  if (!open) return null;

  const formattedLockedUntil = lockedUntil
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(lockedUntil))
    : null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#26030d]/75 px-4 py-6 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="safety-terms-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/15 bg-[#fffafa] p-7 shadow-[0_30px_100px_rgba(0,0,0,0.38)] sm:p-9"
      >
        <p className="text-sm uppercase tracking-[0.22em] text-[#b10f38]">
          Terms And Safety Notice
        </p>
        <h2
          id="safety-terms-title"
          className="mt-3 text-3xl tracking-[-0.04em] text-black sm:text-4xl"
        >
          Spicy Features Are Temporarily Locked
        </h2>
        <p className="mt-4 text-sm leading-7 text-black/65">
          This Account Has Made Three Prohibited Requests Within 24 Hours.
          Normal Companion Chat Remains Available, But Spicy Chat And Spicy
          Images Are Locked For 24 Hours.
        </p>

        {formattedLockedUntil ? (
          <p className="mt-3 rounded-2xl bg-[#f7eeee] px-4 py-3 text-sm text-[#8f0d2f]">
            The Restriction Is Currently Due To End At {formattedLockedUntil}.
          </p>
        ) : null}

        <div className="mt-6 rounded-[1.5rem] border border-[#c1123f]/10 bg-white p-5">
          <h3 className="text-lg text-black">Content That Is Not Allowed</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-black/65">
            {PROHIBITED_CONTENT_RULES.map((rule) => (
              <li key={rule} className="flex gap-3">
                <span aria-hidden="true" className="text-[#b10f38]">•</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-5 text-sm leading-7 text-black/60">
          Consensual Adult Conversation Between The User And A Fictional Adult
          Companion Remains Allowed When The Restriction Ends.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-[#b10f38] px-6 py-3 text-white transition hover:bg-[#970d31]"
          >
            I Understand
          </button>
          <Link
            href="/terms#prohibited-content"
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-[#b10f38] px-6 py-3 text-center text-white transition hover:bg-[#970d31]"
          >
            Read Full Terms
          </Link>
        </div>
      </section>
    </div>
  );
}
