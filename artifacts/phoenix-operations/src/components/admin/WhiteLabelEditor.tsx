import { useEffect, useState } from "react";
import type { Workspace } from "@/lib/types";
import { apiRequest } from "@/lib/store/api";

// White Label: brand identity (logo, colors, custom domain) + guide identity
// (photo, name, title, story, guide-band toggle). The guide page and homepage
// band render from this profile — per workspace.

export default function WhiteLabelEditor({ initial }: { initial: Workspace }) {
  const [ws, setWs] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [domain, setDomain] = useState(ws.brand.customDomain ?? "");
  const [savedDomain, setSavedDomain] = useState(ws.brand.customDomain ?? "");
  const [domainStatus, setDomainStatus] = useState<{ state: string; domain?: string; txtName?: string; txtValue?: string } | null>(null);
  const [domainMessage, setDomainMessage] = useState("");
  useEffect(() => { void apiRequest<typeof domainStatus>("/workspace/domain-status").then(setDomainStatus); }, []);
  const verifyDomain = async () => {
    setDomainMessage("");
    try {
      const status = await apiRequest<NonNullable<typeof domainStatus>>("/workspace/domain-verify", { method: "POST", body: "{}" });
      setDomainStatus(status);
      setDomainMessage("DNS ownership verified. The custom domain is now active.");
    } catch (err) {
      setDomainMessage(err instanceof Error ? `Verification failed: ${err.message}` : "DNS verification failed.");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const nextDomain = domain.trim();
      const domainChanged = nextDomain !== savedDomain.trim();
      const result = await apiRequest<{ workspace: Workspace; domain?: NonNullable<typeof domainStatus> }>("/workspace", { method: "PATCH", body: JSON.stringify({
        domain: ws.domain,
        brand: ws.brand,
        guide: ws.guide,
        // Only send it when it actually changed — sending it at all re-triggers
        // DNS verification and clears the verified state.
        ...(domainChanged ? { customDomain: nextDomain || null } : {}),
      }) });
      setWs(result.workspace);
      if (domainChanged) setSavedDomain(nextDomain);
      if (result.domain) setDomainStatus(result.domain);
      setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <div className="adm-title-row">
        <h1>Branding &amp; White Label</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {savedAt && <span className="adm-subtle">Saved {savedAt}</span>}
          <button className="adm-btn sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
      <p className="adm-lede">
        Each partner workspace gets its own brand: logo, colors, domain, and guide identity. The
        Phoenix Operations funnel system and CRM stay the same underneath.
      </p>

      <div className="wl-grid">
        <div className="adm-card">
          <div className="adm-card-label">Brand identity</div>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="logo-drop">
              <img src={ws.brand.logoUrl} alt="Workspace logo" width={148} height={44} style={{ height: 44, width: "auto" }} />
              <div className="hint">
                Logo — PNG/SVG, transparent background
                <br />
                Used on all public pages and emails
              </div>
              <label className="adm-field">Logo image URL<input className="adm-input" type="url" value={ws.brand.logoUrl} onChange={(e) => setWs(w => ({ ...w, brand: { ...w.brand, logoUrl: e.target.value } }))} /></label>
              <label className="adm-field">Mark image URL<input className="adm-input" type="url" value={ws.brand.markUrl} onChange={(e) => setWs(w => ({ ...w, brand: { ...w.brand, markUrl: e.target.value } }))} /></label>
            </div>
            {(["primaryColor", "inkColor", "paperColor"] as const).map(key => <label className="adm-field" key={key}>{key.replace("Color", " color")}<div style={{ display: "flex", gap: 8 }}><input type="color" value={ws.brand[key]} onChange={e => setWs(w => ({ ...w, brand: { ...w.brand, [key]: e.target.value } }))} /><input className="adm-input" value={ws.brand[key]} onChange={e => setWs(w => ({ ...w, brand: { ...w.brand, [key]: e.target.value } }))} /></div></label>)}
            <div className="swatch-row">
              <div className="swatch">
                <div className="color" style={{ background: ws.brand.primaryColor }} />
                <div className="label">Primary · {ws.brand.primaryColor.toUpperCase()}</div>
              </div>
              <div className="swatch">
                <div className="color" style={{ background: ws.brand.inkColor }} />
                <div className="label">Ink · {ws.brand.inkColor.toUpperCase()}</div>
              </div>
              <div className="swatch">
                <div
                  className="color"
                  style={{ background: ws.brand.paperColor, border: "1px solid var(--border-3)" }}
                />
                <div className="label">Paper · {ws.brand.paperColor.toUpperCase()}</div>
              </div>
            </div>
            <label className="adm-field">
              Site domain
              <input
                className="adm-input"
                value={ws.domain}
                onChange={(e) => setWs(w => ({ ...w, domain: e.target.value }))}
                placeholder="phoenix-operations.com"
              />
            </label>
            <div className="adm-subtle" style={{ fontSize: 12, marginTop: -6 }}>
              How this workspace refers to itself in the admin and in emails. Changing it does not
              move any traffic.
            </div>
            <label className="adm-field">
              Custom domain
              <input
                className="adm-input"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
            </label>
            <div className="adm-subtle" style={{ fontSize: 12, marginTop: -6 }}>
              The domain that actually serves this workspace. Editing it requires DNS
              verification again.
            </div>
            {domainStatus?.state === "pending" && <div className="adm-subtle">Pending DNS verification. Create TXT <strong>{domainStatus.txtName}</strong> with exact value <strong>{domainStatus.txtValue}</strong>, then <button type="button" className="adm-btn-outline sm" onClick={verifyDomain}>Verify DNS now</button></div>}
            {domainStatus?.state === "verified" && <div className="adm-subtle">Verified: {domainStatus.domain}</div>}
            {domainMessage && <div className="adm-subtle">{domainMessage}</div>}
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-card-label">Guide identity</div>
          <p className="adm-lede" style={{ fontSize: 12, lineHeight: 1.6 }}>
            The &ldquo;Your Guide&rdquo; page, guide band, and testimonial attributions all render
            from this profile — so each implementer&apos;s workspace shows their own guide.
          </p>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="guide-photo-row">
              <img src={ws.guide.photoUrl} alt={ws.guide.name} width={64} height={64} style={{ borderRadius: '50%' }} />
              <label className="adm-field">Guide photo URL<input className="adm-input" type="url" value={ws.guide.photoUrl} onChange={e => setWs(w => ({ ...w, guide: { ...w.guide, photoUrl: e.target.value } }))} /></label>
            </div>
            <label className="adm-field">
              Guide name
              <input
                className="adm-input"
                value={ws.guide.name}
                onChange={(e) => setWs((w) => ({ ...w, guide: { ...w.guide, name: e.target.value } }))}
              />
            </label>
            <label className="adm-field">
              Title
              <input
                className="adm-input"
                value={ws.guide.title}
                onChange={(e) =>
                  setWs((w) => ({ ...w, guide: { ...w.guide, title: e.target.value } }))
                }
              />
            </label>
            <label className="adm-field">
              Guide story (hero copy)
              <textarea
                className="adm-textarea"
                rows={3}
                value={ws.guide.story}
                onChange={(e) =>
                  setWs((w) => ({ ...w, guide: { ...w.guide, story: e.target.value } }))
                }
              />
            </label>
            <div className="wl-toggle-row">
              <span className="label">Show guide band on homepage</span>
              <button
                className={`adm-toggle ${ws.guide.showGuideBand ? "on" : "off"}`}
                onClick={() =>
                  setWs((w) => ({ ...w, guide: { ...w.guide, showGuideBand: !w.guide.showGuideBand } }))
                }
              >
                {ws.guide.showGuideBand ? "On" : "Off"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
