import "./globals.css";

export const metadata = {
  title: "The Station Foodtruck",
  description: "The Station — schedule and daily menu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-neutral-900">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
