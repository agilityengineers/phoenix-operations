import type { MetadataRoute } from "next";
import { getStore } from "@/lib/store";

// The private Results page is deliberately excluded (link-only, noindex).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const funnels = await getStore().listFunnels();

  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/guide`, changeFrequency: "monthly", priority: 0.8 },
    ...funnels
      .filter((f) => f.status === "live")
      .map((f) => ({
        url: `${base}/f/${f.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.9,
      })),
    { url: `${base}/legal/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/legal/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
