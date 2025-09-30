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
            src="/thestationlogo.png"
            alt="The Station logo"
            className="h-12 w-auto"
          />
          <nav>
            <ul className="flex items-center gap-6">
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
                <Link
                  href="https://www.facebook.com/Thestationfoodtruck/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Facebook
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
