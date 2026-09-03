"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import ScorePill from "./ScorePill";
import type { Contact, Pipeline } from "@/lib/types";

// The mini-CRM pipeline: two seeded pipelines (Prospects, Client journey),
// HTML5 drag-and-drop between stages with column highlight, ←/→ fallbacks,
// global + per-column Add card, search + stage filters, CSV import/export.

type Props = {
  pipelines: Pipeline[];
  initialContacts: Contact[];
};

export default function PipelineBoard({ pipelines, initialContacts }: Props) {
  const router = useRouter();
  const [pipelineId, setPipelineId] = useState<string>(pipelines[0]?.id ?? "prospects");
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const pipeline = pipelines.find((p) => p.id === pipelineId) ?? pipelines[0];
  const stages = pipeline?.stages ?? [];

  const filtered = useMemo(
    () =>
      contacts
        .filter((c) => c.pipelineId === pipelineId)
        .filter(
          (c) =>
            (stageFilter === "All" || stages[c.stage] === stageFilter) &&
            (!search ||
              `${c.name}${c.company}${c.email}`.toLowerCase().includes(search.toLowerCase()))
        ),
    [contacts, pipelineId, stageFilter, search, stages]
  );

  const persistStage = (id: string, stage: number) => {
    fetch(`/api/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    }).catch(() => {});
  };

  const moveTo = (id: string, stage: number) => {
    const clamped = Math.max(0, Math.min(stages.length - 1, stage));
    setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, stage: clamped } : c)));
    persistStage(id, clamped);
  };

  const addCard = async (stage: number) => {
    const name = prompt("Contact name:");
    if (!name) return;
    const company = prompt("Company (optional):") || "—";
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, company, pipelineId, stage }),
    });
    if (res.ok) {
      const { contact } = (await res.json()) as { contact: Contact };
      setContacts((cs) => [contact, ...cs]);
    }
  };

  const importCsv = async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    body.append("pipelineId", pipelineId);
    const res = await fetch("/api/contacts/import", { method: "POST", body });
    if (res.ok) {
      const { contacts: imported } = (await res.json()) as { contacts: Contact[] };
      setContacts((cs) => [...imported, ...cs]);
      alert(`Imported ${imported.length} contact${imported.length === 1 ? "" : "s"}.`);
    } else {
      alert("Import failed — expected a CSV with name,company,email,role,phone columns.");
    }
  };

  return (
    <section>
      <div className="adm-title-row">
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <h1>Pipeline</h1>
          <div className="pipeline-tabs">
            {pipelines.map((p) => (
              <button
                key={p.id}
                className={p.id === pipelineId ? "active" : ""}
                onClick={() => {
                  setPipelineId(p.id);
                  setStageFilter("All");
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="adm-btn sm" onClick={() => addCard(0)}>
            + Add card
          </button>
          <button className="adm-btn-ghost" onClick={() => fileInput.current?.click()}>
            Import CSV
          </button>
          <a className="adm-btn-ghost" href={`/api/contacts/export?pipeline=${pipelineId}`}>
            Export CSV
          </a>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      <p className="adm-lede" style={{ fontSize: 12.5 }}>
        {pipeline?.desc} · Drag cards between stages, or use ←/→.
      </p>

      <div className="filter-row">
        <input
          className="filter-search"
          placeholder="Search name, company, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {["All", ...stages].map((name) => (
          <button
            key={name}
            className={`stage-filter${stageFilter === name ? " active" : ""}`}
            onClick={() => setStageFilter(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="board">
        {stages.map((stageName, idx) => {
          const cards = filtered
            .filter((c) => c.stage === idx)
            .sort((a, b) => a.position - b.position);
          return (
            <div
              key={stageName}
              className={`board-col${dragOverCol === idx ? " drag-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverCol !== idx) setDragOverCol(idx);
              }}
              onDragLeave={() => setDragOverCol((c) => (c === idx ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                setDragOverCol(null);
                setDraggingId(null);
                if (id) moveTo(id, idx);
              }}
            >
              <div className="board-col-head">
                <span className="name">{stageName}</span>
                <span className="count">{cards.length}</span>
              </div>
              <div className="board-col-cards">
                {cards.map((c) => (
                  <div
                    key={c.id}
                    className={`contact-card${draggingId === c.id ? " dragging" : ""}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", c.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingId(c.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={() => router.push(`/admin/contacts/${c.id}`)}
                  >
                    <div className="head">
                      <div className="name">{c.name}</div>
                      <ScorePill score={c.score} />
                    </div>
                    <div className="company">{c.company}</div>
                    <div className="tags">
                      <span>{c.funnel}</span>
                      <span>{c.source}</span>
                    </div>
                    <div className="foot">
                      <button
                        className="move-btn"
                        aria-label="Move back"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveTo(c.id, c.stage - 1);
                        }}
                      >
                        ←
                      </button>
                      <button
                        className="move-btn"
                        aria-label="Move forward"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveTo(c.id, c.stage + 1);
                        }}
                      >
                        →
                      </button>
                      <span className="owner">{c.owner}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button className="add-card-btn" onClick={() => addCard(idx)}>
                + Add card
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
