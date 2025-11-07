"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const footerLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Us" },
];

export default function Footer() {
  const pathname = usePathname();

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
    <footer className="mt-16 border-t border-white/10 bg-neutral-900 text-white/70">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between">
        <div className="flex flex-col items-center gap-1 text-sm sm:items-start">
          <span className="text-white font-semibold">The Station Foodtruck</span>
          <span>Peoria, Illinois · (309) 453-6700</span>
        </div>

        <nav aria-label="Footer navigation">
          <ul className="flex flex-wrap items-center justify-center gap-6 text-sm">
            {footerLinks.map((link) => (
              <li key={link.href}>
                <Link className="transition hover:text-white" href={link.href}>
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                className="transition hover:text-white"
                href="https://www.facebook.com/Thestationfoodtruck/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Facebook
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
