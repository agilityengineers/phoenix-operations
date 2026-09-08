import { useCallback, useEffect, useState } from "react";
import type { Member } from "@/lib/types";
import { getStore } from "@/lib/store";

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

    const requestedRole = prompt("Role: admin, owner, staff, or partner", "staff")?.trim().toLowerCase();
    if (!requestedRole) return;
    if (!["admin", "owner", "staff", "partner"].includes(requestedRole)) {
      alert("Please choose admin, owner, staff, or partner.");
      return;
    }

    try {
      const member = await getStore().inviteMember(email, requestedRole as Member["role"]);
      setMembers((m) => [...m, member]);
      if (member.inviteDelivery?.status === "sent") {
        const expires = member.inviteExpiresAt
          ? new Date(member.inviteExpiresAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
          : "7 days";
        alert(`Invitation emailed to ${email} with the ${requestedRole} role. It expires ${expires}.`);
        return;
      }
      if (member.invitePath) {
        const inviteUrl = new URL(member.invitePath, window.location.origin).toString();
        const reason =
          member.inviteDelivery?.reason === "email_not_configured"
            ? "Email delivery is not configured."
            : "The email could not be delivered.";
        try {
          await navigator.clipboard.writeText(inviteUrl);
          alert(`${reason} The reusable ${requestedRole} invitation link was copied to your clipboard.`);
        } catch {
          prompt(`${reason} Share this reusable ${requestedRole} invitation link:`, inviteUrl);
        }
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to invite this user.");
    }
  }, []);

  const revoke = useCallback(async (member: Member) => {
    if (!confirm(`Revoke the pending invitation for ${member.email}? The link they were sent stops working.`)) return;
    try {
      const revoked = await getStore().revokeInvite(member.email);
      setMembers((m) => m.map((value) => (value.id === member.id ? revoked ?? { ...value, state: "revoked" } : value)));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to revoke this invitation.");
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
            <span className={`pill ${m.state === "active" ? "ok" : m.state === "revoked" ? "neutral" : "warn"}`}>
              {m.state.charAt(0).toUpperCase() + m.state.slice(1)}
            </span>
            {m.state === "invited" ? (
              <button type="button" className="member-revoke" onClick={() => void revoke(m)}>
                Revoke
              </button>
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

MembersPanel.InviteButton = InviteButton;
export default MembersPanel;
