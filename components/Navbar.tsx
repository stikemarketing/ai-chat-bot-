"use client";

import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import { auth } from "@/firebase/config";

type NavLink = {
  href: string;
  label: string;
};

const navLinks: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/characters", label: "Companions" },
  { href: "/upgrade", label: "Upgrade" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      setIsSignedIn(Boolean(firebaseUser));
    });
  }, []);

  const visibleLinks = useMemo(
    () => [
      ...navLinks,
      isSignedIn
        ? { href: "/app", label: "Open App" }
        : { href: "/signup?mode=signin", label: "Sign in" },
    ],
    [isSignedIn]
  );

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[#f7eeee]/92 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              data-ui-control="icon"
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((prev) => !prev)}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-sm transition hover:bg-black/[0.03] lg:hidden"
            >
              <span className="relative block h-4 w-5">
                <span
                  className={`absolute left-0 top-0 h-0.5 w-5 rounded-full bg-black transition ${
                    menuOpen ? "top-[7px] rotate-45" : ""
                  }`}
                />
                <span
                  className={`absolute left-0 top-[7px] h-0.5 w-5 rounded-full bg-black transition ${
                    menuOpen ? "opacity-0" : ""
                  }`}
                />
                <span
                  className={`absolute left-0 top-[14px] h-0.5 w-5 rounded-full bg-black transition ${
                    menuOpen ? "top-[7px] -rotate-45" : ""
                  }`}
                />
              </span>
            </button>

            <Link
              href="/"
              data-ui-heading
              className="text-lg font-semibold tracking-tight text-black sm:text-xl"
            >
              Close Too You
            </Link>
          </div>

          <nav className="hidden items-center gap-7 lg:flex">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  link.label === "Open App" || link.label === "Sign in"
                    ? "inline-flex min-h-10 items-center justify-center rounded-full bg-[#b10f38] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#970d31]"
                    : "text-sm font-medium text-black/78 transition hover:text-[#c1123f]"
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {menuOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/18 lg:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute left-4 right-4 top-24 rounded-[1.75rem] border border-black/8 bg-white p-4 shadow-[0_24px_80px_rgba(0,0,0,0.12)]"
            onClick={(event) => event.stopPropagation()}
          >
            <nav className="flex flex-col gap-2">
              {visibleLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={
                    link.label === "Open App" || link.label === "Sign in"
                      ? "mt-2 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#b10f38] px-4 py-3 text-base font-semibold text-white transition hover:bg-[#970d31]"
                      : "inline-flex min-h-12 items-center rounded-2xl px-4 py-3 text-base font-medium text-black/78 transition hover:bg-black/[0.04] hover:text-[#c1123f]"
                  }
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
