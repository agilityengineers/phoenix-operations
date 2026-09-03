import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import FunnelBuilder from "@/components/admin/FunnelBuilder";
import { getStore } from "@/lib/store";
import type { Funnel } from "@/lib/types";
import { WORKSPACE_ID } from "@/lib/seed";
import { Loader2 } from "lucide-react";

// "New funnel" starts from the reusable template with blank audience fields.
function blankFunnel(): Funnel {
  return {
    id: "new",
    workspaceId: WORKSPACE_ID,
    name: "New funnel",
    slug: "",
    segment: "",
    offer: "Free 15-minute conversation — no pitch",
    status: "draft",
    kicker: "",
    problemCopy: "",
    stakes: ["", "", ""],
    storybrand: { hero: "", problem: "", guide: "", plan: "", success: "" },
    variants: [{ id: "A", label: "A", headline: "", trafficPct: 100 }],
    blocks: [
      { id: "frustration", name: "Frustration deep-dive", desc: "3 questions · Conversation Guide", required: true, enabled: true, order: 0 },
      { id: "firmographics", name: "Business profile", desc: "Industry, revenue, team size, clients, years", required: true, enabled: true, order: 1 },
      { id: "contact", name: "Contact info", desc: "Name, email, company, phone, role", required: true, enabled: true, order: 2 },
      { id: "ownerJoin", name: "Owner attendance", desc: "Shown only when respondent is not the owner/CEO", required: false, enabled: true, order: 3, condition: "role ≠ Owner/Founder and role ≠ CEO/President" },
      { id: "coachability", name: "Coachability self-assessment", desc: '2 Likert questions + "what have you tried"', required: true, enabled: true, order: 4 },
    ],
    weights: { icpFit: 40, coachability: 25, authority: 20, urgency: 15 },
    stats: { visits: 0, leads: 0, cvr: "—" },
  };
}

export default function BuilderPage() {
  const params = useParams<{ id: string }>();
  const [_, setLocation] = useLocation();
  const store = getStore();

  const { data: funnel, isLoading, isError } = useQuery({
    queryKey: ["funnelDetail", params?.id],
    queryFn: async () => {
      if (!params?.id) throw new Error("No ID");
      return params.id === "new" ? blankFunnel() : await store.getFunnelById(params.id);
    },
    enabled: !!params?.id,
  });

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>;
  }

  if (isError || !funnel) {
    setLocation("/admin/funnels");
    return null;
  }

  return <FunnelBuilder initial={funnel} />;
}
