"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearUser, getUser, type StoredUser } from "@/lib/user";

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setUser(getUser());
  }, []);

  function handleReset() {
    clearUser();
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-white/10 bg-black/30 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-lg font-semibold tracking-wide text-white">
          AI Companion
        </Link>

        <nav className="flex items-center gap-4 text-sm text-zinc-300">
          <Link href="/" className="hover:text-white">
            Home
          </Link>
          <Link href="/characters" className="hover:text-white">
            Characters
          </Link>
          <Link href="/upgrade" className="hover:text-white">
            Upgrade
          </Link>

          {mounted && user ? (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-white/15 px-3 py-2 hover:text-white"
            >
              Reset user
            </button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}