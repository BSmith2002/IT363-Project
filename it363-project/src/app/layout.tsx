import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Barlow } from "next/font/google";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-barlow" });

export const metadata = {
  title: "The Station Foodtruck",
  description: "The Station — schedule and daily menu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-US" className={`${barlow.variable} bg-[#fef8f2]`} suppressHydrationWarning>
      {/*
        Some browser extensions (e.g. Grammarly) inject attributes onto <body>
        after hydration which causes React to warn about a mismatch between
        server-rendered HTML and the client DOM. This is harmless but noisy.

        suppressHydrationWarning tells React to ignore hydration mismatches
        for this element subtree, which silences the warning.
      */}
      <body suppressHydrationWarning className="min-h-screen bg-[#fff8f2] text-neutral-900 antialiased">
        <Header />
        <div className="content-wrapper">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
