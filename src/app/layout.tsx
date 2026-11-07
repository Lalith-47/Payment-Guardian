import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revenue Guardian",
  description: "AI back-office recovery and payment guardrails for small merchants",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-ink text-paper">
        {children}
      </body>
    </html>
  );
}

