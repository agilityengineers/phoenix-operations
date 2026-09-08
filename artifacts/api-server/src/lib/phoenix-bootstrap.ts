import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { db, phoenixBootstrapTokens, phoenixUsers } from "@workspace/db";
import { getPhoenixStore, WORKSPACE_ID } from "./phoenix-store";
import { logger } from "./logger";

export const bootstrapTokenHash = (token: string) => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for Phoenix bootstrap");
  return createHmac("sha256", secret).update(token).digest("hex");
};

/**
 * Until the Phoenix workspace has a super admin, every boot prints a one-time
 * claim URL to the private deployment logs. Opening it with an existing login
 * moves that account into the Phoenix workspace as super admin; a new email
 * creates the account. Earlier unexpired links stay valid, because autoscale
 * can boot several instances and the person reading the logs may pick any of
 * them. Every outstanding link is revoked by the first successful claim.
 */
export async function ensurePhoenixBootstrap(): Promise<void> {
  await getPhoenixStore(WORKSPACE_ID, true);
  const [superAdmin] = await db.select({ id: phoenixUsers.id }).from(phoenixUsers).where(and(eq(phoenixUsers.workspaceId, WORKSPACE_ID), eq(phoenixUsers.role, "super_admin"))).limit(1);
  if (superAdmin) return;
  await db.delete(phoenixBootstrapTokens).where(lt(phoenixBootstrapTokens.expiresAt, new Date(Date.now() - 86_400_000)));
  const token = process.env.NODE_ENV === "test" && process.env.PHOENIX_TEST_BOOTSTRAP_TOKEN ? process.env.PHOENIX_TEST_BOOTSTRAP_TOKEN : randomBytes(32).toString("base64url");
  await db.insert(phoenixBootstrapTokens).values({ id: `bst_${randomUUID()}`, tokenHash: bootstrapTokenHash(token), workspaceId: WORKSPACE_ID, expiresAt: new Date(Date.now() + 60 * 60_000) }).onConflictDoNothing();
  logger.warn({ bootstrapUrl: `/bootstrap?token=${encodeURIComponent(token)}` }, "Phoenix has no super admin yet. Open this one-time claim URL within 60 minutes: sign in with an existing login to move it into the Phoenix workspace as super admin, or create the account");
}
