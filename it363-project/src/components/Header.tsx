"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

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
    if (isAdminRoute) {
      // ensure content is not padded for admin pages
      if (typeof document !== "undefined") {
        document.documentElement.classList.add("header-hidden");
        document.documentElement.classList.remove("header-visible");
      }
      return;
    }
    // set initial class so content gets correct padding - always visible now
    if (typeof document !== "undefined") {
      document.documentElement.classList.add("header-visible");
      document.documentElement.classList.remove("header-hidden");
    }
  }, []);

  // header classes: always visible and fixed at top with highest z-index
  const headerClass = "fixed top-0 left-0 right-0 bg-red-800 text-white shadow z-50";

  if (isAdminRoute) return null;

  return (
    <header className={headerClass} style={{ height: "80px" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-20 grid grid-cols-3 items-center">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <img src="/thestationlogo2.png" alt="The Station logo" className="h-20 w-auto" />
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
        <nav className="flex justify-center">
          {/* Desktop nav */}
          <ul className="hidden md:flex items-center gap-8">
            <li>
              <Link href="/" className="text-xl hover:underline">
                Home
              </Link>
            </li>
            <li>
              <Link href="/about" className="text-xl hover:underline">
                About Us
              </Link>
            </li>
            <li>
              <Link href="/menupage" className="text-xl hover:underline">
                Menu
              </Link>
            </li>
          </ul>
          {/* Mobile toggle */}
          <div className="md:hidden">
            <button
              type="button"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-md border border-white/30 px-3.5 py-2 text-base font-medium hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              <span>Menu</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M3.75 6.75A.75.75 0 014.5 6h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75zm0 5.25a.75.75 0 01.75-.75h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75zm.75 4.5a.75.75 0 000 1.5h15a.75.75 0 000-1.5h-15z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </nav>

        {/* Right: Call to action */}
        <div className="hidden md:flex justify-end">
          <Link
            href="/book"
            className="text-lg font-semibold rounded-full bg-white text-red-800 px-5 py-2.5 shadow hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90"
          >
            Book with us!
          </Link>
        </div>
      </div>

      {/* Mobile panel */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/20 bg-red-800/98 backdrop-blur-sm">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3">
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
              <li>
                <Link href="/" className="text-base hover:underline" onClick={() => setMobileOpen(false)}>
                  Home
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-base hover:underline" onClick={() => setMobileOpen(false)}>
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/menupage" className="text-base hover:underline" onClick={() => setMobileOpen(false)}>
                  Menu
                </Link>
              </li>
              <li className="pt-2">
                <Link
                  href="/book"
                  onClick={() => setMobileOpen(false)}
                  className="inline-block text-base font-semibold rounded-full bg-white text-red-800 px-5 py-2.5 shadow hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90"
                >
                  Book with us!
                </Link>
              </li>
            </ul>
          </div>
        </div>
      )}
    </header>
  );
}
