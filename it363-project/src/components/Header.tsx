"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = [
    { href: "/", label: "Home" },
    { href: "/about", label: "Our Journey" },
    { href: "/menupage", label: "Menu" },
    { href: "/calendar", label: "Keep Track" }
  ];

  // If we're on an admin route or auth helper pages (forgot password), don't render the header.
  // Also mark header as hidden so the content-wrapper doesn't reserve header space.
  const isAdminRoute =
    typeof pathname === "string" && (
      pathname === "/admin" ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/adminpage") ||
      pathname === "/forgot-password" ||
      pathname.startsWith("/forgot")
    );

  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;

    if (isAdminRoute) {
      root.classList.add("header-hidden");
      root.classList.remove("header-visible");
      return;
    }

    root.classList.add("header-visible");
    root.classList.remove("header-hidden");

    return () => {
      root.classList.remove("header-visible");
      root.classList.remove("header-hidden");
    };
  }, [isAdminRoute]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // header classes: always visible and fixed at top with highest z-index
  const headerClass = "fixed top-0 left-0 right-0 text-white shadow-xl z-50";

  if (isAdminRoute) return null;

  return (
    <header className={headerClass} style={{ height: "var(--header-height)", overflow: "visible" }}>
      <div className="absolute inset-0 bg-gradient-to-r from-[#2e0d0c] via-[#5e1f1b] to-[#fbbf24]" aria-hidden="true" />
      <div className="absolute inset-0 bg-black/25 mix-blend-soft-light" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500" aria-hidden="true" />

      <div
        className="relative mx-auto flex h-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
        style={{ minHeight: "var(--header-height)" }}
      >
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <Link href="/" className="focus:outline-none" aria-label="Home">
            <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
              <img src="/thestationlogo2.png" alt="The Station logo" className="h-[68px] w-auto" />
            </button>
          </Link>
          <a
            href="https://www.facebook.com/Thestationfoodtruck/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-block rounded-md focus:outline-none p-0.5"
            aria-label="The Station on Facebook"
          >
            <img
              src="/Facebook_logo_(square).png"
              alt="Facebook"
              className="h-12 w-12 rounded-md object-contain hover:ring-2 hover:ring-white/90 focus-visible:ring-2 focus-visible:ring-white/90 active:scale-90 transition-transform duration-150"
            />
          </a>
        </div>

        {/* Center: Nav */}
        <nav className="hidden flex-1 items-center justify-center md:flex">
          <ul className="flex items-center gap-10 whitespace-nowrap">
            {navItems.map(({ href, label }) => {
              const isActive = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`relative text-lg tracking-wide transition-colors ${
                      isActive ? "text-white" : "text-white/80 hover:text-white"
                    }`}
                  >
                    <span className="px-1 pb-1">{label}</span>
                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-amber-300" aria-hidden="true" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md border border-white/30 px-3.5 py-2 text-base font-medium hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/70 md:hidden"
          >
            <span>Menu</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M3.75 6.75A.75.75 0 014.5 6h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75zm0 5.25a.75.75 0 01.75-.75h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75zm.75 4.5a.75.75 0 000 1.5h15a.75.75 0 000-1.5h-15z" clipRule="evenodd" />
            </svg>
          </button>
          <Link
            href="/book"
            className="hidden items-center gap-2 rounded-full bg-white px-5 py-2.5 text-lg font-semibold text-red-800 shadow-lg shadow-black/20 transition hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 md:inline-flex"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 10.5V6a1.5 1.5 0 00-1.5-1.5H6A1.5 1.5 0 004.5 6v12A1.5 1.5 0 006 19.5h13.5A1.5 1.5 0 0021 18v-4.5M9 9h9m-9 7h5" />
            </svg>
            Book the truck
          </Link>
        </div>
      </div>

      {/* Mobile panel */}
      {mobileOpen && (
        <div
          className="md:hidden"
          style={{ position: "absolute", left: 0, right: 0, top: "var(--header-height)", zIndex: 40 }}
        >
          <div className="border-t border-white/20 bg-[#7c0a02]/95 backdrop-blur-sm shadow-lg shadow-black/30">
            <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6">
              <ul className="flex flex-col items-center gap-3">
                <li>
                  <a
                    href="https://www.facebook.com/Thestationfoodtruck/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2"
                    onClick={() => setMobileOpen(false)}
                  >
                    <img src="/Facebook_logo_(square).png" alt="Facebook" className="h-8 w-8 rounded-md object-contain" />
                    <span className="text-base">Facebook</span>
                  </a>
                </li>
                {navItems.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-base hover:underline"
                      onClick={() => setMobileOpen(false)}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
                <li className="pt-2">
                  <Link
                    href="/book"
                    onClick={() => setMobileOpen(false)}
                    className="inline-block rounded-full bg-white px-5 py-2.5 text-base font-semibold text-red-800 shadow-lg shadow-black/20 transition hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                  >
                    Book the truck
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
