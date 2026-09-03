import { jsonb, pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";

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

export const phoenixUserInvites = pgTable("phoenix_user_invites", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  workspaceId: text("workspace_id").notNull().references(() => phoenixWorkspaces.id),
  email: text("email").notNull(),
  role: text("role").notNull().default("staff"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
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