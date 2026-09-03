"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Shared auth chrome: logo header with Sign in / Partner signup / Reset tabs.
export default function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/login", label: "Sign in" },
    { href: "/signup", label: "Partner signup" },
    { href: "/reset", label: "Reset" },
  ];
  return (
    <div className="auth-shell">
      <header className="auth-header">
        <Link href="/" style={{ display: "flex" }}>
          <Image
            src="/assets/logo.png"
            alt="Phoenix Operations"
            width={181}
            height={54}
            className="site-logo"
            style={{ height: 54, width: "auto", mixBlendMode: "multiply" }}
            priority
          />
        </Link>
        <nav className="tab-switch" aria-label="Auth">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} className={pathname === t.href ? "active" : ""}>
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="auth-main">{children}</main>
      <footer className="auth-footer">
        <span>© 2026 Phoenix Operations</span>
        <div style={{ display: "flex", gap: 18 }}>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/terms">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
