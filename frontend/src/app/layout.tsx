import type { Metadata } from "next";
import { Chakra_Petch, JetBrains_Mono, Michroma } from "next/font/google";
import { AuthProvider } from "@/features/auth";
import "./globals.css";

// The type system, sharpened (2026-07-12): Michroma cuts the wordmark
// and headings (engineered, Eurostile-blooded), Chakra Petch machines
// the UI text (angular terminals, real weights), JetBrains Mono stays
// strictly on data — numbers, amounts, addresses.
const sans = Chakra_Petch({
  weight: ["300", "400", "600"],
  variable: "--font-app-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-app-mono",
  subsets: ["latin"],
});

const display = Michroma({
  weight: "400",
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Recurra",
  description: "Set it. Forget it. Own it. — recurring payments from escrow you control.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
