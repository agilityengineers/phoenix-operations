import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import IntakeExperience from "@/components/funnel/IntakeExperience";
import { getStore } from "@/lib/store";
import type { FunnelVariant } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const funnel = await getStore().getFunnelBySlug(slug);
  if (!funnel) return {};
  return {
    title: `${funnel.name} — Free 15-Minute Conversation`,
    description: funnel.problemCopy,
    alternates: { canonical: `/f/${slug}` },
  };
}

// Weighted, sticky variant pick: middleware pins a 0–99 roll per visitor;
// we walk the traffic splits so the same roll always lands on the same variant.
function pickVariant(variants: FunnelVariant[], roll: number): FunnelVariant {
  if (variants.length === 0) {
    return { id: "A", label: "A", headline: "", trafficPct: 100 };
  }
  let acc = 0;
  for (const v of variants) {
    acc += v.trafficPct;
    if (roll < acc) return v;
  }
  return variants[0];
}

export default async function FunnelPage({ params }: Params) {
  const { slug } = await params;
  const store = getStore();
  const [funnel, workspace] = await Promise.all([
    store.getFunnelBySlug(slug),
    store.getWorkspace(),
  ]);
  if (!funnel || funnel.status === "draft") notFound();

  const cookieStore = await cookies();
  const roll = Number(cookieStore.get(`po_variant_${slug}`)?.value ?? "0");
  const variant = pickVariant(funnel.variants, Number.isFinite(roll) ? roll % 100 : 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${funnel.name} — Free 15-Minute Conversation`,
    description: funnel.problemCopy,
    provider: { "@type": "Organization", name: workspace.name },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <IntakeExperience funnel={funnel} variant={variant} guide={workspace.guide} />
    </>
  );
}
