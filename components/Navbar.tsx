// components/Navbar.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { clearUser, getUser, type StoredUser } from "@/lib/user";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setUser(getUser());
  }, []);

  if (pathname === "/") {
    return null;
  }

  function handleReset() {
    clearUser();
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-black/5 bg-white/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-lg font-semibold tracking-[-0.02em] text-zinc-950"
        >
          AI Companion
        </Link>

        <nav className="flex items-center gap-4 text-sm text-zinc-600">
          <Link href="/" className="transition hover:text-zinc-950">
            Home
          </Link>
          <Link href="/characters" className="transition hover:text-zinc-950">
            Characters
          </Link>
          <Link href="/upgrade" className="transition hover:text-zinc-950">
            Upgrade
          </Link>

          {mounted && user ? (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
            >
              Reset user
            </button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}