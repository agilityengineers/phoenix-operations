import { NextResponse } from "next/server";

// Starts the HubSpot OAuth flow — redirects to HubSpot's consent screen.
// Scopes cover two-way contact/company sync.
export async function GET(req: Request) {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  if (!clientId) {
    return NextResponse.redirect(
      `${siteUrl}/admin/integrations?error=hubspot_not_configured`
    );
  }
  const redirectUri = `${siteUrl}/api/integrations/hubspot/callback`;
  const scopes = [
    "crm.objects.contacts.read",
    "crm.objects.contacts.write",
    "crm.objects.companies.read",
    "crm.objects.companies.write",
    "crm.objects.deals.read",
    "crm.objects.deals.write",
  ].join(" ");
  const authUrl = new URL("https://app.hubspot.com/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);
  return NextResponse.redirect(authUrl.toString());
}
