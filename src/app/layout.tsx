import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
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
              } catch(e){}
            })()`,
          }}
        />
      </head>
      <body className="antialiased min-h-screen bg-paper text-ink font-body">
        {children}
      </body>
    </html>
  );
}
