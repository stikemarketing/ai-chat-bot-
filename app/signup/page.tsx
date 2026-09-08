"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { characters } from "@/lib/characters";
import { auth } from "@/firebase/config";
import {
  clearUser,
  getUser,
  getUserWithFirestoreFallback,
  saveUser,
  type StoredUser,
} from "@/lib/user";
import { getUserFromFirestore, saveUserToFirestore } from "@/firebase/users";

const characterImages: Record<string, string> = {
  luna: "/companions/luna-main.png",
  ivy: "/companions/ivy-main.png",
  sienna: "/companions/sienna-main.png",
};

const PENDING_CHARACTER_KEY = "ai-companion-pending-character";
const PENDING_NAME_KEY = "ai-companion-pending-name";
type EntrySource = "web" | "app";

function savePendingCharacter(characterId: string) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(PENDING_CHARACTER_KEY, characterId);
}

function getPendingCharacter() {
  if (typeof window === "undefined") {
    return null;
  }

  const characterId = localStorage.getItem(PENDING_CHARACTER_KEY);

  return characters.some((character) => character.id === characterId)
    ? characterId
    : null;
}

function clearPendingCharacter() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(PENDING_CHARACTER_KEY);
}

function savePendingName(name: string) {
  if (typeof window === "undefined") {
    return;
  }

  const trimmedName = name.trim();

  if (trimmedName) {
    localStorage.setItem(PENDING_NAME_KEY, trimmedName);
  }
}

function getPendingName() {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem(PENDING_NAME_KEY)?.trim() || "";
}

function clearPendingName() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(PENDING_NAME_KEY);
}

function getCharacterFromUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const characterId = params.get("character");

  const matchingCharacter = characters.find(
    (character) => character.id === characterId
  );

  return matchingCharacter?.id ?? null;
}

function getAccountModeFromUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get("mode") === "signin"
    ? "signin"
    : null;
}

function getEntrySourceFromUrl(): EntrySource {
  if (typeof window === "undefined") {
    return "web";
  }

  return new URLSearchParams(window.location.search).get("source") === "app"
    ? "app"
    : "web";
}

function getPlanLabel(plan: string | null | undefined) {
  if (plan === "unlimited") {
    return "Unlimited";
  }

  if (plan === "pro") {
    return "Pro";
  }

  return "Free";
}

function getCharacterName(characterId: string | null | undefined) {
  const matchingCharacter = characters.find(
    (character) => character.id === characterId
  );

  return matchingCharacter?.name || "Luna";
}

function getFirebaseAuthMessage(error: unknown) {
  const code =
    typeof error === "object" &&
    error &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";

  if (code === "auth/email-already-in-use") {
    return "This email already has an account. Tap Sign in instead.";
  }

  if (code === "auth/invalid-email") {
    return "Please enter a valid email address.";
  }

  if (code === "auth/weak-password") {
    return "Please use a stronger password with at least 6 characters.";
  }

  if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
    return "The email or password is incorrect.";
  }

  if (code === "auth/user-not-found") {
    return "No account was found for that email. Tap Create account instead.";
  }

  return "Something went wrong with your account. Please try again.";
}

function getSafeDisplayName(params: {
  accountMode: "signup" | "signin";
  typedName: string;
  existingFirestoreUser: StoredUser | null;
  existingBrowserUser: StoredUser | null;
  email: string;
}) {
  const trimmedName = params.typedName.trim();

  if (trimmedName) {
    return trimmedName;
  }

  if (params.existingFirestoreUser?.name) {
    return params.existingFirestoreUser.name;
  }

  if (params.existingBrowserUser?.name) {
    return params.existingBrowserUser.name;
  }

  return params.email;
}

export default function SignupPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [existingUser, setExistingUser] = useState<StoredUser | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState("luna");
  const [hasChosenCharacter, setHasChosenCharacter] = useState(false);
  const [entrySource, setEntrySource] = useState<EntrySource>("web");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountMode, setAccountMode] = useState<"signup" | "signin">(
    "signup"
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"error" | "success" | "info">("info");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isLoadingExistingUser, setIsLoadingExistingUser] = useState(true);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [aiDisclosureAccepted, setAiDisclosureAccepted] = useState(false);

  useEffect(() => {
    async function loadExistingUser() {
      try {
        setMounted(true);

        const characterFromUrl = getCharacterFromUrl();
        const pendingCharacter = getPendingCharacter();
        const requestedAccountMode = getAccountModeFromUrl();
        const source = getEntrySourceFromUrl();
        const initialCharacterId =
          characterFromUrl || pendingCharacter || "luna";

        setEntrySource(source);
        setHasChosenCharacter(Boolean(characterFromUrl || pendingCharacter));
        setSelectedCharacterId(initialCharacterId);

        if (requestedAccountMode === "signin") {
          setAccountMode("signin");
        } else if (!characterFromUrl && !pendingCharacter) {
          router.replace("/characters");
          return;
        }

        if (characterFromUrl) {
          savePendingCharacter(characterFromUrl);
        }

        const savedUser = await getUserWithFirestoreFallback();
        setExistingUser(savedUser);

        if (savedUser?.name) {
          setName(savedUser.name);
        } else {
          const pendingName = getPendingName();

          if (pendingName) {
            setName(pendingName);
          }
        }

        if (savedUser?.email) {
          setEmail(savedUser.email);
        }
      } catch (error) {
        console.error("Failed to load existing user:", error);
        setExistingUser(getUser());
      } finally {
        setIsLoadingExistingUser(false);
      }
    }

    loadExistingUser();
  }, [router]);

  const selectedCharacter = useMemo(() => {
    return (
      characters.find((character) => character.id === selectedCharacterId) ??
      characters[0]
    );
  }, [selectedCharacterId]);

  const existingUserCharacter = useMemo(() => {
    if (!existingUser?.selectedCharacter) {
      return null;
    }

    return (
      characters.find(
        (character) => character.id === existingUser.selectedCharacter
      ) ?? null
    );
  }, [existingUser]);

  const activeCharacter = existingUserCharacter || selectedCharacter;

  const imageSrc =
    characterImages[activeCharacter.id] ?? "/companions/luna-main.png";

  const existingUserCharacterName = getCharacterName(
    existingUser?.selectedCharacter
  );

  const hasExistingUserDifferentFromUrl =
    Boolean(existingUser?.selectedCharacter) &&
    existingUser?.selectedCharacter !== selectedCharacter.id;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (accountMode === "signup" && !trimmedName) {
      setStatusTone("error");
      setStatusMessage(
        "Please enter the name you’d like your companion to call you."
      );
      return;
    }

    if (
      accountMode === "signup" &&
      (!adultConfirmed || !legalAccepted || !aiDisclosureAccepted)
    ) {
      setStatusTone("error");
      setStatusMessage(
        "Please Confirm That You Are 18 Or Over And Accept The Required Terms Before Creating Your Account."
      );
      return;
    }

    if (!trimmedEmail) {
      setStatusTone("error");
      setStatusMessage("Please enter your email address.");
      return;
    }

    if (!trimmedPassword || trimmedPassword.length < 6) {
      setStatusTone("error");
      setStatusMessage("Please enter a password with at least 6 characters.");
      return;
    }

    try {
      setIsCreatingUser(true);
      setStatusTone("info");
      setStatusMessage("");

      if (accountMode === "signup") {
        const authResult = await createUserWithEmailAndPassword(
          auth,
          trimmedEmail,
          trimmedPassword
        );

        if (authResult.user.displayName !== trimmedName) {
          await updateProfile(authResult.user, {
            displayName: trimmedName,
          });
        }

        const confirmationToken = await authResult.user.getIdToken();
        const confirmationResponse = await fetch("/api/age-assurance/accept", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${confirmationToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            adultConfirmed: true,
            termsAccepted: true,
            privacyAccepted: true,
            aiDisclosureAccepted: true,
          }),
        });
        if (!confirmationResponse.ok) {
          const confirmationData = (await confirmationResponse.json()) as {
            error?: string;
          };
          throw new Error(
            confirmationData.error ||
              "Your Account Confirmations Could Not Be Saved."
          );
        }

        savePendingCharacter(selectedCharacter.id);
        savePendingName(trimmedName);

        await sendEmailVerification(authResult.user);
        await signOut(auth);
        clearUser();

        setExistingUser(null);
        setPassword("");
        setAccountMode("signin");
        setStatusTone("success");
        setStatusMessage(
          "Check your email 💌 We’ve sent you a verification link. Please click it, then come back here and sign in with the same email and password."
        );
        return;
      }

      const authResult = await signInWithEmailAndPassword(
        auth,
        trimmedEmail,
        trimmedPassword
      );

      if (!authResult.user.emailVerified) {
        await sendEmailVerification(authResult.user);
        await signOut(auth);
        clearUser();

        setExistingUser(null);
        setPassword("");
        setStatusTone("info");
        setStatusMessage(
          "Please check your email 💌 We’ve sent you a fresh verification link. Click it, then come back here and sign in."
        );
        return;
      }

      const existingFirestoreUser = await getUserFromFirestore(
        authResult.user.uid
      );

      const pendingCharacterId =
        getPendingCharacter() || selectedCharacter.id;

      const pendingName = getPendingName();

      const safeDisplayName = getSafeDisplayName({
        accountMode,
        typedName: pendingName || trimmedName,
        existingFirestoreUser,
        existingBrowserUser: existingUser,
        email: trimmedEmail,
      });

      if (authResult.user.displayName !== safeDisplayName) {
        await updateProfile(authResult.user, {
          displayName: safeDisplayName,
        });
      }

      const authenticatedUser: StoredUser = existingFirestoreUser
        ? {
            id: authResult.user.uid,
            name: existingFirestoreUser.name || safeDisplayName,
            email: existingFirestoreUser.email || trimmedEmail,
            selectedCharacter:
              existingFirestoreUser.selectedCharacter || pendingCharacterId,
            timezone:
              existingFirestoreUser.timezone ||
              Intl.DateTimeFormat().resolvedOptions().timeZone ||
              "Europe/London",
            plan: existingFirestoreUser.plan || "free",
            trialActive: existingFirestoreUser.trialActive ?? true,
          }
        : {
            id: authResult.user.uid,
            name: safeDisplayName,
            email: trimmedEmail,
            selectedCharacter: pendingCharacterId,
            timezone:
              Intl.DateTimeFormat().resolvedOptions().timeZone ||
              "Europe/London",
            plan: "free",
            trialActive: true,
          };

      saveUser(authenticatedUser);
      await saveUserToFirestore(authenticatedUser);
      clearPendingCharacter();
      clearPendingName();

      setExistingUser(authenticatedUser);
      if (!authenticatedUser.adultVerified) {
        const verificationParams = new URLSearchParams({
          source: entrySource,
          character: authenticatedUser.selectedCharacter,
        });
        router.replace(`/age-verification?${verificationParams.toString()}`);
        return;
      }

      const chatPath =
        entrySource === "app"
          ? `/app/chat/${authenticatedUser.selectedCharacter}`
          : `/chat/${authenticatedUser.selectedCharacter}`;

      router.replace(chatPath);
    } catch (error) {
      console.error("Failed to create/sign in user:", error);
      setStatusTone("error");
      setStatusMessage(getFirebaseAuthMessage(error));
    } finally {
      setIsCreatingUser(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7eeee] px-4 py-6 text-[#111111] sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8">
          <Link
            href="/characters"
            className="text-sm font-medium text-black/50 transition hover:text-[#c1123f]"
          >
            ← Back to companions
          </Link>
        </div>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
          <div className="overflow-hidden rounded-[2rem] border border-[#c1123f]/10 bg-white shadow-[0_20px_60px_rgba(111,0,23,0.05)]">
            <div className="relative aspect-[4/4.8] w-full overflow-hidden lg:h-full lg:min-h-[620px] lg:aspect-auto">
              <Image
                src={imageSrc}
                alt={activeCharacter.name}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 45vw"
                priority
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/18 to-transparent" />

              <div className="absolute left-5 top-5">
                <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-black shadow-sm backdrop-blur">
                  {activeCharacter.mood}
                </span>
              </div>

              <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-white/75">
                  {existingUser
                    ? "Your saved companion"
                    : "Your selected companion"}
                </p>

                <h1 className="mt-2 text-5xl font-semibold tracking-[-0.05em] text-white">
                  {activeCharacter.name}
                </h1>

                <p className="mt-3 max-w-md text-base leading-7 text-white/78">
                  {activeCharacter.bio}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#c1123f]/10 bg-white/72 p-6 shadow-[0_20px_60px_rgba(111,0,23,0.05)] sm:p-8 lg:p-10">
            <div className="space-y-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#c1123f] sm:text-[13px]">
                {accountMode === "signin" ? "Welcome back" : "Create account"}
              </p>

              <h2 className="text-4xl font-semibold tracking-[-0.04em] text-black sm:text-5xl">
                {accountMode === "signin"
                  ? "Sign in to your account"
                  : `Start chatting with ${selectedCharacter.name}`}
              </h2>

              <p className="max-w-2xl text-base leading-8 text-black/65 sm:text-lg">
                {accountMode === "signin"
                  ? "Use the same email and password you created before. Your companion, plan, and chat history will load from your account."
                  : "Create your secure login. You’ll start on Free, then you can upgrade to Pro or Unlimited whenever you’re ready."}
              </p>
            </div>

            {mounted && isLoadingExistingUser ? (
              <div className="mt-8 rounded-[1.5rem] border border-[#c1123f]/8 bg-[#fff8f8] px-5 py-4 text-sm leading-7 text-black/70">
                Checking this browser for a saved account...
              </div>
            ) : null}

            {mounted && !isLoadingExistingUser && existingUser ? (
              <div className="mt-8 space-y-4">
                <div className="rounded-[1.5rem] border border-[#c1123f]/8 bg-[#fff8f8] px-5 py-4 text-sm leading-7 text-black/70">
                  <p>
                    This browser was last linked to{" "}
                    <span className="font-semibold text-black">
                      {existingUserCharacterName}
                    </span>{" "}
                    on the{" "}
                    <span className="font-semibold text-black">
                      {getPlanLabel(existingUser.plan)}
                    </span>{" "}
                    plan.
                  </p>

                  <p className="mt-2">
                    Sign in to load that account, or create a new account with a
                    different email.
                  </p>
                </div>

                {hasExistingUserDifferentFromUrl ? (
                  <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-7 text-amber-900">
                    You opened signup for{" "}
                    <span className="font-semibold">
                      {selectedCharacter.name}
                    </span>
                    , but this browser was last linked to{" "}
                    <span className="font-semibold">
                      {existingUserCharacterName}
                    </span>
                    .
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-8 grid grid-cols-2 gap-2 rounded-full border border-[#c1123f]/10 bg-white p-1">
              <button
                type="button"
                onClick={() => {
                  if (!hasChosenCharacter) {
                    router.push("/characters");
                    return;
                  }

                  setAccountMode("signup");
                  setStatusTone("info");
                  setStatusMessage("");
                }}
                className={`min-h-11 rounded-full text-sm font-semibold transition ${
                  accountMode === "signup"
                    ? "bg-[#b10f38] text-white"
                    : "text-black/55 hover:bg-[#fff7f8]"
                }`}
              >
                Create account
              </button>

              <button
                type="button"
                onClick={() => {
                  setAccountMode("signin");
                  setStatusTone("info");
                  setStatusMessage("");
                }}
                className={`min-h-11 rounded-full text-sm font-semibold transition ${
                  accountMode === "signin"
                    ? "bg-[#b10f38] text-white"
                    : "text-black/55 hover:bg-[#fff7f8]"
                }`}
              >
                Sign in
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {accountMode === "signup" ? (
                <div>
                  <label
                    htmlFor="name"
                    className="text-sm font-semibold text-black"
                  >
                    What would you like your companion to call you?
                  </label>

                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Enter the name you’d like them to use"
                    className="mt-2 min-h-12 w-full rounded-2xl border border-[#c1123f]/12 bg-white px-4 py-3 text-base text-black outline-none transition placeholder:text-black/35 focus:border-[#c1123f]/35 focus:ring-4 focus:ring-[#c1123f]/8"
                  />
                </div>
              ) : null}

              <div>
                <label
                  htmlFor="email"
                  className="text-sm font-semibold text-black"
                >
                  Email address
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-[#c1123f]/12 bg-white px-4 py-3 text-base text-black outline-none transition placeholder:text-black/35 focus:border-[#c1123f]/35 focus:ring-4 focus:ring-[#c1123f]/8"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="text-sm font-semibold text-black"
                >
                  Password
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimum 6 characters"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-[#c1123f]/12 bg-white px-4 py-3 text-base text-black outline-none transition placeholder:text-black/35 focus:border-[#c1123f]/35 focus:ring-4 focus:ring-[#c1123f]/8"
                />
              </div>

              <div className="rounded-[1.5rem] border border-[#c1123f]/8 bg-[#fff8f8] p-5">
                <p className="text-sm font-semibold text-black">
                  {accountMode === "signin"
                    ? "What happens when you sign in"
                    : "Your first companion"}
                </p>

                <p className="mt-2 text-base leading-7 text-black/65">
                  {accountMode === "signin" ? (
                    <>
                      We’ll load the companion, plan, and chat history connected
                      to your account.
                    </>
                  ) : (
                    <>
                      You’re starting with{" "}
                      <span className="font-semibold text-black">
                        {selectedCharacter.name}
                      </span>
                      . For now, each account stays connected to one companion.
                    </>
                  )}
                </p>
              </div>

              {accountMode === "signup" ? (
                <fieldset className="space-y-3 rounded-[1.5rem] border border-[#c1123f]/10 bg-white p-5">
                  <legend className="px-1 text-sm text-black">
                    Adult Account Confirmation
                  </legend>

                  <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-black/70">
                    <input
                      type="checkbox"
                      checked={adultConfirmed}
                      onChange={(event) => setAdultConfirmed(event.target.checked)}
                      className="mt-1 h-5 w-5 accent-[#b10f38]"
                    />
                    <span>I Confirm That I Am At Least 18 Years Old.</span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-black/70">
                    <input
                      type="checkbox"
                      checked={legalAccepted}
                      onChange={(event) => setLegalAccepted(event.target.checked)}
                      className="mt-1 h-5 w-5 accent-[#b10f38]"
                    />
                    <span>
                      I Accept The <Link href="/terms" className="text-[#b10f38]">Terms</Link>{" "}
                      And <Link href="/privacy" className="text-[#b10f38]">Privacy Policy</Link>.
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-black/70">
                    <input
                      type="checkbox"
                      checked={aiDisclosureAccepted}
                      onChange={(event) =>
                        setAiDisclosureAccepted(event.target.checked)
                      }
                      className="mt-1 h-5 w-5 accent-[#b10f38]"
                    />
                    <span>
                      I Understand That The Companions, Conversations And
                      Images Are Generated By Artificial Intelligence And Are
                      Not Real People.
                    </span>
                  </label>
                </fieldset>
              ) : null}

              {statusMessage ? (
                <div
                  className={`rounded-[1.5rem] border px-5 py-4 text-sm leading-6 shadow-sm ${
                    statusTone === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : statusTone === "info"
                      ? "border-[#c1123f]/10 bg-[#fff8f8] text-black/72"
                      : "border-[#c1123f]/12 bg-[#fff4f6] text-[#8f0d2f]"
                  }`}
                >
                  <p className="font-semibold">
                    {statusTone === "success"
                      ? "Verification email sent"
                      : statusTone === "info"
                      ? "Check your email"
                      : "Something needs your attention"}
                  </p>
                  <p className="mt-1">{statusMessage}</p>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={Boolean(isCreatingUser || isLoadingExistingUser)}
                className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#b10f38] px-7 py-3 font-semibold transition hover:bg-[#970d31] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="text-base text-white">
                  {isCreatingUser
                    ? accountMode === "signin"
                      ? "Signing in..."
                      : "Creating account..."
                    : accountMode === "signin"
                    ? "Sign in and continue"
                    : `Create account and chat with ${selectedCharacter.name}`}
                </span>
              </button>

              <p className="text-center text-xs leading-6 text-black/45">
                {accountMode === "signin"
                  ? "Already upgraded? Sign in with the same email to restore your plan."
                  : "You’ll start on the Free plan. Paid plans are connected to your login after checkout."}
              </p>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
