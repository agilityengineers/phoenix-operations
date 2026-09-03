import { Link, useLocation } from "wouter";

// Shared auth chrome for account access and workspace signup.
export default function AuthShell({ children }: { children: React.ReactNode }) {
  const [pathname] = useLocation();
  const tabs = [
    { href: "/login", label: "Sign in" },
    { href: "/signup", label: "Partner signup" },
  ];
  return (
    <div className="auth-shell">
      <header className="auth-header">
        <Link href="/" style={{ display: "flex" }}>
          <img
            src="/assets/logo.png"
            alt="Phoenix Operations"
            width={181}
            height={54}
            className="site-logo"
            style={{ height: 54, width: "auto", mixBlendMode: "multiply" }}
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
