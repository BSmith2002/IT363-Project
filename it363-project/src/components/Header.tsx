"use client";

import { useRouter } from "next/navigation";
import React from "react";

export default function Header() {
  const router = useRouter();

  return (
    <header className="fixed top-0 left-0 right-0 bg-red-800 text-white z-60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-25
       flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="/thestationlogo.png" alt="The Station logo" className="h-25 w-auto" />
          <nav>
            <ul className="flex items-center gap-4">
              <li>
                <button
                  type="button"
                  aria-label="Go to home"
                  onClick={() => router.push('/')}
                  className="font-large bg-transparent hover:underline"
                >
                  Home
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
