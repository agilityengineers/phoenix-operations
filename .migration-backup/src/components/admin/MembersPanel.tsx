"use client";

import { useCallback, useEffect, useState } from "react";
import type { Member } from "@/lib/types";

// Members list + working invite flow. The "+ Invite user" button lives in the
// page header (a server component), so it reaches this panel via a DOM event.

function InviteButton() {
  return (
    <button
      className="adm-btn"
      onClick={() => window.dispatchEvent(new CustomEvent("po:invite-user"))}
    >
      + Invite user
    </button>
  );
}

function MembersPanel({ initialMembers }: { initialMembers: Member[] }) {
  const [members, setMembers] = useState(initialMembers);

  const invite = useCallback(async () => {
    const email = prompt("Invite by email:");
    if (!email || !/.+@.+\..+/.test(email)) return;
    const res = await fetch("/api/members/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: "staff" }),
    });
    if (res.ok) {
      const { member } = (await res.json()) as { member: Member };
      setMembers((m) => [...m, member]);
    }
  }, []);

  useEffect(() => {
    const handler = () => void invite();
    window.addEventListener("po:invite-user", handler);
    return () => window.removeEventListener("po:invite-user", handler);
  }, [invite]);

  return (
    <div className="adm-card">
      <div className="adm-card-label">Members</div>
      <div style={{ marginTop: 12 }}>
        {members.map((m) => (
          <div key={m.id} className="member-row">
            <div>
              <div className="name">{m.name}</div>
              <div className="email">{m.email}</div>
            </div>
            <span
              className={`pill ${m.role === "admin" ? "ink" : m.role === "partner" ? "ok" : "neutral"}`}
            >
              {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
            </span>
            <span className={`pill ${m.state === "active" ? "ok" : "warn"}`}>
              {m.state.charAt(0).toUpperCase() + m.state.slice(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

MembersPanel.InviteButton = InviteButton;
export default MembersPanel;
