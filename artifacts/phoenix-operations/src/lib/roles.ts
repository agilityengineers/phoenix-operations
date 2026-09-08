// Mirror of artifacts/api-server/src/lib/phoenix-roles.ts. The server is the
// authority on every request; this copy only decides what the admin UI shows.
// Change both files together.

export const ROLES = ["super_admin", "admin", "owner", "staff", "partner"] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { super_admin: 5, admin: 4, owner: 3, staff: 2, partner: 1 };

export const PERMISSIONS = {
  "workspace.read": ["super_admin", "admin", "owner", "staff", "partner"],
  "workspace.manage": ["super_admin", "admin", "owner"],
  "content.manage": ["super_admin", "admin", "owner"],
  "contacts.manage": ["super_admin", "admin", "owner", "staff", "partner"],
  "members.read": ["super_admin", "admin", "owner"],
  "members.invite": ["super_admin", "admin", "owner"],
  "members.manage": ["super_admin", "admin"],
  "partners.read": ["super_admin"],
} as const satisfies Record<string, readonly Role[]>;
export type Permission = keyof typeof PERMISSIONS;

export const isRole = (value: unknown): value is Role => typeof value === "string" && (ROLES as readonly string[]).includes(value);
export const rank = (role: string) => (isRole(role) ? RANK[role] : 0);
export const can = (role: string | undefined, permission: Permission) => isRole(role) && (PERMISSIONS[permission] as readonly Role[]).includes(role);
/** Roles this person may hand out or set: everything at or below their own rank. */
export const assignableRoles = (role: string | undefined): Role[] => (isRole(role) ? ROLES.filter((candidate) => RANK[candidate] <= RANK[role]) : []);
/** Whether `actor` may edit or remove a member holding `target`. Equal rank counts. */
export const outranksOrEquals = (actor: string | undefined, target: string) => rank(actor ?? "") > 0 && rank(actor ?? "") >= rank(target);
export const roleLabel = (role: string) => (role === "super_admin" ? "Super admin" : role.charAt(0).toUpperCase() + role.slice(1));

export const ROLE_DESCRIPTIONS: Array<{ role: Role; cls: string; desc: string }> = [
  { role: "super_admin", cls: "ink", desc: "Runs the platform. Everything an admin can do, plus the partner-workspace network and any feature not yet opened to admins." },
  { role: "admin", cls: "ink", desc: "Full control of this workspace: branding, white label, users, integrations, and all CRM data. Invites admins and below." },
  { role: "owner", cls: "warn", desc: "Runs a workspace: funnels, site content, CRM, and their own staff invites. Cannot touch other workspaces or platform settings." },
  { role: "staff", cls: "neutral", desc: "Works leads: contacts, pipeline, notes, tasks. No access to funnels, branding, or user management." },
  { role: "partner", cls: "ok", desc: "An EOS implementer in the network, owner of their own white-labeled workspace, connected to Phoenix Operations for referrals and shared playbooks." },
];
