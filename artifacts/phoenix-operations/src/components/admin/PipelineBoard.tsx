import { useLocation } from "wouter";
import { useMemo, useRef, useState } from "react";
import ScorePill from "./ScorePill";
import type { Contact, Pipeline } from "@/lib/types";
import { getStore } from "@/lib/store";
import { parseCsv, toCsv } from "@/lib/csv";

// The mini-CRM pipeline: two seeded pipelines (Prospects, Client journey),
// HTML5 drag-and-drop between stages with column highlight, ←/→ fallbacks,
// global + per-column Add card, search + stage filters, CSV import/export.

type Props = {
  pipelines: Pipeline[];
  initialContacts: Contact[];
};

export default function PipelineBoard({ pipelines, initialContacts }: Props) {
  const [_, setLocation] = useLocation();
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

  const persistStage = async (id: string, stage: number) => {
    await getStore().updateContact(id, { stage });
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
    
    const contact = await getStore().createContact({
      workspaceId: pipeline.workspaceId,
      name,
      company,
      pipelineId,
      stage,
      email: "",
      phone: "",
      role: "",
      funnel: "Manual entry",
      source: "manual",
      score: 50,
      owner: "J.K.",
      position: 0,
    });
    setContacts((cs) => [contact, ...cs]);
  };

  const importCsv = async (file: File) => {
    const rows = parseCsv(await file.text());
    const created = await Promise.all(
      rows.slice(0, 500).map((row) => {
        const importedPipeline = pipelines.find((candidate) => candidate.id === row.pipeline) ?? pipeline;
        const stage = importedPipeline.stages.indexOf(row.stage ?? "");
        return getStore().createContact({
          workspaceId: pipeline.workspaceId,
          pipelineId: importedPipeline.id,
          name: row.name || [row.first_name, row.last_name].filter(Boolean).join(" ") || "Imported contact",
          company: row.company || "—",
          role: row.role || "—",
          email: row.email || "—",
          phone: row.phone,
          funnel: row.funnel || "Import",
          source: row.source || "csv import",
          score: Number(row.score) || 50,
          stage: stage >= 0 ? stage : Number(row.stage) || 0,
          position: 0,
          owner: row.owner || "—",
        });
      }),
    );
    setContacts((current) => [...created, ...current]);
  };

  const exportCsv = () => {
    const rows = contacts
      .filter((contact) => contact.pipelineId === pipelineId)
      .map((contact) => ({
        name: contact.name,
        company: contact.company,
        email: contact.email,
        phone: contact.phone,
        role: contact.role,
        pipeline: contact.pipelineId,
        stage: stages[contact.stage] ?? String(contact.stage),
        score: contact.score,
        funnel: contact.funnel,
        source: contact.source,
        owner: contact.owner,
        created_at: contact.createdAt,
      }));
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `contacts-${pipelineId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
          <button className="adm-btn-ghost" type="button" onClick={exportCsv}>
            Export CSV
          </button>
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
                    onClick={() => setLocation(`/admin/contacts/${c.id}`)}
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
