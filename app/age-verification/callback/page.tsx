"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { auth } from "@/firebase/config";
import { getUserWithFirestoreFallback } from "@/lib/user";

function AgeVerificationCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Confirming Your Private Age Check...");

  const source = searchParams.get("source") === "app" ? "app" : "web";
  const requestedCharacter = searchParams.get("character");
  const character =
    requestedCharacter === "ivy" || requestedCharacter === "sienna" ? requestedCharacter : "luna";

  const destination = useMemo(() => {
    return source === "app" ? `/app/chat/${character}` : `/chat/${character}`;
  }, [source, character]);

  useEffect(() => {
    async function finishVerification() {
      try {
        const verificationId = searchParams.get("verification_id");
        if (!verificationId) {
          throw new Error("The Age-Check Provider Did Not Return A Result.");
        }

        const user = await getUserWithFirestoreFallback();
        const firebaseUser = auth.currentUser;
        if (!user || !firebaseUser) {
          router.replace("/signup?mode=signin");
          return;
        }

        const idToken = await firebaseUser.getIdToken();
        const response = await fetch("/api/age-assurance/complete", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ verificationId }),
        });
        const data = (await response.json()) as {
          adultVerified?: boolean;
          status?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || "The Age-Check Result Could Not Be Confirmed.");
        }

        if (data.adultVerified) {
          router.replace(destination);
          return;
        }

        // Not approved (pending/failed/expired) -- send back to the main
        // age-verification page so the user can see the result and retry.
        router.replace(`/age-verification?source=${source}&character=${character}`);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "The Age-Check Result Could Not Be Confirmed."
        );
      }
    }

    void finishVerification();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-[#f7eeee] px-4 py-10 text-black sm:px-6">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-[#c1123f]/10 bg-white p-7 shadow-[0_24px_80px_rgba(111,0,23,0.08)] sm:p-10 text-center">
        <p className="text-base leading-7 text-black/65">{message}</p>
      </section>
    </main>
  );
}

export default function AgeVerificationCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f7eeee] px-4 py-10 text-black sm:px-6">
          <div className="mx-auto max-w-2xl rounded-[2rem] bg-white p-8 text-center">
            Confirming Your Private Age Check...
          </div>
        </main>
      }
    >
      <AgeVerificationCallbackContent />
    </Suspense>
  );
}
