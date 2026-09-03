"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/funnels", label: "Funnels" },
  { href: "/admin/contacts", label: "Contacts" },
  { href: "/admin/sequences", label: "Sequences" },
  { href: "/admin/content", label: "Site Content" },
  { href: "/admin/white-label", label: "White Label" },
  { href: "/admin/network", label: "Users & Network" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/integrations", label: "Integrations" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav className="adm-nav" aria-label="Admin">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={isActive(item.href) ? "active" : ""}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
