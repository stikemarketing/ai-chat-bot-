"use client";

import Link from "next/link";
import { applyActionCode } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "@/firebase/config";

type VerificationState = "checking" | "success" | "invalid" | "unsupported";

function getEmailActionParams() {
  if (typeof window === "undefined") {
    return { mode: "", actionCode: "" };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    mode: params.get("mode") || "",
    actionCode: params.get("oobCode") || "",
  };
}

export default function EmailActionPage() {
  const [verificationState, setVerificationState] =
    useState<VerificationState>("checking");

  useEffect(() => {
    let isActive = true;

    async function verifyEmail() {
      const { mode, actionCode } = getEmailActionParams();

      if (mode !== "verifyEmail") {
        if (isActive) {
          setVerificationState("unsupported");
        }
        return;
      }

      if (!actionCode) {
        if (isActive) {
          setVerificationState("invalid");
        }
        return;
      }

      try {
        await applyActionCode(auth, actionCode);

        if (isActive) {
          setVerificationState("success");
        }
      } catch (error) {
        console.error("Email verification action failed:", error);

        if (isActive) {
          setVerificationState("invalid");
        }
      }
    }

    void verifyEmail();

    return () => {
      isActive = false;
    };
  }, []);

  const isChecking = verificationState === "checking";
  const isSuccess = verificationState === "success";
  const isUnsupported = verificationState === "unsupported";

  return (
    <main className="min-h-screen bg-[#f7eeee] px-4 py-10 text-[#111111] sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto flex min-h-[68vh] w-full max-w-3xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[2rem] border border-[#c1123f]/10 bg-white/90 shadow-[0_24px_80px_rgba(111,0,23,0.09)]">
          <div className="h-2 bg-[#b10f38]" />

          <div className="p-6 text-center sm:p-10 lg:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fff1f4] text-2xl text-[#b10f38]">
              {isChecking ? "…" : isSuccess ? "✓" : "!"}
            </div>

            <p className="mt-6 text-[12px] uppercase tracking-[0.24em] text-[#c1123f]">
              Close Too You
            </p>

            <h1 className="mt-3 text-4xl tracking-[-0.04em] text-black sm:text-5xl">
              {isChecking
                ? "Verifying Your Email"
                : isSuccess
                ? "Your Email Is Verified"
                : isUnsupported
                ? "This Link Is Not Supported"
                : "This Verification Link Cannot Be Used"}
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-black/62 sm:text-lg">
              {isChecking
                ? "Please Wait While We Securely Confirm Your Email Address."
                : isSuccess
                ? "Your Account Is Ready. Return To Sign In And Continue To Your Chosen Companion."
                : isUnsupported
                ? "This Page Can Only Complete Email Verification Requests."
                : "The Link May Have Already Been Used Or It May Have Expired. If Your Email Is Already Verified, You Can Continue To Sign In."}
            </p>

            {!isChecking ? (
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/signup?mode=signin"
                  className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#b10f38] px-7 py-3 text-white transition hover:bg-[#970d31]"
                >
                  {isSuccess ? "Continue To Sign In" : "Go To Sign In"}
                </Link>

                {!isSuccess ? (
                  <Link
                    href="/characters"
                    className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#b10f38] px-7 py-3 text-white transition hover:bg-[#970d31]"
                  >
                    Back To Companions
                  </Link>
                ) : null}
              </div>
            ) : null}

            <p className="mt-8 text-sm leading-7 text-black/42">
              Your Verification Link Is Private And Can Only Be Used Once.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
