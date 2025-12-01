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
    <footer className="relative mt-16 text-white">
      <div className="absolute inset-0 bg-[#1b0c0a]" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/10" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-red-500 to-amber-400" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-10 sm:grid-cols-[2fr_1fr_1fr]">
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

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {currentYear} The Station Foodtruck. All rights reserved.</p>
          <p>Crafted with love, served on wheels.</p>
        </div>
      </div>
    </footer>
  );
}
