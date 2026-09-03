import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import IntakeExperience from "@/components/funnel/IntakeExperience";
import { getPublicStore } from "@/lib/store";
import type { FunnelVariant } from "@/lib/types";

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

export default function FunnelPage() {
  const params = useParams<{ slug: string }>();
  const store = getPublicStore();

  const { data } = useQuery({
    queryKey: ["funnel", params?.slug],
    queryFn: async () => {
      if (!params?.slug) return null;
      const [funnel, workspace] = await Promise.all([
        store.getFunnelBySlug(params.slug),
        store.getWorkspace(),
      ]);
      return { funnel, workspace };
    },
    enabled: !!params?.slug,
  });

  if (!data?.funnel || data.funnel.status === "draft") return null;

  // In a real browser app, we'd read this from a cookie or localStorage.
  // We'll mock the roll to 0 for the demo.
  const roll = 0;
  const variant = pickVariant(data.funnel.variants, Number.isFinite(roll) ? roll % 100 : 0);

  return (
    <>
      <IntakeExperience funnel={data.funnel} variant={variant} guide={data.workspace.guide} workspace={data.workspace} />
    </>
  );
}
