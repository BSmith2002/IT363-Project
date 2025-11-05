import "./globals.css";

export const metadata = {
  title: "The Station Foodtruck",
  description: "The Station — schedule and daily menu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-US" className="bg-neutral-900" suppressHydrationWarning>
      {/*
        Some browser extensions (e.g. Grammarly) inject attributes onto <body>
        after hydration which causes React to warn about a mismatch between
        server-rendered HTML and the client DOM. This is harmless but noisy.

        suppressHydrationWarning tells React to ignore hydration mismatches
        for this element subtree, which silences the warning.
      */}
      <body suppressHydrationWarning className="min-h-screen">{children}</body>
    </html>
  );
}
