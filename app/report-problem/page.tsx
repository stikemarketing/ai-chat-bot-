"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const SUPPORT_EMAIL = "digitalstrikesupport@gmail.com";

export default function ReportProblemPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [reportId, setReportId] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const form = event.currentTarget;
      const response = await fetch("/api/support-report", {
        method: "POST",
        body: new FormData(form),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        reportId?: string;
        error?: string;
      };

      if (!response.ok || !data.ok || !data.reportId) {
        throw new Error(data.error || "The Report Could Not Be Submitted.");
      }

      setReportId(data.reportId);
      form.reset();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "The Report Could Not Be Submitted."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7eeee] px-4 py-6 text-[#111111] sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-3xl">
        <section className="rounded-[2rem] border border-[#c1123f]/10 bg-white/78 p-5 shadow-[0_20px_60px_rgba(111,0,23,0.05)] sm:p-8 lg:p-10">
          <p className="text-[12px] uppercase tracking-[0.24em] text-[#c1123f] sm:text-[13px]">
            Support
          </p>
          <h1 className="mt-3 text-4xl tracking-[-0.04em] text-black sm:text-5xl">
            Report A Problem
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-black/62">
            Tell Us About Prohibited Content, A Copyright Or Likeness Concern,
            An Account Restriction, Or Another Problem With The Service.
          </p>

          {reportId ? (
            <div className="mt-8 rounded-[1.6rem] border border-[#c1123f]/10 bg-[#fff5f7] p-5">
              <h2 className="text-2xl text-black">Your Report Has Been Saved</h2>
              <p className="mt-2 text-sm leading-7 text-black/62">
                Keep This Reference Number In Case You Need To Contact Support:
              </p>
              <p className="preserve-case mt-2 break-all text-sm text-[#b10f38]">
                {reportId}
              </p>
              <a
                className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-[#b10f38] px-6 py-3 text-white"
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                  `Support Report ${reportId}`
                )}`}
              >
                Email Support About This Report
              </a>
            </div>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div className="absolute -left-[10000px]" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input id="website" name="website" tabIndex={-1} autoComplete="off" />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-black/72">
                  <span>Name</span>
                  <input
                    className="min-h-12 w-full rounded-[1rem] border border-[#c1123f]/12 bg-white px-4 outline-none focus:border-[#c1123f]/35"
                    name="name"
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </label>

                <label className="space-y-2 text-sm text-black/72">
                  <span>Email Address</span>
                  <input
                    className="min-h-12 w-full rounded-[1rem] border border-[#c1123f]/12 bg-white px-4 outline-none focus:border-[#c1123f]/35"
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                  />
                </label>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-black/72">
                  <span>Type Of Report</span>
                  <select
                    className="min-h-12 w-full rounded-[1rem] border border-[#c1123f]/12 bg-white px-4 outline-none focus:border-[#c1123f]/35"
                    name="reportType"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>Select A Report Type</option>
                    <option value="prohibited-content">Prohibited Or Illegal Content</option>
                    <option value="copyright-or-likeness">Copyright Or Likeness Concern</option>
                    <option value="account-restriction">Incorrect Account Restriction</option>
                    <option value="technical-or-other">Technical Or Other Problem</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm text-black/72">
                  <span>Where Did It Happen?</span>
                  <select
                    className="min-h-12 w-full rounded-[1rem] border border-[#c1123f]/12 bg-white px-4 outline-none focus:border-[#c1123f]/35"
                    name="location"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>Select A Location</option>
                    <option value="chat">Chat</option>
                    <option value="image-generation">Image Generation</option>
                    <option value="account">Account Page</option>
                    <option value="website">Website</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-2 text-sm text-black/72">
                <span>Describe The Problem</span>
                <textarea
                  className="min-h-40 w-full resize-y rounded-[1rem] border border-[#c1123f]/12 bg-white px-4 py-3 outline-none focus:border-[#c1123f]/35"
                  name="description"
                  required
                  minLength={20}
                  maxLength={5000}
                  placeholder="Please Include Enough Detail For Us To Understand And Review The Problem."
                />
              </label>

              <label className="block space-y-2 text-sm text-black/72">
                <span>Optional Screenshot</span>
                <input
                  className="w-full rounded-[1rem] border border-[#c1123f]/12 bg-white px-4 py-3"
                  name="screenshot"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                />
                <span className="block text-xs leading-6 text-black/45">
                  JPG, PNG, Or WebP Only. Maximum File Size 5 MB. Screenshots Are Stored Privately.
                </span>
              </label>

              {error ? (
                <p className="rounded-[1rem] bg-[#fff0f3] px-4 py-3 text-sm text-[#9a0d31]">
                  {error}
                </p>
              ) : null}

              <button
                className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#b10f38] px-7 py-3 text-white disabled:cursor-not-allowed"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting Report..." : "Submit Report"}
              </button>

              <p className="text-center text-xs leading-6 text-black/45">
                You Can Also Contact {SUPPORT_EMAIL}. Please Do Not Include Passwords,
                Payment Details, Or Identification Documents.
              </p>
            </form>
          )}

          <div className="mt-7 text-center">
            <Link className="text-sm text-[#b10f38] hover:text-[#970d31]" href="/about">
              Back To About
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
