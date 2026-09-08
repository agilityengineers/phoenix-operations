import { useCallback, useEffect, useMemo, useState } from "react";
import type { Member } from "@/lib/types";
import { getStore } from "@/lib/store";
import { assignableRoles, can, outranksOrEquals, roleLabel, type Role } from "@/lib/roles";

// Members list + working invite flow. The "+ Invite user" button lives in the
// page header, so it reaches this panel via a DOM event.

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

const ERROR_COPY: Record<string, string> = {
  email_taken: "That email already signs in to another workspace. One login belongs to exactly one workspace.",
  already_member: "That person is already a member of this workspace.",
  role_not_assignable: "You can only assign roles at or below your own.",
  outranked: "You cannot change someone ranked above you.",
  cannot_change_own_role: "You cannot change your own role. Ask another admin.",
  cannot_remove_self: "You cannot remove your own account.",
  invalid_email: "That does not look like an email address.",
  invalid_role: "That is not a valid role.",
  invites_unavailable: "Invitations are unavailable until the server has a session secret.",
  forbidden: "Your role does not allow that.",
};
const describe = (error: unknown) => {
  const code = error instanceof Error ? error.message : "";
  return ERROR_COPY[code] ?? (code || "Something went wrong.");
};

const pillClass = (role: string) =>
  role === "super_admin" || role === "admin" ? "ink" : role === "owner" ? "warn" : role === "partner" ? "ok" : "neutral";

type Props = {
  members: Member[];
  /** Role of the signed-in user, which decides what this panel lets them do. */
  actorRole: string;
  /** Id of the signed-in user, so their own row stays read-only. */
  actorId: string;
  /** Called after any change, so the page can refetch the directory. */
  onChanged: () => void;
};

function MembersPanel({ members, actorRole, actorId, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const roles = useMemo(() => assignableRoles(actorRole), [actorRole]);
  const canManage = can(actorRole, "members.manage");
  const editable = (m: Member) => canManage && m.id !== actorId && outranksOrEquals(actorRole, m.role);

  const invite = useCallback(async () => {
    const email = prompt("Invite by email:");
    if (!email || !/.+@.+\..+/.test(email)) return;
    const choices = roles.join(", ");
    const suggested = roles.includes("staff") ? "staff" : roles[roles.length - 1];
    const requestedRole = prompt(`Role (${choices}):`, suggested)?.trim().toLowerCase();
    if (!requestedRole) return;
    if (!roles.includes(requestedRole as Role)) {
      alert(`You can assign ${choices}.`);
      return;
    }
    try {
      const member = await getStore().inviteMember(email, requestedRole as Role);
      onChanged();
      const label = roleLabel(requestedRole);
      if (member.inviteDelivery?.status === "sent") {
        const expires = member.inviteExpiresAt
          ? new Date(member.inviteExpiresAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
          : "7 days";
        alert(`Invitation emailed to ${email} with the ${label} role. It expires ${expires}.`);
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
          alert(`${reason} The ${label} invitation link was copied to your clipboard. It only works for ${email}.`);
        } catch {
          prompt(`${reason} Share this ${label} invitation link with ${email}:`, inviteUrl);
        }
      }
    } catch (error) {
      alert(describe(error));
    }
  }, [roles, onChanged]);

  useEffect(() => {
    const handler = () => void invite();
    window.addEventListener("po:invite-user", handler);
    return () => window.removeEventListener("po:invite-user", handler);
  }, [invite]);

  const changeRole = async (m: Member, role: Role) => {
    if (role === m.role) return;
    setBusyId(m.id);
    try {
      await getStore().updateMemberRole(m.id, role);
      onChanged();
    } catch (error) {
      alert(describe(error));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (m: Member) => {
    const verb = m.state === "invited" ? "Revoke the invitation for" : "Remove";
    if (!confirm(`${verb} ${m.email}?`)) return;
    setBusyId(m.id);
    try {
      await getStore().removeMember(m.id);
      onChanged();
    } catch (error) {
      alert(describe(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="adm-card">
      <div className="adm-card-label">Members</div>
      <div style={{ marginTop: 12 }}>
        {members.length === 0 && <p className="adm-subtle" style={{ fontSize: 13 }}>No members yet.</p>}
        {members.map((m) => (
          <div key={m.id} className="member-row">
            <div>
              <div className="name">{m.name}{m.id === actorId ? " (you)" : ""}</div>
              <div className="email">{m.email}</div>
            </div>
            {editable(m) ? (
              <select
                aria-label={`Role for ${m.email}`}
                className={`pill ${pillClass(m.role)}`}
                value={m.role}
                disabled={busyId === m.id}
                onChange={(e) => void changeRole(m, e.target.value as Role)}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
            ) : (
              <span className={`pill ${pillClass(m.role)}`}>{roleLabel(m.role)}</span>
            )}
            <span className={`pill ${m.state === "active" ? "ok" : "warn"}`}>
              {m.state.charAt(0).toUpperCase() + m.state.slice(1)}
            </span>
            {editable(m) && (
              <button
                type="button"
                className="adm-btn-outline"
                disabled={busyId === m.id}
                onClick={() => void remove(m)}
              >
                {m.state === "invited" ? "Revoke" : "Remove"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

MembersPanel.InviteButton = InviteButton;
export default MembersPanel;
