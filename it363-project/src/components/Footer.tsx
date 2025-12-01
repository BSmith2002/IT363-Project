"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const footerLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Us" },
];

export default function Footer() {
  const pathname = usePathname();
  const currentYear = new Date().getFullYear();

  const hideOnRoute =
    typeof pathname === "string" && (
      pathname === "/admin" ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/adminpage") ||
      pathname === "/forgot-password" ||
      pathname.startsWith("/forgot")
    );

  if (hideOnRoute) return null;

  return (
    <footer className="relative mt-12 text-white sm:mt-16">
      <div className="absolute inset-0 bg-[#1b0c0a]" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/10" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-red-500 to-amber-400" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-14 lg:px-8">
        <div className="hidden gap-10 md:grid md:grid-cols-[2fr_1fr_1fr]">
          <div className="space-y-4">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-amber-300">The Station</p>
              <p className="text-2xl font-semibold">Food truck goodness, wherever you are.</p>
            </div>
            <p className="max-w-md text-sm text-white/80">
              Serving Peoria and the surrounding communities with sizzling sandwiches, crispy fries, and familiar favorites made fresh from the truck.
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-white/70">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9Zm0 0v4m0 10v-4m0 0h4m-4 0H8" />
                </svg>
                Lunch & dinner events
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25l-9-5.25-9 5.25v7.5l9 5.25 9-5.25v-7.5Z" />
                </svg>
                Festivals · Weddings · Pop-ups
              </span>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <h3 className="text-base font-semibold text-amber-200">Come say hi</h3>
            <p className="text-white/80">Central Illinois · Peoria based</p>
            <p className="text-white/80">Phone <a href="tel:+13094536700" className="font-medium text-white hover:text-amber-300">(309) 453-6700</a></p>
            <p className="text-white/80">Email <a href="mailto:speck4193@gmail.com" className="font-medium text-white hover:text-amber-300">speck4193@gmail.com</a></p>
            <a
              href="https://www.facebook.com/Thestationfoodtruck/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-white hover:text-amber-300"
            >
              <img src="/Facebook_logo_(square).png" alt="Facebook" className="h-6 w-6 rounded" />
              Follow on Facebook
            </a>
          </div>

          <div className="space-y-4 text-sm">
            <h3 className="text-base font-semibold text-amber-200">Quick links</h3>
            <nav aria-label="Footer navigation">
              <ul className="space-y-2">
                {footerLinks.map((link) => (
                  <li key={link.href}>
                    <Link className="transition hover:text-amber-300" href={link.href}>
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link className="transition hover:text-amber-300" href="/menupage">
                    Menu
                  </Link>
                </li>
                <li>
                  <Link className="transition hover:text-amber-300" href="/book">
                    Book the truck
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        <div className="mt-2 space-y-1 bg-[#1b0c0a] px-0 text-sm text-white/80 md:hidden">
          <p className="text-[10px] uppercase tracking-[0.22em] text-amber-300">The Station</p>

          <div className="flex flex-col gap-1.5">
            <a href="tel:+13094536700" className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-red-800 px-4 py-2 font-semibold shadow-sm shadow-black/20 transition hover:bg-amber-50">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 5.5 4.5 3l4 4-2.5 2.5a12 12 0 005.5 5.5L14 12l4 4-2.5 2.5a2 2 0 01-2 0A14.5 14.5 0 013.5 9a2 2 0 010-2Z" />
              </svg>
              Call us
            </a>
            <a href="mailto:speck4193@gmail.com" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-4 py-2 font-semibold text-white transition hover:border-white/60 hover:bg-white/10">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18v14H3V5Zm0 0 9 7 9-7" />
              </svg>
              Email us
            </a>
            <Link href="/book" className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-400/90 px-4 py-2 font-semibold text-red-900 transition hover:bg-amber-300">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 10.5V6a1.5 1.5 0 00-1.5-1.5H6A1.5 1.5 0 004.5 6v12A1.5 1.5 0 006 19.5h13.5A1.5 1.5 0 0021 18v-4.5M9 9h9m-9 7h5" />
              </svg>
              Book the truck
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-center text-xs text-white/60">
            <Link href="/" className="transition hover:text-amber-300">Home</Link>
            <span>|</span>
            <Link href="/about" className="transition hover:text-amber-300">About</Link>
            <span>|</span>
            <Link href="/menupage" className="transition hover:text-amber-300">Menu</Link>
            <span>|</span>
            <Link href="/calendar" className="transition hover:text-amber-300">Calendar</Link>
          </div>

          <a
            href="https://www.facebook.com/Thestationfoodtruck/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-xs font-medium text-white transition hover:text-amber-300"
          >
            <img src="/Facebook_logo_(square).png" alt="Facebook" className="h-5 w-5 rounded" />
            Follow on Facebook
          </a>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {currentYear} The Station Foodtruck. All rights reserved.</p>
          <p>Crafted with love, served on wheels.</p>
        </div>
      </div>
    </footer>
  );
}
