import { jsonb, pgTable, text, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";

export const phoenixWorkspaces = pgTable("phoenix_workspaces", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  customDomain: text("custom_domain").unique(),
  pendingCustomDomain: text("pending_custom_domain"),
  domainVerificationToken: text("domain_verification_token"),
  customDomainVerifiedAt: timestamp("custom_domain_verified_at", { withTimezone: true }),
  state: jsonb("state").notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per person. `workspaceId`/`role` are the account's *home* workspace —
 * where it was created and where a fresh login lands. Access itself lives in
 * phoenix_memberships, so a person can belong to several workspaces at once
 * without the email unique constraint forcing a duplicate identity.
 */
export const phoenixUsers = pgTable("phoenix_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  workspaceId: text("workspace_id").notNull().references(() => phoenixWorkspaces.id),
  name: text("name").notNull(),
  role: text("role").notNull().default("staff"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Which workspaces a user may enter, and with what role in each. Authoritative
 * for authorization: the session cookie names an active workspace, and every
 * admin request re-reads the role from the membership for that pair.
 */
export const phoenixMemberships = pgTable("phoenix_memberships", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => phoenixUsers.id),
  workspaceId: text("workspace_id").notNull().references(() => phoenixWorkspaces.id),
  role: text("role").notNull().default("staff"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("phoenix_memberships_user_workspace_idx").on(table.userId, table.workspaceId),
  index("phoenix_memberships_user_idx").on(table.userId),
]);

export const phoenixUserInvites = pgTable("phoenix_user_invites", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  workspaceId: text("workspace_id").notNull().references(() => phoenixWorkspaces.id),
  email: text("email").notNull(),
  role: text("role").notNull().default("staff"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("phoenix_user_invites_workspace_email_idx").on(table.workspaceId, table.email)]);

export const phoenixResetTokens = pgTable("phoenix_reset_tokens", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  userId: text("user_id").notNull().references(() => phoenixUsers.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const phoenixBootstrapTokens = pgTable("phoenix_bootstrap_tokens", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  workspaceId: text("workspace_id").notNull().references(() => phoenixWorkspaces.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PhoenixWorkspace = typeof phoenixWorkspaces.$inferSelect;
export type PhoenixUser = typeof phoenixUsers.$inferSelect;
export type PhoenixMembership = typeof phoenixMemberships.$inferSelect;
export type PhoenixUserInvite = typeof phoenixUserInvites.$inferSelect;