import { useQuery, useQueryClient } from "@tanstack/react-query";
import MembersPanel from "@/components/admin/MembersPanel";
import { getStore } from "@/lib/store";
import { useSession } from "@/lib/session";
import { can, ROLE_DESCRIPTIONS, roleLabel } from "@/lib/roles";
import { Loader2 } from "lucide-react";

const networkKpis = [
  { label: "Network leads (30d)", value: "263", delta: "▲ 11% vs prior", tone: "up" },
  { label: "Avg. workspace CVR", value: "5.9%", delta: "▲ 0.4pt vs prior", tone: "up" },
  { label: "Active workspaces", value: "3", delta: "1 onboarding", tone: "warn" },
  { label: "Network MRR", value: "$657", delta: "▲ $79 vs prior", tone: "up" },
];

const message = (error: unknown) => (error instanceof Error ? error.message : "unknown error");

export default function NetworkPage() {
  const store = getStore();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const role = session?.user.role;
  const showPartners = can(role, "partners.read");

  const members = useQuery({ queryKey: ["members"], queryFn: () => store.listMembers() });
  // The partner list is platform-wide, so only roles allowed to see it ask for
  // it, and a failure there never takes the member directory down with it.
  const partners = useQuery({
    queryKey: ["partners"],
    queryFn: () => store.listPartnerWorkspaces(),
    enabled: showPartners,
  });

  if (!session || members.isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>;
  }

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["members"] });

  return (
    <section>
      <div className="adm-title-row">
        <h1>Users &amp; Partner Network</h1>
        {can(role, "members.invite") && <MembersPanel.InviteButton />}
      </div>

      {showPartners && (
        <div className="kpi-grid" style={{ gap: 14, marginTop: 22 }}>
          {networkKpis.map((k) => (
            <div key={k.label} className="kpi-card" style={{ padding: "18px 20px" }}>
              <div className="kpi-label" style={{ fontSize: 11 }}>
                {k.label}
              </div>
              <div className="kpi-value" style={{ fontSize: 26, marginTop: 4 }}>
                {k.value}
              </div>
              <div className={`kpi-delta ${k.tone}`} style={{ fontSize: 11.5, marginTop: 2 }}>
                {k.delta}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="wl-grid" style={{ marginTop: 16 }}>
        <div className="adm-card">
          <div className="adm-card-label">Role hierarchy</div>
          <div style={{ marginTop: 16 }}>
            {ROLE_DESCRIPTIONS.map((r) => (
              <div key={r.role} className="role-row">
                <span className={`pill ${r.cls} role-badge`}>{roleLabel(r.role)}</span>
                <div className="desc">{r.desc}</div>
              </div>
            ))}
          </div>
        </div>
        {members.error ? (
          <div className="adm-card">
            <div className="adm-card-label">Members</div>
            <p className="adm-subtle" style={{ marginTop: 12, fontSize: 13 }}>
              Could not load members: {message(members.error)}
            </p>
          </div>
        ) : (
          <MembersPanel
            members={members.data ?? []}
            actorRole={role ?? ""}
            actorId={session.user.id}
            onChanged={refresh}
          />
        )}
      </div>

      {showPartners && (
        <div className="adm-card" style={{ marginTop: 16 }}>
          <div className="adm-title-row">
            <div>
              <div className="adm-card-title">Partner workspaces</div>
              <div className="adm-subtle" style={{ fontSize: 12, marginTop: 3 }}>
                Every workspace created through partner signup, each with its own brand, guide
                page, funnels, and CRM.
              </div>
            </div>
          </div>
          {partners.isLoading ? (
            <div className="p-6 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>
          ) : partners.error ? (
            <p className="adm-subtle" style={{ marginTop: 12, fontSize: 13 }}>
              Could not load partner workspaces: {message(partners.error)}
            </p>
          ) : !partners.data?.length ? (
            <p className="adm-subtle" style={{ marginTop: 12, fontSize: 13 }}>
              No partner workspaces yet. Each partner signup creates one.
            </p>
          ) : (
            <div className="partner-grid">
              {partners.data.map((p) => {
                const typeLabel =
                  p.type === "eos_implementer"
                    ? "EOS Implementer"
                    : p.type === "consultant"
                      ? "Ops Consultant"
                      : "Other";
                const created = p.createdAt
                  ? new Date(p.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                  : "";
                return (
                  <div key={p.id} className="partner-card">
                    <div className="head">
                      <span className="name">{p.name}</span>
                      <span className={`pill ${p.isPublic ? "ok" : "warn"}`}>
                        {p.isPublic ? "Live" : "Private"}
                      </span>
                    </div>
                    <div className="domain">{p.customDomain ?? p.slug ?? p.domain}</div>
                    <div style={{ marginTop: 10 }}>
                      <span className={`pill ${p.type === "eos_implementer" ? "info" : "neutral"}`}>
                        {typeLabel}
                      </span>
                    </div>
                    <div className="stats">
                      <span>
                        <strong>{p.memberCount ?? 0}</strong> {p.memberCount === 1 ? "member" : "members"}
                      </span>
                      {created && <span>created {created}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
