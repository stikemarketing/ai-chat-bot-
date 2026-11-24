// app/terms/page.tsx
import Link from "next/link";
import { PROHIBITED_CONTENT_RULES } from "@/lib/contentSafety";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f7eeee] px-4 py-6 text-[#111111] sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm font-medium text-black/50 transition hover:text-[#c1123f]"
          >
            ← Back to home
          </Link>
        </div>

        <section className="rounded-[2rem] border border-[#c1123f]/10 bg-white/72 p-6 shadow-[0_20px_60px_rgba(111,0,23,0.05)] sm:p-8 lg:p-10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#c1123f] sm:text-[13px]">
            Terms of Service
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-black sm:text-5xl">
            Terms of Service
          </h1>

          <p className="mt-4 text-base leading-8 text-black/65">
            Effective date: 30 August 2026
          </p>

          <div className="mt-8 space-y-8 text-base leading-8 text-black/68">
            <section>
              <h2 className="text-xl font-semibold tracking-tight text-black">
                1. Overview
              </h2>
              <p className="mt-2">
                These Terms of Service govern access to and use of Close Too You.
                By using the app, you agree to these terms.
              </p>
              <p className="mt-3">
                Close Too You is operated by Digital Strike Media Ltd, a company
                registered in England and Wales (company number 17565891).
              </p>
              <p className="mt-3">
                Close Too You is intended solely for adults aged 18 or over. By
                using the service, you confirm that you are at least 18 years
                old. We use age verification measures to help confirm this, and
                we may deny or suspend access for anyone we reasonably believe
                does not meet this requirement.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight text-black">
                2. Service description
              </h2>
              <p className="mt-2">
                Close Too You is a subscription-based AI chat product that allows
                users to interact with AI companion characters through a web app.
                Features may change over time.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight text-black">
                3. Accounts
              </h2>
              <p className="mt-2">
                You are responsible for the accuracy of the information you
                provide and for maintaining access to your account. You may not
                use the service for unlawful or abusive purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight text-black">
                4. Paid subscriptions
              </h2>
              <p className="mt-2">
                Pro And Unlimited Are Monthly Subscriptions Charged When They
                Begin And Automatically Renewed On The User&apos;s Billing Date Until
                Cancelled. Cancellation Stops Future Renewals, While Paid Access
                Normally Continues Until The End Of The Current Paid Period.
                Failed Subscriptions May Return To Free. Subscription Payments
                Are Generally Non-Refundable Once Paid Access Begins, Except Where
                Required By Law Or Where A Duplicate Or Incorrect Charge Is
                Confirmed. Payments Are Processed By An Approved Third-Party
                Payment Provider. Read The Full{" "}
                <Link className="text-[#c1123f]" href="/refunds-cancellation">
                  Refund And Cancellation Policy
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight text-black">
                5. Acceptable use
              </h2>
              <div className="mt-2 space-y-2">
                <p>You agree not to:</p>
                <p>• misuse, disrupt, reverse engineer, or abuse the service</p>
                <p>
                  • use the service for unlawful, harmful, or fraudulent
                  activity
                </p>
                <p>• attempt unauthorised access to accounts, systems, or data</p>
                <p>• use the app in violation of applicable laws or regulations</p>
              </div>
            </section>

            <section id="prohibited-content" className="scroll-mt-24">
              <h2 className="text-xl font-semibold tracking-tight text-black">
                Prohibited Adult Content
              </h2>
              <p className="mt-2">
                Consensual Adult Conversation With A Fictional Adult Companion
                May Be Available On Eligible Plans. The Following Content Is
                Not Allowed:
              </p>
              <ul className="mt-3 space-y-2">
                {PROHIBITED_CONTENT_RULES.map((rule) => (
                  <li key={rule}>• {rule}</li>
                ))}
              </ul>
              <p className="mt-3">
                Prohibited Requests Are Blocked. Three Prohibited Requests
                Within 24 Hours Temporarily Disable Spicy Chat And Spicy Images
                For 24 Hours. Normal Companion Chat Remains Available.
              </p>
            </section>

            <section id="complaints-and-appeals" className="scroll-mt-24">
              <h2 className="text-xl font-semibold tracking-tight text-black">
                6. Complaints, content removal &amp; appeals
              </h2>
              <p className="mt-2">
                If You Believe Content On Close Too You Is Illegal,
                Non-Consensual, Infringes Your Rights, Or Otherwise Needs To Be
                Removed, Report It Through The{" "}
                <Link className="text-[#c1123f]" href="/report-problem">
                  Report A Problem
                </Link>{" "}
                Form, Or By Emailing{" "}
                <span className="font-semibold">digitalstrikesupport@gmail.com</span>.
              </p>
              <p className="mt-3">
                We Review And Respond To All Complaints And Content Removal
                Requests Within 5 Business Days Of Receiving Them.
              </p>
              <p className="mt-3">
                If You Disagree With Our Decision, You May Request An
                Independent Review By A Neutral Third Party At The
                Merchant&apos;s Expense. Contact Us Using The Details Above To
                Request This.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight text-black">
                7. AI-generated content
              </h2>
              <p className="mt-2">
                Responses are generated by AI and may be inaccurate, incomplete,
                or inappropriate in some situations. You should not rely on the
                service for medical, legal, financial, or emergency advice.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight text-black">
                8. Availability
              </h2>
              <p className="mt-2">
                We may update, suspend, or discontinue features at any time. We
                do not guarantee uninterrupted availability.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight text-black">
                9. Limitation of liability
              </h2>
              <p className="mt-2">
                To the maximum extent permitted by law, Close Too You is provided
                on an “as is” and “as available” basis without warranties of any
                kind. We are not liable for indirect, incidental, or
                consequential losses arising from use of the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight text-black">
                10. Account Deletion
              </h2>
              <p className="mt-2">
                A Signed-In User May Permanently Delete Their Account From The
                Plans Or Billing Page. Deletion Is Immediate And Irreversible.
                Any Active Subscription Is Cancelled Immediately, Remaining Paid
                Access Ends, The User Is Signed Out, And Associated Account Data,
                Conversations, Messages, Settings, Usage Records, Push Tokens,
                And Stored Account Files Are Deleted.
              </p>
              <p className="mt-3">
                Immediate Account Deletion Does Not Normally Provide A Refund
                For Remaining Paid Time, Except Where Required By Law. Users Who
                Want To Keep Access Until The End Of The Current Paid Period
                Should Cancel The Subscription First And Delete The Account Once
                It Has Returned To Free.
              </p>
              <p className="mt-3">
                Limited Records May Be Retained Where Required For Legal, Tax,
                Accounting, Fraud-Prevention, Safety, Dispute, Or Regulatory
                Purposes. Third-Party Payment Providers May Retain Transaction
                Records Under Their Own Legal Duties And Policies.
              </p>
              <Link
                className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-[#b10f38] px-6 py-3 text-sm text-white"
                href="/upgrade"
              >
                Open Plans And Account Controls
              </Link>
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight text-black">
                11. Governing law
              </h2>
              <p className="mt-2">
                These Terms are governed by the laws of England and Wales. Any
                disputes arising from these Terms or your use of the service
                will be subject to the exclusive jurisdiction of the courts of
                England and Wales.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight text-black">
                12. Contact
              </h2>
              <p className="mt-2">For support or legal questions, contact:</p>
              <p className="mt-2 break-all font-semibold text-[#c1123f]">
                digitalstrikesupport@gmail.com
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
