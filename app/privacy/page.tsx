// app/privacy/page.tsx
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href="/" className="text-sm text-zinc-400 hover:text-white">
            ← Back to home
          </Link>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
            Privacy Policy
          </p>

          <h1 className="mt-3 text-4xl font-bold">Privacy Policy</h1>

          <p className="mt-4 text-sm leading-7 text-zinc-300">
            Effective date: 4 May 2026
          </p>

          <div className="mt-8 space-y-8 text-sm leading-7 text-zinc-300">
            <section>
              <h2 className="text-lg font-semibold text-white">1. Overview</h2>
              <p className="mt-2">
                AI Companion collects and processes limited user information to
                provide account access, chat functionality, subscription access,
                and support. By using the service, you agree to this policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">
                2. Information we collect
              </h2>
              <div className="mt-2 space-y-2">
                <p>We may collect:</p>
                <p>• account details such as name, email address, and timezone</p>
                <p>• chat content submitted through the app</p>
                <p>• saved message history linked to your account</p>
                <p>• subscription and billing status information</p>
                <p>• basic technical and usage information needed to operate the service</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">
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
              <h2 className="text-lg font-semibold text-white">
                4. Payments
              </h2>
              <p className="mt-2">
                Paid subscriptions are processed through third-party payment
                providers such as Stripe. We do not store full card details on
                our own servers.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">
                5. Data storage
              </h2>
              <p className="mt-2">
                User account information, chat history, and plan data may be
                stored in third-party infrastructure used to operate the app.
                We take reasonable steps to protect stored information, but no
                online service can guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">
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
              <h2 className="text-lg font-semibold text-white">
                7. Your choices
              </h2>
              <p className="mt-2">
                You may contact us to request account help, data correction, or
                account deletion, subject to any legal or operational retention
                requirements.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">
                8. Contact
              </h2>
              <p className="mt-2">
                For privacy questions, contact:
              </p>
              <p className="mt-2 font-semibold text-white break-all">
                digitalstrikemarketing@outlook.com
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
