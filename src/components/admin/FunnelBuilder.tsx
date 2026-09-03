"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormBlock, Funnel } from "@/lib/types";

// Funnel Builder — audience & offer, StoryBrand narrative editor, A/B variants,
// modular intake blocks (drag to reorder, on/off, condition display), scoring weights.

const STORY_ROLES: Array<{ key: keyof Funnel["storybrand"]; role: string }> = [
  { key: "hero", role: "Hero (prospect)" },
  { key: "problem", role: "Problem" },
  { key: "guide", role: "Guide" },
  { key: "plan", role: "Plan" },
  { key: "success", role: "Success" },
];

export default function FunnelBuilder({ initial }: { initial: Funnel }) {
  const router = useRouter();
  const [funnel, setFunnel] = useState<Funnel>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const set = <K extends keyof Funnel>(key: K, value: Funnel[K]) =>
    setFunnel((f) => ({ ...f, [key]: value }));

  const setStory = (key: keyof Funnel["storybrand"], value: string) =>
    setFunnel((f) => ({ ...f, storybrand: { ...f.storybrand, [key]: value } }));

  const toggleBlock = (id: string) =>
    setFunnel((f) => ({
      ...f,
      blocks: f.blocks.map((b) => (b.id === id ? { ...b, enabled: !b.enabled } : b)),
    }));

  const reorderBlocks = (from: number, to: number) => {
    setFunnel((f) => {
      const blocks = [...f.blocks].sort((a, b) => a.order - b.order);
      const [moved] = blocks.splice(from, 1);
      blocks.splice(to, 0, moved);
      return { ...f, blocks: blocks.map((b, i) => ({ ...b, order: i })) };
    });
  };

  const addVariant = () => {
    const label = String.fromCharCode(65 + funnel.variants.length); // A, B, C…
    const even = Math.floor(100 / (funnel.variants.length + 1));
    setFunnel((f) => ({
      ...f,
      variants: [
        ...f.variants.map((v) => ({ ...v, trafficPct: even })),
        { id: label, label, headline: "", trafficPct: 100 - even * f.variants.length },
      ],
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/funnels/${funnel.id}`, {
        method: funnel.id === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(funnel),
      });
      if (res.ok) {
        const body = (await res.json()) as { funnel?: Funnel };
        if (body.funnel && funnel.id === "new") {
          router.replace(`/admin/funnels/${body.funnel.id}`);
        }
        setSavedAt(new Date().toLocaleTimeString());
      }
    } finally {
      setSaving(false);
    }
  };

  const sortedBlocks = [...funnel.blocks].sort((a, b) => a.order - b.order);
  const weights = [
    { name: "Coachability", pts: funnel.weights.coachability, pct: "100%" },
    { name: "Authority (role)", pts: funnel.weights.authority, pct: "80%" },
    { name: "ICP fit", pts: funnel.weights.icpFit, pct: "90%" },
    { name: "Urgency", pts: funnel.weights.urgency, pct: "60%" },
  ];

  return (
    <section>
      <Link href="/admin/funnels" className="adm-back">
        ← All funnels
      </Link>
      <div className="adm-title-row" style={{ marginTop: 10 }}>
        <h1>{funnel.id === "new" ? "New funnel" : funnel.name}</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {savedAt && <span className="adm-subtle">Saved {savedAt}</span>}
          <span className={`status-pill ${funnel.status}`}>
            {funnel.status === "live" ? "● Live" : funnel.status}
          </span>
          <button className="adm-btn sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="builder-grid">
        <div className="builder-col">
          <div className="adm-card">
            <div className="adm-card-label">Audience &amp; offer</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
              <label className="adm-field">
                Segment
                <input
                  className="adm-input"
                  value={funnel.segment}
                  onChange={(e) => set("segment", e.target.value)}
                />
              </label>
              <label className="adm-field">
                URL slug
                <input
                  className="adm-input"
                  value={funnel.slug}
                  onChange={(e) => set("slug", e.target.value.replace(/[^a-z0-9-]/g, ""))}
                />
              </label>
              <label className="adm-field">
                Offer
                <input
                  className="adm-input"
                  value={funnel.offer}
                  onChange={(e) => set("offer", e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="adm-card">
            <div className="adm-card-label">StoryBrand narrative</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
              {STORY_ROLES.map((s) => (
                <div key={s.key} className="story-row">
                  <span className="role">{s.role}</span>
                  <input
                    value={funnel.storybrand[s.key]}
                    onChange={(e) => setStory(s.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <p className="adm-lede" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 14 }}>
              The prospect is the hero; Phoenix Operations is the guide. Every funnel page renders
              from this same narrative template.
            </p>
          </div>

          <div className="adm-card">
            <div className="adm-title-row">
              <div className="adm-card-label">A/B variants</div>
              <button className="adm-link-btn" onClick={addVariant}>
                + Add variant
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              {funnel.variants.map((v, i) => (
                <div key={v.id} className="variant-row">
                  <div style={{ flex: 1 }}>
                    <span className="label">{v.label} — </span>
                    <input
                      value={v.headline}
                      placeholder="Variant headline"
                      onChange={(e) =>
                        setFunnel((f) => ({
                          ...f,
                          variants: f.variants.map((x, xi) =>
                            xi === i ? { ...x, headline: e.target.value } : x
                          ),
                        }))
                      }
                      style={{
                        border: "none",
                        background: "none",
                        fontSize: 13,
                        fontWeight: 700,
                        width: "70%",
                        padding: 0,
                      }}
                    />
                    <span className="traffic"> · {v.trafficPct}% traffic</span>
                  </div>
                  <span className={`cvr ${i === 0 ? "good" : "meh"}`}>{v.cvr ?? "— CVR"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-title-row">
            <div className="adm-card-label">Intake form — modular blocks</div>
            <button className="adm-link-btn" onClick={() => alert("Block library — coming with the question-bank editor.")}>
              + Add block
            </button>
          </div>
          <p className="adm-lede" style={{ fontSize: 12, lineHeight: 1.5 }}>
            Drag to reorder. Each block is reusable across funnels; question banks come from the
            Conversation Guide.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            {sortedBlocks.map((b: FormBlock, i: number) => (
              <div
                key={b.id}
                className="block-card"
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIdx !== null && dragIdx !== i) reorderBlocks(dragIdx, i);
                  setDragIdx(null);
                }}
              >
                <div className="row">
                  <span className="drag-handle" aria-hidden>
                    ⠿
                  </span>
                  <div style={{ flex: 1 }}>
                    <div className="name">{b.name}</div>
                    <div className="desc">{b.desc}</div>
                  </div>
                  <span className={`req-badge ${b.required ? "required" : "optional"}`}>
                    {b.required ? "Required" : "Optional"}
                  </span>
                  <button
                    className={`adm-toggle ${b.enabled ? "on" : "off"}`}
                    onClick={() => toggleBlock(b.id)}
                  >
                    {b.enabled ? "On" : "Off"}
                  </button>
                </div>
                {b.condition && <div className="block-condition">⤷ Condition: {b.condition}</div>}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, borderTop: "1px solid var(--border-4)", paddingTop: 18 }}>
            <div className="adm-card-label">Scoring weights</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
              {weights.map((w) => (
                <div key={w.name} className="weight-row">
                  <span className="name">{w.name}</span>
                  <div className="weight-track">
                    <div className="weight-fill" style={{ width: w.pct }} />
                  </div>
                  <span className="pts">{w.pts}</span>
                </div>
              ))}
            </div>
            <p className="adm-lede" style={{ fontSize: 12, marginTop: 14 }}>
              Coachability carries the heaviest weight — both direct self-assessment and inferred
              signals.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
