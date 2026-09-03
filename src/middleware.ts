import { NextResponse, type NextRequest } from "next/server";

// Sticky A/B variant assignment for funnel pages.
// First visit to /f/<slug> rolls a weighted die and pins the variant in a
// cookie for 90 days; the page component reads the cookie for SSR.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const match = pathname.match(/^\/f\/([^/]+)$/);
  if (!match) return NextResponse.next();

  const slug = match[1];
  const cookieName = `po_variant_${slug}`;
  if (request.cookies.get(cookieName)) return NextResponse.next();

  const response = NextResponse.next();
  // Weighted assignment happens server-side in the page (it knows the funnel's
  // splits); middleware only rolls the die so the assignment is sticky and
  // available during SSR. Store a stable 0–99 roll.
  const roll = Math.floor(Math.random() * 100);
  response.cookies.set(cookieName, String(roll), {
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
    sameSite: "lax",
  });
  return response;
}

export const config = {
  matcher: ["/f/:slug*"],
};
