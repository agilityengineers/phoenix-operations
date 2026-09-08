import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import UserAvatar from "@/components/admin/UserAvatar";
import { SESSION_QUERY_KEY, useSession } from "@/lib/session";
import { roleLabel } from "@/lib/roles";
import {
  changePassword,
  profileErrorMessage,
  removeProfilePhoto,
  squareImageDataUrl,
  updateProfileName,
  uploadProfilePhoto,
} from "@/lib/profile";
import { Loader2 } from "lucide-react";

/**
 * Your account — the one admin screen that is about the person rather than the
 * workspace. Every role reaches it (it is not in the permissioned nav; the
 * profile button in the sidebar is its door), because everyone owns their own
 * name, password and photo.
 *
 * The photo here is the account's. The workspace's guide photo lives in
 * Branding & White Label and is a different thing: the brand's face on the
 * public site, shared by every member.
 */

type Note = { tone: "ok" | "error"; text: string } | null;

/** A saved/failed line under one card, cleared when that card is edited again. */
function NoteLine({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <p className={`settings-note ${note.tone}`} role={note.tone === "error" ? "alert" : "status"}>
      {note.text}
    </p>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: session, isLoading } = useSession();
  const refreshSession = () => queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });

  const [name, setName] = useState("");
  const [profileNote, setProfileNote] = useState<Note>(null);
  const [savingName, setSavingName] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const [photoNote, setPhotoNote] = useState<Note>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordNote, setPasswordNote] = useState<Note>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  // Seed the name field once the session lands, and follow it if the account is
  // renamed elsewhere — but never while the field is being edited.
  const sessionName = session?.user.name ?? "";
  useEffect(() => setName(sessionName), [sessionName]);

  if (isLoading || !session) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>;
  }

  const user = session.user;
  const role = session.workspace.role ?? user.role;

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    const next = name.trim();
    if (!next || next === user.name) return;
    setSavingName(true);
    setProfileNote(null);
    try {
      await updateProfileName(next);
      await refreshSession();
      // The member directory renders names from the same account rows.
      await queryClient.invalidateQueries({ queryKey: ["members"] });
      setProfileNote({ tone: "ok", text: "Name updated." });
    } catch (error) {
      setProfileNote({ tone: "error", text: profileErrorMessage(error) });
    } finally {
      setSavingName(false);
    }
  };

  const choosePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input straight away, so re-picking the same file still fires.
    event.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    setPhotoNote(null);
    try {
      await uploadProfilePhoto(await squareImageDataUrl(file));
      await refreshSession();
      await queryClient.invalidateQueries({ queryKey: ["members"] });
      setPhotoNote({ tone: "ok", text: "Photo updated." });
    } catch (error) {
      setPhotoNote({ tone: "error", text: profileErrorMessage(error) });
    } finally {
      setPhotoBusy(false);
    }
  };

  const dropPhoto = async () => {
    setPhotoBusy(true);
    setPhotoNote(null);
    try {
      await removeProfilePhoto();
      await refreshSession();
      await queryClient.invalidateQueries({ queryKey: ["members"] });
      setPhotoNote({ tone: "ok", text: "Photo removed. Your initials show instead." });
    } catch (error) {
      setPhotoNote({ tone: "error", text: profileErrorMessage(error) });
    } finally {
      setPhotoBusy(false);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordNote(null);
    if (newPassword !== confirmPassword) {
      setPasswordNote({ tone: "error", text: "The two new passwords do not match." });
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordNote({ tone: "ok", text: "Password changed. You stay signed in here." });
    } catch (error) {
      setPasswordNote({ tone: "error", text: profileErrorMessage(error) });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <section>
      <div className="adm-title-row">
        <h1>Your account</h1>
      </div>
      <p className="adm-lede">
        Your name, photo and password belong to you, not to a workspace — they follow you into
        every workspace you are a member of.
      </p>

      <div className="wl-grid" style={{ marginTop: 16 }}>
        <div className="adm-card">
          <div className="adm-card-label">Profile photo</div>
          <div className="settings-photo-row">
            <UserAvatar name={user.name} email={user.email} src={user.avatarUrl} size={84} />
            <div className="settings-photo-actions">
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={(event) => void choosePhoto(event)}
                hidden
              />
              <button
                type="button"
                className="adm-btn sm"
                disabled={photoBusy}
                onClick={() => fileInput.current?.click()}
              >
                {photoBusy ? "Working…" : user.avatarUrl ? "Replace photo" : "Upload photo"}
              </button>
              {user.avatarUrl && (
                <button type="button" className="adm-btn-outline sm" disabled={photoBusy} onClick={() => void dropPhoto()}>
                  Remove
                </button>
              )}
              <p className="adm-subtle" style={{ fontSize: 12, margin: 0 }}>
                JPEG, PNG, GIF or WebP. It is cropped to a square in your browser before it is
                uploaded, so a photo straight off a phone is fine.
              </p>
              <NoteLine note={photoNote} />
            </div>
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-card-label">Profile</div>
          <form onSubmit={(event) => void saveName(event)} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <label className="adm-field">
              Display name
              <input
                className="adm-input"
                value={name}
                maxLength={120}
                onChange={(event) => { setName(event.target.value); setProfileNote(null); }}
              />
            </label>
            <label className="adm-field">
              Email
              <input className="adm-input" value={user.email} readOnly disabled />
            </label>
            <div className="adm-subtle" style={{ fontSize: 12, marginTop: -6 }}>
              Your email is how you sign in and how invitations reach you. An administrator changes
              it by inviting the new address.
            </div>
            <div className="settings-facts">
              <div>
                <span className="label">Role here</span>
                <span className="value">{roleLabel(role)}</span>
              </div>
              <div>
                <span className="label">Workspace</span>
                <span className="value">{session.workspace.name}</span>
              </div>
              <div>
                <span className="label">Memberships</span>
                <span className="value">
                  {session.workspaces.length} workspace{session.workspaces.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button className="adm-btn sm" disabled={savingName || !name.trim() || name.trim() === user.name}>
                {savingName ? "Saving…" : "Save name"}
              </button>
              <NoteLine note={profileNote} />
            </div>
          </form>
        </div>
      </div>

      <div className="adm-card" style={{ marginTop: 16, maxWidth: 520 }}>
        <div className="adm-card-label">Password</div>
        <form onSubmit={(event) => void savePassword(event)} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <label className="adm-field">
            Current password
            <input
              className="adm-input"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => { setCurrentPassword(event.target.value); setPasswordNote(null); }}
            />
          </label>
          <label className="adm-field">
            New password
            <input
              className="adm-input"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => { setNewPassword(event.target.value); setPasswordNote(null); }}
            />
          </label>
          <label className="adm-field">
            Confirm new password
            <input
              className="adm-input"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => { setConfirmPassword(event.target.value); setPasswordNote(null); }}
            />
          </label>
          <div className="adm-subtle" style={{ fontSize: 12, marginTop: -6 }}>
            At least 8 characters, with an uppercase letter, a lowercase letter and a number.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="adm-btn sm" disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}>
              {savingPassword ? "Changing…" : "Change password"}
            </button>
            <NoteLine note={passwordNote} />
          </div>
        </form>
      </div>
    </section>
  );
}
