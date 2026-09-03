import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private/off-limits: link-only results page, admin, auth, APIs.
        disallow: ["/results", "/admin", "/api/", "/login", "/reset", "/signup"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
