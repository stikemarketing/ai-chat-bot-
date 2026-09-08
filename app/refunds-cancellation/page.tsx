import Link from "next/link";

const SUPPORT_EMAIL = "digitalstrikesupport@gmail.com";

export default function RefundsCancellationPage() {
  return (
    <main className="min-h-screen bg-[#f7eeee] px-4 py-6 text-[#111111] sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row">
          <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#b10f38] px-6 py-3 text-sm text-white" href="/app">
            Back To Chat
          </Link>
          <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#b10f38] px-6 py-3 text-sm text-white" href="/upgrade">
            View Or Change Plans
          </Link>
        </div>

        <section className="rounded-[2rem] border border-[#c1123f]/10 bg-white/72 p-6 shadow-[0_20px_60px_rgba(111,0,23,0.05)] sm:p-8 lg:p-10">
          <p className="text-[12px] uppercase tracking-[0.24em] text-[#c1123f] sm:text-[13px]">
            Billing Policy
          </p>
          <h1 className="mt-3 text-4xl tracking-[-0.04em] text-black sm:text-5xl">
            Refund And Cancellation Policy
          </h1>
          <p className="mt-4 text-base leading-8 text-black/65">
            Effective Date: 30 August 2026
          </p>

          <div className="mt-8 space-y-8 text-base leading-8 text-black/68">
            <section>
              <h2 className="text-xl tracking-tight text-black">Monthly Subscriptions</h2>
              <p className="mt-2">
                Pro And Unlimited Are Monthly Subscriptions. The Displayed Monthly
                Price Is Charged When The Subscription Starts And Automatically
                Renews On The User&apos;s Billing Date Each Month Until Cancelled.
              </p>
            </section>

            <section>
              <h2 className="text-xl tracking-tight text-black">Upgrades And Downgrades</h2>
              <p className="mt-2">
                An Upgrade From Pro To Unlimited Takes Effect Immediately. The
                Payment Provider May Apply A Prorated Charge Or Credit For The
                Remaining Current Billing Period. A Downgrade From Unlimited To
                Pro Takes Effect At The End Of The Current Paid Billing Period,
                And The Next Billing Period Uses The Pro Price.
              </p>
            </section>

            <section>
              <h2 className="text-xl tracking-tight text-black">Cancelling A Subscription</h2>
              <p className="mt-2">
                Users Can Cancel A Paid Plan From The Billing Page. Cancellation
                Stops Future Renewal Charges. Paid Features Remain Available Until
                The End Of The Current Paid Billing Period, Then The Account
                Returns To Free.
              </p>
            </section>

            <section>
              <h2 className="text-xl tracking-tight text-black">Failed Payments</h2>
              <p className="mt-2">
                If A Renewal Payment Fails, The Payment Provider May Retry The
                Payment. If The Subscription Is Ultimately Marked Unpaid,
                Cancelled, Or Expired, Paid Access Ends And The Account Returns To
                Free Until A New Paid Subscription Is Successfully Started.
              </p>
            </section>

            <section>
              <h2 className="text-xl tracking-tight text-black">Refunds</h2>
              <p className="mt-2">
                Subscription Payments Are Generally Non-Refundable Once Paid
                Access Has Begun. Cancelling Normally Stops The Next Renewal And
                Does Not Refund The Current Paid Period. This Does Not Affect Any
                Statutory Rights The User May Have.
              </p>
            </section>

            <section>
              <h2 className="text-xl tracking-tight text-black">Duplicate Or Incorrect Charges</h2>
              <p className="mt-2">
                Suspected Duplicate, Accidental, Or Incorrect Charges Will Be
                Investigated. A Confirmed Duplicate Or Incorrect Charge Will Be
                Refunded Where Appropriate. Include The Account Email, Charge
                Date, Amount, And Payment Reference When Contacting Support. Never
                Send A Full Card Number, Password, Or Security Code.
              </p>
            </section>

            <section>
              <h2 className="text-xl tracking-tight text-black">Billing Support</h2>
              <p className="mt-2">
                For Cancellation, Refund, Or Payment Questions, Contact:
              </p>
              <a
                className="preserve-case mt-2 inline-block break-all text-[#c1123f]"
                href={`mailto:${SUPPORT_EMAIL}`}
              >
                {SUPPORT_EMAIL}
              </a>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
