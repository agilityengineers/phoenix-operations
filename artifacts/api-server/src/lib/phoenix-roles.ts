/**
 * Role hierarchy and the single permissions table for the admin API.
 *
 * Think of roles as key rings. Every ring opens everything the rings below it
 * open, and nobody can cut a key for a ring above their own. To open a feature
 * to more roles later, add the role to that feature's row here; every route and
 * every screen reads from this table, so nothing else has to change.
 *
 * Keep in sync with artifacts/phoenix-operations/src/lib/roles.ts, which the
 * admin UI uses to decide what to show. The server remains the authority.
 */
export const ROLES = ["super_admin", "admin", "owner", "staff", "partner"] as const;
export type Role = (typeof ROLES)[number];

/** Higher wins. A role can only be granted, changed or removed by a rank at or above it. */
const RANK: Record<Role, number> = { super_admin: 5, admin: 4, owner: 3, staff: 2, partner: 1 };

export const PERMISSIONS = {
  /** Load the workspace record. Needed by every admin screen, so every member has it. */
  "workspace.read": ["super_admin", "admin", "owner", "staff", "partner"],
  /** Branding, domain, integrations, scheduling, webhooks and subscriptions. */
  "workspace.manage": ["super_admin", "admin", "owner"],
  /** Funnels and site content. */
  "content.manage": ["super_admin", "admin", "owner"],
  /** Contacts, pipeline, notes and tasks. */
  "contacts.manage": ["super_admin", "admin", "owner", "staff", "partner"],
  /** See the member directory. */
  "members.read": ["super_admin", "admin", "owner"],
  /** Send invitations, limited to roles at or below your own. */
  "members.invite": ["super_admin", "admin", "owner"],
  /** Change roles and remove members, limited to ranks at or below your own. */
  "members.manage": ["super_admin", "admin"],
  /** The platform-wide view of every partner workspace. */
  "partners.read": ["super_admin"],
} as const satisfies Record<string, readonly Role[]>;
export type Permission = keyof typeof PERMISSIONS;

export const isRole = (value: unknown): value is Role => typeof value === "string" && (ROLES as readonly string[]).includes(value);
/** Unknown roles rank at zero, so they can neither act nor be acted on. Fails closed. */
export const rank = (role: string) => (isRole(role) ? RANK[role] : 0);
export const can = (role: string, permission: Permission) => isRole(role) && (PERMISSIONS[permission] as readonly Role[]).includes(role);
/** Roles an actor may hand out or set: everything at or below their own rank. */
export const assignableRoles = (role: string): Role[] => (isRole(role) ? ROLES.filter(candidate => RANK[candidate] <= RANK[role]) : []);
/** Whether an actor may edit or remove a member holding `target`. Equal rank counts, so peers can manage each other. */
export const outranksOrEquals = (actor: string, target: string) => rank(actor) > 0 && rank(actor) >= rank(target);
export const roleLabel = (role: string) => (role === "super_admin" ? "Super admin" : role.charAt(0).toUpperCase() + role.slice(1));
