"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function Header() {
  const [visible, setVisible] = useState(true);
  const visibleRef = useRef<boolean>(visible);
  const pathname = usePathname();

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
    // set initial class so content gets correct padding
    if (typeof document !== "undefined") {
      document.documentElement.classList.add("header-visible");
      document.documentElement.classList.remove("header-hidden");
    }
    const lastYRef = { current: typeof window !== "undefined" ? window.scrollY : 0 };
    const tickingRef = { current: false };

    function onScroll() {
      if (tickingRef.current) return;
      tickingRef.current = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const lastY = lastYRef.current;
        // Immediate hide on any downward movement, immediate show on any upward movement.
        const delta = y - lastY;

        if (delta > 0 && visibleRef.current) {
          // scrolled down -> hide immediately
          visibleRef.current = false;
          setVisible(false);
          document.documentElement.classList.remove("header-visible");
          document.documentElement.classList.add("header-hidden");
        } else if (delta < 0 && !visibleRef.current) {
          // scrolled up -> show immediately
          visibleRef.current = true;
          setVisible(true);
          document.documentElement.classList.add("header-visible");
          document.documentElement.classList.remove("header-hidden");
        }

        // update lastY for next frame
        lastYRef.current = y;
        tickingRef.current = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // header classes: when visible -> fixed and red; when hidden -> translate up
  const headerClass = visible
    ? "fixed top-0 left-0 right-0 bg-red-800 text-white shadow transition-transform duration-200"
    : "fixed top-0 left-0 right-0 -translate-y-full bg-red-800 text-white transition-transform duration-200";

  if (isAdminRoute) return null;

  return (
    <header className={headerClass} style={{ height: "64px" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="/thestationlogo2.png" alt="The Station logo" className="h-16 w-auto" />
          <nav>
            <ul className="flex items-center gap-6">
              <li>
                <a
                  href="https://www.facebook.com/Thestationfoodtruck/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-md focus:outline-none p-0.5"
                >
                  <img
                    src="/Facebook_logo_(square).png"
                    alt="Facebook logo"
                    className="h-10 w-10 rounded-md object-contain hover:ring-2 hover:ring-white/90 focus-visible:ring-2 focus-visible:ring-white/90 active:scale-80 transition-transform duration-150"
                  />
                </a>
              </li>
              <li>
                <Link href="/" className="text-lg hover:underline">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-lg hover:underline">
                  About Us
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div />
      </div>
    </header>
  );
}
