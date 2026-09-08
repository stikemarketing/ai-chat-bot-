"use client";

import { signOut } from "firebase/auth";
import { useState } from "react";
import { auth } from "@/firebase/config";
import { clearUser, waitForFirebaseAuthUser } from "@/lib/user";

type DeleteAccountResponse = {
  ok?: boolean;
  error?: string;
  reauthenticationRequired?: boolean;
};

export default function AccountDeletionPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [acceptedLoss, setAcceptedLoss] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  function closeConfirmation() {
    if (isDeleting) return;
    setIsOpen(false);
    setConfirmation("");
    setAcceptedLoss(false);
    setError("");
  }

  async function deleteAccount() {
    try {
      setIsDeleting(true);
      setError("");
      const firebaseUser = auth.currentUser || (await waitForFirebaseAuthUser());

      if (!firebaseUser) {
        throw new Error("Please Sign In Again Before Deleting Your Account.");
      }

      const token = await firebaseUser.getIdToken(true);
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          confirmation,
          acceptImmediateLoss: acceptedLoss,
        }),
      });
      const data = (await response.json()) as DeleteAccountResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Your Account Could Not Be Deleted.");
      }

      clearUser();
      await signOut(auth).catch(() => undefined);
      window.location.replace("/");
    } catch (deletionError) {
      setError(
        deletionError instanceof Error
          ? deletionError.message
          : "Your Account Could Not Be Deleted."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="mt-6 rounded-[1.75rem] border border-[#c1123f]/16 bg-[#fff5f7] p-5 sm:p-6">
      <p className="text-[12px] uppercase tracking-[0.22em] text-[#c1123f]">
        Permanent Account Deletion
      </p>
      <h2 className="mt-3 text-2xl tracking-[-0.03em] text-black">Delete Your Account</h2>
      <p className="mt-3 text-sm leading-7 text-black/65 sm:text-base">
        This Immediately Cancels Any Active Subscription, Ends Paid Access,
        Signs You Out, And Permanently Deletes Your Account, Conversations,
        Messages, Usage Records, Saved Settings, Push Tokens, And Stored Account
        Files. This Cannot Be Undone.
      </p>
      <p className="mt-3 text-sm leading-7 text-black/65 sm:text-base">
        If You Want To Use The Rest Of A Paid Billing Period, Cancel The Plan
        First And Wait Until It Returns To Free Before Deleting The Account.
        Immediate Deletion Does Not Normally Provide A Refund, Except Where
        Required By Law.
      </p>

      <button
        className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-[#b10f38] px-6 py-3 text-white"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        Permanently Delete Account
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8">
            <p className="text-[12px] uppercase tracking-[0.22em] text-[#c1123f]">Final Warning</p>
            <h2 id="delete-account-title" className="mt-3 text-3xl tracking-[-0.03em] text-black">
              This Deletes Everything Now
            </h2>
            <p className="mt-4 text-sm leading-7 text-black/65">
              Any Active Subscription Will Be Cancelled Immediately. Remaining
              Paid Access And All Account Data Will Be Permanently Lost. There Is
              No Undo Button.
            </p>

            <label className="mt-5 flex items-start gap-3 text-sm leading-6 text-black/68">
              <input
                className="mt-1 h-4 w-4"
                type="checkbox"
                checked={acceptedLoss}
                onChange={(event) => setAcceptedLoss(event.target.checked)}
              />
              <span>
                I Understand That My Subscription, Remaining Access, Account And
                Data Will Be Permanently Removed.
              </span>
            </label>

            <label className="mt-5 block text-sm text-black/68">
              <span>Type DELETE To Confirm</span>
              <input
                className="preserve-case mt-2 min-h-12 w-full rounded-[1rem] border border-[#c1123f]/18 bg-white px-4 outline-none focus:border-[#c1123f]/45"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            </label>

            {error ? (
              <p className="mt-4 rounded-[1rem] bg-[#fff0f3] px-4 py-3 text-sm leading-6 text-[#9a0d31]">{error}</p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button data-ui-control className="min-h-12 rounded-full border border-black/10 bg-white px-6 py-3 text-black" type="button" onClick={closeConfirmation} disabled={isDeleting}>
                Keep My Account
              </button>
              <button className="min-h-12 rounded-full bg-[#b10f38] px-6 py-3 text-white disabled:cursor-not-allowed" type="button" onClick={deleteAccount} disabled={isDeleting || !acceptedLoss || confirmation !== "DELETE"}>
                {isDeleting ? "Deleting Account..." : "Delete Everything Permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
