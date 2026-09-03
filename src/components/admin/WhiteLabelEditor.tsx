"use client";

import Image from "next/image";
import { useState } from "react";
import type { Workspace } from "@/lib/types";

// White Label: brand identity (logo, colors, custom domain) + guide identity
// (photo, name, title, story, guide-band toggle). The guide page and homepage
// band render from this profile — per workspace.

export default function WhiteLabelEditor({ initial }: { initial: Workspace }) {
  const [ws, setWs] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: ws.brand, guide: ws.guide, domain: ws.domain }),
      });
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
              <Image src={ws.brand.logoUrl} alt="Workspace logo" width={148} height={44} style={{ height: 44, width: "auto" }} />
              <div className="hint">
                Logo — PNG/SVG, transparent background
                <br />
                Used on all public pages and emails
              </div>
              <button className="adm-btn-outline sm">Replace</button>
            </div>
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
              Custom domain
              <input
                className="adm-input"
                value={ws.brand.customDomain ?? ""}
                onChange={(e) =>
                  setWs((w) => ({ ...w, brand: { ...w.brand, customDomain: e.target.value } }))
                }
              />
            </label>
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
              <Image src={ws.guide.photoUrl} alt={ws.guide.name} width={64} height={64} />
              <button className="adm-btn-outline sm">Replace photo</button>
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
