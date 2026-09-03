import { NextResponse } from "next/server";

// Creates a Stripe Checkout session for a plan (14-day trial), used by the
// partner signup step 3. Uses Stripe's REST API directly — no SDK dependency.
const PRICE_ENV: Record<string, string | undefined> = {
  solo: process.env.STRIPE_PRICE_SOLO,
  practice: process.env.STRIPE_PRICE_PRACTICE,
  network: process.env.STRIPE_PRICE_NETWORK,
};

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  let body: { plan?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const plan = (body.plan ?? "").toLowerCase();
  const price = PRICE_ENV[plan];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  if (!key || !price) {
    // Stripe not configured — signup completes without checkout (trial recorded
    // locally); the README covers wiring real prices.
    return NextResponse.json({ url: null, reason: "stripe_not_configured" });
  }

  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    "subscription_data[trial_period_days]": "14",
    success_url: `${siteUrl}/admin?checkout=success`,
    cancel_url: `${siteUrl}/signup?checkout=cancelled`,
  });
  if (body.email) params.set("customer_email", body.email);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  if (!res.ok) {
    return NextResponse.json({ error: "stripe_error" }, { status: 502 });
  }
  const session = (await res.json()) as { url: string };
  return NextResponse.json({ url: session.url });
}
