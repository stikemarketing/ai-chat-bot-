// app/privacy/page.tsx
import Link from "next/link";

export default function PrivacyPage() {
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
            Privacy Policy
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-black sm:text-5xl">
            Privacy Policy
          </h1>

          <p className="mt-4 text-base leading-8 text-black/65">
            Effective Date: 30 August 2026
          </p>

          <div className="mt-8 space-y-8 text-base leading-8 text-black/68">
            <section>
              <h2 className="text-xl font-semibold tracking-tight text-black">
                1. Overview
              </h2>
              <p className="mt-2">
                Close Too You collects and processes limited user information to
                provide account access, chat functionality, subscription access,
                and support. By using the service, you agree to this policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight text-black">
                2. Information we collect
              </h2>
              <div className="mt-2 space-y-2">
                <p>We may collect:</p>
                <p>• account details such as name, email address, and timezone</p>
                <p>• chat content submitted through the app</p>
                <p>• saved message history linked to your account</p>
                <p>• subscription and billing status information</p>
                <p>
                  • basic technical and usage information needed to operate the
                  service
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight text-black">
                3. How we use information
              </h2>
              <div className="mt-2 space-y-2">
                <p>We use information to:</p>
                <p>• create and manage user accounts</p>
                <p>• provide AI chat and saved conversation features</p>
                <p>• manage free and paid plan access</p>
                <p>• improve product quality, reliability, and safety</p>
                <p>• respond to support requests and account issues</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight text-black">
                4. Payments
              </h2>
              <p className="mt-2">
                Paid Subscriptions Are Processed Through An Approved Third-Party
                Payment Provider. We Do Not Store Full Card Details On Our Own
                Servers.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight text-black">
                5. Data storage
              </h2>
              <p className="mt-2">
                User account information, chat history, and plan data may be
                stored in third-party infrastructure used to operate the app. We
                take reasonable steps to protect stored information, but no
                online service can guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight text-black">
                6. Sharing
              </h2>
              <p className="mt-2">
                We do not sell personal information. We may share limited data
                with service providers that help us run the app, such as hosting,
                database, analytics, and payment providers, where needed for
                operation of the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight text-black">
                7. Your choices
              </h2>
              <p className="mt-2">
                You may contact us to request account help, data correction, or
                account deletion, subject to any legal or operational retention
                requirements.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight text-black">
                8. Account And Data Deletion
              </h2>
              <p className="mt-2">
                Signed-In Users Can Permanently Delete Their Account From The
                Plans Or Billing Page. Immediate Deletion Cancels Any Active
                Subscription, Ends Access, Signs The User Out, And Deletes The
                Firebase Account Together With Associated Conversations,
                Messages, Settings, Usage Records, Push Tokens, And Stored
                Account Files. Permanent Deletion Cannot Be Undone.
              </p>
              <p className="mt-3">
                Limited Information May Be Retained Where Necessary To Meet A
                Legal, Tax, Accounting, Fraud-Prevention, Safety, Dispute, Or
                Regulatory Obligation. Payment Providers May Also Retain Their
                Own Transaction Records Under Their Separate Legal Duties And
                Privacy Policies. Support And Complaint Records May Be Retained
                For As Long As Reasonably Needed To Investigate And Resolve The
                Matter.
              </p>
              <p className="mt-3">
                Users Who Want To Keep Paid Access Until The End Of Their Current
                Billing Period Should Cancel Their Subscription First And Delete
                The Account After It Returns To Free.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight text-black">
                9. Contact
              </h2>
              <p className="mt-2">For privacy questions, contact:</p>
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
