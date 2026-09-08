import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link } from "wouter";
import AdminNav from "@/components/admin/AdminNav";
import UserAvatar from "@/components/admin/UserAvatar";
import { getStore } from "@/lib/store";
import { activeWorkspaceSlug, useSession } from "@/lib/session";
import { adminLoginHref, publicSiteHref } from "@/lib/site-links";
import { roleLabel } from "@/lib/roles";
import { Loader2, Settings } from "lucide-react";

const basePath = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isLoading: sessionLoading } = useSession();
  useEffect(() => {
    if (!sessionLoading && !session) {
      window.location.replace(adminLoginHref());
    }
  }, [session, sessionLoading]);

  const { data: workspace, isLoading } = useQuery({
    queryKey: ["workspace"],
    queryFn: () => getStore().getWorkspace(),
    enabled: Boolean(session),
  });

  if (isLoading || sessionLoading) {
    return <div className="adm-shell items-center justify-center"><Loader2 className="animate-spin text-orange-500 w-8 h-8" /></div>;
  }

  if (!session) {
    return (
      <div className="adm-shell items-center justify-center">
        <div className="text-sm text-slate-600">Redirecting to sign in…</div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="adm-shell items-center justify-center">
        <div className="text-center">
          <p className="font-medium text-slate-900">Workspace unavailable</p>
          <button type="button" className="adm-btn mt-4" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    // A full navigation, like the unauthenticated redirect above: it leaves the
    // nested /admin router cleanly and drops every cached query with the session.
    window.location.replace(adminLoginHref());
  };
  // The public site sits outside the nested /admin router, so these are plain
  // anchors rather than <Link>s (a <Link href="/"> here would be the dashboard).
  const siteHref = publicSiteHref("/", activeWorkspaceSlug(session));

  return (
    <div className="adm-shell">
      <aside className="adm-sidebar">
        <div className="adm-sidebar-brand">
          <img src={workspace.brand.markUrl} alt="" width={30} height={30} style={{ height: 30, width: "auto" }} />
          <div className="adm-brand-word">
            <div className="top">PHOENIX</div>
            <div className="bottom">OPERATIONS</div>
          </div>
        </div>
        <AdminNav role={session.workspace.role ?? session.user.role} />
        {/*
          The signed-in person, and the door to their own account. Their photo is
          `session.user.avatarUrl` — never `workspace.guide.photoUrl`, which is the
          brand's guide photo on the public site and is the same for every member,
          so it used to show the owner's face to whoever was signed in. Anyone with
          no photo of their own gets their initials.

          A <Link>, so it stays inside the nested /admin router: "/settings" is
          /admin/settings (see AdminNav).
        */}
        <Link href="/settings" className="adm-user" title="Your account" aria-label="Your account settings">
          <UserAvatar name={session.user.name} email={session.user.email} src={session.user.avatarUrl} size={34} />
          <div className="adm-user-who">
            <div className="name">{session.user.name}</div>
            <div className="role">{roleLabel(session.workspace.role ?? session.user.role)}</div>
          </div>
          <Settings className="adm-user-hint" size={15} aria-hidden="true" />
        </Link>
        {(session.workspaces?.length ?? 0) > 1 && (
          // A plain href, not a <Link>: this subtree runs inside the nested
          // /admin router, whose relative links would resolve to /admin/workspaces.
          <a href={`${basePath()}/workspaces`} className="adm-workspace-switch">
            <span className="label">Workspace</span>
            <span className="value">{session.workspace.name || workspace.name}</span>
            <span className="hint">Switch ({session.workspaces?.length ?? 0}) →</span>
          </a>
        )}
        <a href={siteHref} className="adm-viewsite">
          ← View site
        </a>
        <button type="button" className="adm-viewsite" onClick={logout}>Sign out</button>
      </aside>
      <main className="adm-main">
        {children}
      </main>
    </div>
  );
}
