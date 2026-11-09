import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/AppProviders";

export const metadata: Metadata = {
  title: "Revenue Guardian | Autonomous Payment Guardrails for PayPal Merchants",
  description: "Deterministic payment recovery and policy guardrails for PayPal merchants.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geologica:wght@300;400;500&family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                var p = new URLSearchParams(window.location.search);
                if (p.get("disableCanvas") === "1") document.documentElement.dataset.disableCanvas = "1";
                if (p.get("disableGlass") === "1") document.documentElement.dataset.disableGlass = "1";
                var t = localStorage.getItem("paypal-theme");
                if (t === "dark") {
                  document.documentElement.classList.add("dark");
                  document.documentElement.dataset.theme = "dark";
                  document.documentElement.style.colorScheme = "dark";
                } else {
                  document.documentElement.classList.remove("dark");
                  document.documentElement.dataset.theme = "light";
                  document.documentElement.style.colorScheme = "light";
                }
                var l = localStorage.getItem("paypal-lang");
                if (l) document.documentElement.lang = l;
              } catch(e){}
            })()`,
          }}
        />
      </head>
      <body className="antialiased min-h-screen bg-paper text-ink font-body transition-colors duration-200">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
