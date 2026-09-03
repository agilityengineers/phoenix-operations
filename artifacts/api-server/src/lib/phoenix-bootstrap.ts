import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, phoenixBootstrapTokens, phoenixUsers } from "@workspace/db";
import { getPhoenixStore, WORKSPACE_ID } from "./phoenix-store";
import { logger } from "./logger";

export const bootstrapTokenHash = (token: string) => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for Phoenix bootstrap");
  return createHmac("sha256", secret).update(token).digest("hex");
};

export async function ensurePhoenixBootstrap(): Promise<void> {
  await getPhoenixStore(WORKSPACE_ID, true);
  const [owner] = await db.select({ id: phoenixUsers.id }).from(phoenixUsers).where(and(eq(phoenixUsers.workspaceId, WORKSPACE_ID), inArray(phoenixUsers.role, ["owner", "admin"]))).limit(1);
  if (owner) return;
  await db.update(phoenixBootstrapTokens).set({ consumedAt: new Date() }).where(and(eq(phoenixBootstrapTokens.workspaceId, WORKSPACE_ID), isNull(phoenixBootstrapTokens.consumedAt)));
  const token = process.env.NODE_ENV === "test" && process.env.PHOENIX_TEST_BOOTSTRAP_TOKEN ? process.env.PHOENIX_TEST_BOOTSTRAP_TOKEN : randomBytes(32).toString("base64url");
  await db.insert(phoenixBootstrapTokens).values({ id: `bst_${randomUUID()}`, tokenHash: bootstrapTokenHash(token), workspaceId: WORKSPACE_ID, expiresAt: new Date(Date.now() + 60 * 60_000) });
  logger.warn({ bootstrapUrl: `/bootstrap?token=${encodeURIComponent(token)}` }, "Phoenix first-owner bootstrap is required; this one-time URL expires in 60 minutes");
}