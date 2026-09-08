import { Link, useLocation } from "wouter";
import { can, type Permission } from "@/lib/roles";

// This nav renders inside the nested `/admin` router (see App.tsx), so wouter
// resolves every href and the current location here relative to that base:
// "/funnels" is /admin/funnels in the address bar. Writing "/admin/funnels"
// would double the prefix (/admin/admin/funnels) and land on the 404 page —
// which is exactly how the menu used to break. Keep these paths relative, and
// keep them in step with the route table in pages/admin/routes.tsx.
//
// Items without a permission are open to every member. The rest follow the
// permissions table, so opening a screen to a new role is a one-line change there.
export const adminNavItems: ReadonlyArray<{ href: string; label: string; permission?: Permission }> = [
  { href: "/", label: "Dashboard" },
  { href: "/funnels", label: "Funnels", permission: "content.manage" },
  { href: "/contacts", label: "Contacts" },
  { href: "/sequences", label: "Sequences" },
  { href: "/content", label: "Site Content", permission: "content.manage" },
  { href: "/white-label", label: "White Label", permission: "workspace.manage" },
  { href: "/network", label: "Users & Network", permission: "members.read" },
  { href: "/billing", label: "Billing", permission: "workspace.manage" },
  { href: "/integrations", label: "Integrations", permission: "workspace.manage" },
];

export default function AdminNav({ role }: { role?: string }) {
  // Relative to the nested base as well: "/" on the dashboard, "/funnels/abc" in the builder.
  const [pathname] = useLocation();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="adm-nav" aria-label="Admin">
      {adminNavItems
        .filter((item) => !item.permission || can(role, item.permission))
        .map((item) => (
          <Link key={item.href} href={item.href} className={isActive(item.href) ? "active" : ""}>
            {item.label}
          </Link>
        ))}
    </nav>
  );
}
