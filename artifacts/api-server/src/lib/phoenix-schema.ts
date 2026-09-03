import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Bootstrap the Phoenix-owned tables for deployments whose database has not
 * yet received the Drizzle schema. Keep this in sync with lib/db/src/schema/phoenix.ts.
 */
export async function ensurePhoenixSchema(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS phoenix_workspaces (
        id text PRIMARY KEY,
        slug text NOT NULL UNIQUE,
        custom_domain text UNIQUE,
        pending_custom_domain text,
        domain_verification_token text,
        custom_domain_verified_at timestamp with time zone,
        state jsonb NOT NULL,
        is_public boolean NOT NULL DEFAULT false,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS phoenix_users (
        id text PRIMARY KEY,
        email text NOT NULL,
        password_hash text NOT NULL,
        password_salt text NOT NULL,
        workspace_id text NOT NULL REFERENCES phoenix_workspaces(id),
        name text NOT NULL,
        role text NOT NULL DEFAULT 'staff',
        created_at timestamp with time zone NOT NULL DEFAULT now()
      );
      ALTER TABLE phoenix_workspaces ADD COLUMN IF NOT EXISTS slug text;
      ALTER TABLE phoenix_workspaces ADD COLUMN IF NOT EXISTS custom_domain text;
      ALTER TABLE phoenix_workspaces ADD COLUMN IF NOT EXISTS pending_custom_domain text;
      ALTER TABLE phoenix_workspaces ADD COLUMN IF NOT EXISTS domain_verification_token text;
      ALTER TABLE phoenix_workspaces ADD COLUMN IF NOT EXISTS custom_domain_verified_at timestamp with time zone;
      ALTER TABLE phoenix_users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'staff';
      UPDATE phoenix_workspaces SET slug = 'phoenix' WHERE id = 'ws_phoenix' AND slug IS NULL;
      UPDATE phoenix_workspaces
      SET slug = regexp_replace(lower(id), '[^a-z0-9-]+', '-', 'g')
      WHERE slug IS NULL;
      ALTER TABLE phoenix_workspaces ALTER COLUMN slug SET NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS phoenix_workspaces_slug_unique ON phoenix_workspaces (slug);
      CREATE UNIQUE INDEX IF NOT EXISTS phoenix_workspaces_custom_domain_unique ON phoenix_workspaces (custom_domain) WHERE custom_domain IS NOT NULL;
      CREATE TABLE IF NOT EXISTS phoenix_user_invites (
        id text PRIMARY KEY,
        token_hash text NOT NULL UNIQUE,
        workspace_id text NOT NULL REFERENCES phoenix_workspaces(id),
        email text NOT NULL,
        role text NOT NULL DEFAULT 'staff',
        expires_at timestamp with time zone NOT NULL,
        used_at timestamp with time zone,
        created_at timestamp with time zone NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS phoenix_user_invites_workspace_email_idx ON phoenix_user_invites (workspace_id, email);
      CREATE TABLE IF NOT EXISTS phoenix_reset_tokens (
        id text PRIMARY KEY,
        token_hash text NOT NULL,
        user_id text NOT NULL REFERENCES phoenix_users(id),
        expires_at timestamp with time zone NOT NULL,
        used_at timestamp with time zone,
        created_at timestamp with time zone NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS phoenix_bootstrap_tokens (
        id text PRIMARY KEY,
        token_hash text NOT NULL UNIQUE,
        workspace_id text NOT NULL REFERENCES phoenix_workspaces(id),
        expires_at timestamp with time zone NOT NULL,
        consumed_at timestamp with time zone,
        created_at timestamp with time zone NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS phoenix_users_email_unique ON phoenix_users (email);
      CREATE UNIQUE INDEX IF NOT EXISTS phoenix_reset_tokens_token_hash_unique ON phoenix_reset_tokens (token_hash);
      CREATE UNIQUE INDEX IF NOT EXISTS phoenix_bootstrap_tokens_token_hash_unique ON phoenix_bootstrap_tokens (token_hash);
    `);
    logger.info("Phoenix database schema ensured");
  } catch (err) {
    logger.error({ err }, "Failed to ensure Phoenix database schema");
    throw err;
  }
}