import MembersPanel from "@/components/admin/MembersPanel";
import { getStore } from "@/lib/store";
import { partnerStats } from "@/lib/seed";

export const dynamic = "force-dynamic";

// Role hierarchy: Admin (top) → Owner → Staff → Partner.
const roles = [
  {
    name: "Admin",
    cls: "ink",
    desc: "Top of the hierarchy. Full control: branding, white label, users, partner workspaces, integrations, and all CRM data. Invites everyone else.",
  },
  {
    name: "Owner",
    cls: "warn",
    desc: "Runs a workspace: funnels, site content, CRM, and their own staff invites. Cannot touch other workspaces or platform settings.",
  },
  {
    name: "Staff",
    cls: "neutral",
    desc: "Works leads: contacts, pipeline, notes, tasks. No access to funnels, branding, or user management.",
  },
  {
    name: "Partner",
    cls: "ok",
    desc: "An EOS implementer in the network — owner of their own white-labeled workspace, connected to Phoenix Operations for referrals and shared playbooks.",
  },
];

const networkKpis = [
  { label: "Network leads (30d)", value: "263", delta: "▲ 11% vs prior", tone: "up" },
  { label: "Avg. workspace CVR", value: "5.9%", delta: "▲ 0.4pt vs prior", tone: "up" },
  { label: "Active workspaces", value: "3", delta: "1 onboarding", tone: "warn" },
  { label: "Network MRR", value: "$657", delta: "▲ $79 vs prior", tone: "up" },
];

export default async function NetworkPage() {
  const store = getStore();
  const [members, partners] = await Promise.all([
    store.listMembers(),
    store.listPartnerWorkspaces(),
  ]);

  return (
    <section>
      <div className="adm-title-row">
        <h1>Users &amp; Partner Network</h1>
        <MembersPanel.InviteButton />
      </div>

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

      <div className="wl-grid" style={{ marginTop: 16 }}>
        <div className="adm-card">
          <div className="adm-card-label">Role hierarchy</div>
          <div style={{ marginTop: 16 }}>
            {roles.map((r) => (
              <div key={r.name} className="role-row">
                <span className={`pill ${r.cls} role-badge`}>{r.name}</span>
                <div className="desc">{r.desc}</div>
              </div>
            ))}
          </div>
        </div>
        <MembersPanel initialMembers={members} />
      </div>

      <div className="adm-card" style={{ marginTop: 16 }}>
        <div className="adm-title-row">
          <div>
            <div className="adm-card-title">Partner workspaces</div>
            <div className="adm-subtle" style={{ fontSize: 12, marginTop: 3 }}>
              White-labeled instances for EOS implementers in the Phoenix Operations network — each
              with its own brand, guide page, funnels, and CRM.
            </div>
          </div>
          <button className="adm-btn-outline">+ New partner workspace</button>
        </div>
        <div className="partner-grid">
          {partners.map((p) => {
            const stats = partnerStats[p.id] ?? { funnels: "—", leads: "—", users: "—" };
            const typeLabel =
              p.type === "eos_implementer"
                ? "EOS Implementer"
                : p.type === "consultant"
                  ? "Ops Consultant"
                  : "Other";
            return (
              <div key={p.id} className="partner-card">
                <div className="head">
                  <span className="name">{p.name}</span>
                  <span className={`pill ${p.status === "live" ? "ok" : "warn"}`}>
                    {p.status === "live" ? "Live" : "Onboarding"}
                  </span>
                </div>
                <div className="domain">{p.domain}</div>
                <div style={{ marginTop: 10 }}>
                  <span className={`pill ${p.type === "eos_implementer" ? "info" : "neutral"}`}>
                    {typeLabel}
                  </span>
                </div>
                <div className="stats">
                  <span>
                    <strong>{stats.funnels}</strong> funnels
                  </span>
                  <span>
                    <strong>{stats.leads}</strong> leads
                  </span>
                  <span>
                    <strong>{stats.users}</strong> users
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
