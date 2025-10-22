"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Header() {
  const router = useRouter();

  return (
    <header className="fixed top-0 left-0 right-0 bg-red-800 text-white z-50 shadow">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img
            src="/thestationlogo2.png"
            alt="The Station logo"
            className="h-16 w-auto"
          />
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
                <button
                  type="button"
                  aria-label="Go to Home"
                  onClick={() => router.push("/")}
                  className="text-lg hover:underline"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  aria-label="About Us"
                  onClick={() => router.push("/About Us")}
                  className="text-lg hover:underline"
                >
                  About Us
                </button>
              </li>
            </ul>
          </nav>
        </div>
        <div />
      </div>
    </header>
  );
}
