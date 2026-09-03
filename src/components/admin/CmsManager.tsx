"use client";

import { useState } from "react";
import type { CmsPage } from "@/lib/types";

// Site Content CMS: page list → per-page section modules with drag handle,
// Edit copy affordance, and On/Off toggles. Toggles persist immediately;
// "Publish changes" confirms the live state (public pages read these flags
// on every request).

export default function CmsManager({ initialPages }: { initialPages: CmsPage[] }) {
  const [pages, setPages] = useState(initialPages);
  const [pageId, setPageId] = useState<CmsPage["id"]>(initialPages[0]?.id ?? "home");
  const [published, setPublished] = useState(false);
  const page = pages.find((p) => p.id === pageId);

  const toggle = (sectionId: string) => {
    setPublished(false);
    setPages((ps) =>
      ps.map((p) =>
        p.id !== pageId
          ? p
          : {
              ...p,
              sections: p.sections.map((s) =>
                s.id === sectionId ? { ...s, enabled: !s.enabled } : s
              ),
            }
      )
    );
    const next = !page?.sections.find((s) => s.id === sectionId)?.enabled;
    fetch("/api/cms/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, sectionId, enabled: next }),
    }).catch(() => {});
  };

  return (
    <section>
      <div className="adm-title-row">
        <h1>Site Content</h1>
        <button className="adm-btn" onClick={() => setPublished(true)}>
          {published ? "✓ Published" : "Publish changes"}
        </button>
      </div>
      <p className="adm-lede">
        Every public page is built from modular sections. Toggle sections on or off, edit copy
        inline, and reorder — changes go live on publish.
      </p>
      <div className="cms-grid">
        <div className="cms-pages">
          {pages.map((p) => (
            <button
              key={p.id}
              className={`cms-page-btn${p.id === pageId ? " active" : ""}`}
              onClick={() => setPageId(p.id)}
            >
              {p.name}
              <span className="meta">{p.meta}</span>
            </button>
          ))}
          <button className="cms-new-page">+ New page</button>
        </div>
        <div className="cms-sections">
          {page?.sections.map((s) => (
            <div key={s.id} className="cms-section">
              <div className="row">
                <span className="drag-handle" aria-hidden>
                  ⠿
                </span>
                <div style={{ flex: 1 }}>
                  <div className="name">{s.name}</div>
                  <div className="desc">{s.desc}</div>
                </div>
                <button className="adm-btn-ghost sm">Edit copy</button>
                <button
                  className={`adm-toggle ${s.enabled ? "on" : "off"}`}
                  onClick={() => toggle(s.id)}
                >
                  {s.enabled ? "On" : "Off"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
