import { Link } from "wouter";
import { useState } from "react";
import type { Activity, Contact } from "@/lib/types";
import { tagList } from "@/lib/scoring";
import { getStore } from "@/lib/store";

// Contact detail: profile + ink score card with tags, field list, sync status,
// activity timeline with + Note / + Task that prepend entries.

const DOT_STYLES: Record<Activity["type"], { color: string; glyph: string }> = {
  note: { color: "#D96C2C", glyph: "✎" },
  task: { color: "#B5541C", glyph: "☐" },
  intake_completed: { color: "#2E7D43", glyph: "✓" },
  intake_started: { color: "#3A5474", glyph: "◔" },
  view: { color: "#B4AC98", glyph: "👁" },
  email: { color: "#B4AC98", glyph: "✉" },
  call: { color: "#2E7D43", glyph: "☎" },
  stage_change: { color: "#3A5474", glyph: "⇄" },
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type Props = {
  contact: Contact;
  initialActivities: Activity[];
  stageName: string;
};

export default function ContactDetail({ contact, initialActivities, stageName }: Props) {
  const [activities, setActivities] = useState(initialActivities);

  const initials = contact.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  const addEntry = async (type: "note" | "task") => {
    const body = prompt(type === "note" ? "Note:" : "Task (due date in text):");
    if (!body) return;
    const title = type === "note" ? "Note added" : "Task created";
    // Optimistic prepend, then persist.
    const optimistic: Activity = {
      id: `tmp_${Date.now()}`,
      workspaceId: contact.workspaceId,
      contactId: contact.id,
      type,
      title,
      body,
      at: new Date().toISOString(),
    };
    setActivities((a) => [optimistic, ...a]);
    await getStore().addActivity({
      workspaceId: contact.workspaceId,
      contactId: contact.id,
      type,
      title,
      body,
    });
  };

  const fields: Array<[string, string]> = [
    ["Email", contact.email],
    ["Funnel", contact.funnel],
    ["Source", contact.source],
    ["Stage", stageName],
    ["Owner", contact.owner],
    [
      "Created",
      new Date(contact.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    ],
  ];
  if (contact.phone) fields.splice(1, 0, ["Phone", contact.phone]);
  if (contact.bookedSlot) fields.push(["Booked", `${contact.bookedSlot} ET`]);

  return (
    <section>
      <Link href="/admin/contacts" className="adm-back">
        ← All contacts
      </Link>
      <div className="detail-grid">
        <div className="detail-col">
          <div className="adm-card">
            <div className="detail-id">
              <span className="avatar">{initials}</span>
              <div>
                <div className="name">{contact.name}</div>
                <div className="meta">
                  {contact.role} · {contact.company}
                </div>
              </div>
            </div>
            <div className="score-card">
              <span className="score">{contact.score}</span>
              <div className="label">
                Qualification score
                <br />
                <span className="tags">{tagList(contact.score).join(" · ")}</span>
              </div>
            </div>
            <div className="detail-fields">
              {fields.map(([k, v]) => (
                <div key={k} className="detail-field">
                  <span className="k">{k}</span>
                  <span className="v">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="adm-card" style={{ padding: "20px 24px" }}>
            <div className="adm-card-label" style={{ fontSize: 13 }}>
              Sync status
            </div>
            <div className="sync-rows">
              <div className="sync-row">
                <span className="k">HubSpot contact</span>
                <span>Unavailable</span>
              </div>
              <div className="sync-row">
                <span className="k">Zapier — new_lead</span>
                <span>Unavailable</span>
              </div>
              <div className="sync-row">
                <span className="k">SendGrid confirmation</span>
                <span>Unavailable</span>
              </div>
            </div>
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-title-row">
            <div className="adm-card-title">Activity timeline</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="adm-btn-outline sm" onClick={() => addEntry("note")}>
                + Note
              </button>
              <button className="adm-btn-ghost sm" onClick={() => addEntry("task")}>
                + Task
              </button>
            </div>
          </div>
          <div className="timeline">
            {activities.map((t, i) => {
              const dot = DOT_STYLES[t.type] ?? DOT_STYLES.note;
              return (
                <div key={t.id} className="timeline-item">
                  <div className="timeline-rail">
                    <span className="timeline-dot" style={{ background: dot.color }}>
                      {dot.glyph}
                    </span>
                    {i < activities.length - 1 && <span className="line" />}
                  </div>
                  <div>
                    <div className="head">
                      <span className="title">{t.title}</span>
                      <span className="when">{formatWhen(t.at)}</span>
                    </div>
                    <div className="body">{t.body}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
