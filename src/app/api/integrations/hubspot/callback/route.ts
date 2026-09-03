import { NextResponse } from "next/server";
import { WORKSPACE_ID } from "@/lib/seed";
import { getStore } from "@/lib/store";

// HubSpot OAuth callback — exchanges the code for tokens.
// Tokens persist in hubspot_connections (Supabase) so the sync worker can
// refresh them; in demo mode the exchange is logged and the visible sync log
// confirms the connection.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

  if (!code || !clientId || !clientSecret) {
    return NextResponse.redirect(`${siteUrl}/admin/integrations?error=hubspot_oauth_failed`);
  }

  try {
    const res = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${siteUrl}/api/integrations/hubspot/callback`,
        code,
      }),
    });
    if (!res.ok) throw new Error(`token exchange ${res.status}`);
    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // Persist via Supabase when configured (hubspot_connections table).
    const store = getStore();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl && process.env.SUPABASE_SERVICE_ROLE) {
      const { getServiceClient } = await import("@/lib/supabase/server");
      await getServiceClient()
        .from("hubspot_connections")
        .upsert({
          workspace_id: WORKSPACE_ID,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          direction: "two_way",
        });
    }
    await store.addSyncLog({
      workspaceId: WORKSPACE_ID,
      at: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      msg: "HubSpot OAuth connected (two-way sync enabled)",
      state: "ok",
    });
    return NextResponse.redirect(`${siteUrl}/admin/integrations?connected=hubspot`);
  } catch {
    return NextResponse.redirect(`${siteUrl}/admin/integrations?error=hubspot_oauth_failed`);
  }
}
