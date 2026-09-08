"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { auth } from "@/firebase/config";
import { getUserWithFirestoreFallback } from "@/lib/user";

type VerificationStatus = {
  adultVerified: boolean;
  status: "not_started" | "pending" | "verified" | "failed";
  enforced: boolean;
  providerConfigured: boolean;
};

function AgeVerificationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const destination = useMemo(() => {
    const source = searchParams.get("source") === "app" ? "app" : "web";
    const requestedCharacter = searchParams.get("character");
    const character =
      requestedCharacter === "ivy" || requestedCharacter === "sienna"
        ? requestedCharacter
        : "luna";
    return source === "app" ? `/app/chat/${character}` : `/chat/${character}`;
  }, [searchParams]);

  useEffect(() => {
    async function loadStatus() {
      try {
        const user = await getUserWithFirestoreFallback();
        const firebaseUser = auth.currentUser;
        if (!user || !firebaseUser) {
          router.replace("/signup?mode=signin");
          return;
        }

        const token = await firebaseUser.getIdToken();
        const response = await fetch("/api/age-assurance/status", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = (await response.json()) as VerificationStatus & { error?: string };
        if (!response.ok) throw new Error(data.error || "Status Could Not Be Loaded.");

        if (data.adultVerified) {
          router.replace(destination);
          return;
        }

        setStatus(data);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Status Could Not Be Loaded.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadStatus();
  }, [destination, router]);

  async function beginVerification() {
    try {
      setIsSubmitting(true);
      setMessage("");
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error("Please Sign In Again To Continue.");
      const token = await firebaseUser.getIdToken();
      const response = await fetch("/api/age-assurance/start", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as { error?: string; redirectUrl?: string };
      if (!response.ok) throw new Error(data.error || "Age Check Could Not Be Started.");
      if (!data.redirectUrl) throw new Error("AgeChecked Did Not Return A Secure Link.");
      window.location.assign(data.redirectUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Age Check Could Not Be Started.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function continueLocalTesting() {
    try {
      setIsSubmitting(true);
      setMessage("");
      router.replace(destination);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Confirmation Could Not Be Saved.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7eeee] px-4 py-10 text-black sm:px-6">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-[#c1123f]/10 bg-white p-7 shadow-[0_24px_80px_rgba(111,0,23,0.08)] sm:p-10">
        <p className="text-sm uppercase tracking-[0.22em] text-[#b10f38]">Private Age Check</p>
        <h1 className="mt-3 text-4xl tracking-[-0.04em] sm:text-5xl">Complete Your Private Age Check</h1>
        <p className="mt-5 text-base leading-7 text-black/65">
          Your Companion Account Is For Adults Only. The Age-Check Provider
          Returns Only An Over-18 Result. This Website Will Not Receive Or Store
          Your Identity Documents, Card Details, Bank Details Or Date Of Birth.
        </p>

        <div className="mt-7 space-y-3 rounded-[1.5rem] bg-[#fff7f8] p-5 text-sm leading-6 text-black/70">
          <p>Available Non-ID Methods Will Include Mobile-Network Or Credit-Card Age Checks.</p>
          <p>The Check Is Completed Once Per Account.</p>
        </div>

        {message ? <div className="mt-6 rounded-[1.25rem] border border-[#c1123f]/15 bg-[#fff4f6] px-5 py-4 text-sm leading-6 text-[#8f0d2f]">{message}</div> : null}

        <button type="button" onClick={beginVerification} disabled={isLoading || isSubmitting} className="mt-7 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#b10f38] px-6 py-3 text-white transition hover:bg-[#970d31] disabled:cursor-not-allowed disabled:opacity-55">
          {isLoading ? "Checking Your Account..." : isSubmitting ? "Please Wait..." : "Continue To Private Age Check"}
        </button>

        {status && !status.enforced ? (
          <button type="button" onClick={continueLocalTesting} disabled={isSubmitting} className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#b10f38] px-6 py-3 text-white transition hover:bg-[#970d31] disabled:opacity-55">
            Continue Local Testing
          </button>
        ) : null}

        <p className="mt-5 text-center text-xs leading-6 text-black/45">
          Live Access Will Remain Locked Until The AgeChecked Merchant Connection Is Approved And Configured.
        </p>
      </section>
    </main>
  );
}

export default function AgeVerificationPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f7eeee] px-4 py-10 text-black sm:px-6">
          <div className="mx-auto max-w-2xl rounded-[2rem] bg-white p-8 text-center">
            Loading Your Private Age Check...
          </div>
        </main>
      }
    >
      <AgeVerificationContent />
    </Suspense>
  );
}
