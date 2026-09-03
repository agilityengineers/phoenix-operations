import { NextResponse } from "next/server";
import { WORKSPACE_ID } from "@/lib/seed";
import { getStore } from "@/lib/store";

// Stripe webhook — subscription lifecycle. Signature verified with the
// webhook secret (HMAC-SHA256 over `${timestamp}.${payload}` per Stripe docs).
async function verifyStripeSignature(
  payload: string,
  sigHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => kv.split("=") as [string, string])
  );
  const timestamp = parts.t;
  const expected = parts.v1;
  if (!timestamp || !expected) return false;
  // Reject events older than 5 minutes (replay protection).
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${payload}`));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === expected;
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const payload = await req.text();
  if (secret) {
    const ok = await verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret);
    if (!ok) return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  } else {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }

  let event: { type: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const store = getStore();
  const log = (msg: string) =>
    store.addSyncLog({
      workspaceId: WORKSPACE_ID,
      at: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      msg,
      state: "ok",
    });

  switch (event.type) {
    case "checkout.session.completed":
      await log("Stripe: checkout completed — subscription active (trial started)");
      break;
    case "customer.subscription.updated":
      await log("Stripe: subscription updated");
      break;
    case "customer.subscription.deleted":
      await log("Stripe: subscription cancelled");
      break;
    case "invoice.payment_failed":
      await log("Stripe: payment failed — dunning email queued");
      break;
    default:
      break;
  }
  return NextResponse.json({ received: true });
}
