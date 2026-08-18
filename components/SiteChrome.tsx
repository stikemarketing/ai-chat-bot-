"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function SiteChrome({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isAppRoute = pathname === "/app" || pathname.startsWith("/app/");

  return (
    <>
      {isAppRoute ? null : <Navbar />}
      {children}
    </>
  );
}