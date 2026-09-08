import { Link, useLocation } from "wouter";
import { can, type Permission } from "@/lib/roles";

// Items without a permission are open to every member. The rest follow the
// permissions table, so opening a screen to a new role is a one-line change there.
const items: Array<{ href: string; label: string; permission?: Permission }> = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/funnels", label: "Funnels", permission: "content.manage" },
  { href: "/admin/contacts", label: "Contacts" },
  { href: "/admin/sequences", label: "Sequences" },
  { href: "/admin/content", label: "Site Content", permission: "content.manage" },
  { href: "/admin/white-label", label: "White Label", permission: "workspace.manage" },
  { href: "/admin/network", label: "Users & Network", permission: "members.read" },
  { href: "/admin/billing", label: "Billing", permission: "workspace.manage" },
  { href: "/admin/integrations", label: "Integrations", permission: "workspace.manage" },
];

export default function AdminNav({ role }: { role?: string }) {
  const [pathname] = useLocation();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav className="adm-nav" aria-label="Admin">
      {items
        .filter((item) => !item.permission || can(role, item.permission))
        .map((item) => (
          <Link key={item.href} href={item.href} className={isActive(item.href) ? "active" : ""}>
            {item.label}
          </Link>
        ))}
    </nav>
  );
}
