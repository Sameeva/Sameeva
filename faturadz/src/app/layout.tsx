import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";
import { fr } from "@/i18n/fr";
import "./globals.css";

export const metadata: Metadata = {
  title: fr.appName,
  description: fr.tagline,
  referrer: "no-referrer",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Render per request so Next.js can attach the CSP nonce from src/proxy.ts.
  await connection();
  return (
    <html lang="fr" dir="ltr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
