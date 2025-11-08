import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "The Station Foodtruck",
  description: "The Station — schedule and daily menu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-US" className="bg-white" suppressHydrationWarning>
      {/*
        Some browser extensions (e.g. Grammarly) inject attributes onto <body>
        after hydration which causes React to warn about a mismatch between
        server-rendered HTML and the client DOM. This is harmless but noisy.

        suppressHydrationWarning tells React to ignore hydration mismatches
        for this element subtree, which silences the warning.
      */}
      <body suppressHydrationWarning className="min-h-screen bg-white text-neutral-800">
        <Header />
        <div className="content-wrapper">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
