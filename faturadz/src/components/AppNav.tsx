"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { fr } from "@/i18n/fr";

const LINKS = [
  { href: "/", label: fr.nav.documents },
  { href: "/clients", label: fr.nav.clients },
  { href: "/products", label: fr.nav.products },
  { href: "/settings", label: fr.nav.settings },
];

export function AppNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/documents") : pathname.startsWith(href);

  return (
    <header className="border-b border-border bg-surface">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-accent">
          {fr.appName}
        </Link>
        <ul className="flex flex-wrap gap-4 text-sm">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={isActive(link.href) ? "font-bold text-foreground" : "text-muted hover:text-foreground"}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
