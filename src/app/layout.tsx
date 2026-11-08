import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revenue Guardian | Autonomous Payment Guardrails for PayPal Merchants",
  description: "Real-time 3D spatial transaction topology and policy guardrails for autonomous payment recovery.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geologica:wght,CRSV,SHRP@200..500,0,0..100&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen bg-paper text-ink">
        {children}
      </body>
    </html>
  );
}
