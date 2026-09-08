import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import AdminNav from "@/components/admin/AdminNav";
import { getStore } from "@/lib/store";
import { fetchSession, roleLabel } from "@/lib/auth";
import { Loader2 } from "lucide-react";

const basePath = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["auth-session"],
    queryFn: fetchSession,
    retry: false,
  });
  useEffect(() => {
    if (!sessionLoading && !session) {
      window.location.replace(`${basePath()}/admin/login`);
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
    setLocation("/login");
  };

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
        <AdminNav />
        <div className="adm-user">
          <img src={workspace.guide.photoUrl} alt="" width={34} height={34} style={{ borderRadius: '50%' }} />
          <div>
            <div className="name">{session.user.name}</div>
            <div className="role">{roleLabel(session.workspace.role ?? session.user.role)}</div>
          </div>
        </div>
        {session.workspaces.length > 1 && (
          // A plain href, not a <Link>: this subtree runs inside the nested
          // /admin router, whose relative links would resolve to /admin/workspaces.
          <a href={`${basePath()}/workspaces`} className="adm-workspace-switch">
            <span className="label">Workspace</span>
            <span className="value">{session.workspace.name || workspace.name}</span>
            <span className="hint">Switch ({session.workspaces.length}) →</span>
          </a>
        )}
        <Link href="/" className="adm-viewsite">
          ← View site
        </Link>
        <button type="button" className="adm-viewsite" onClick={logout}>Sign out</button>
      </aside>
      <main className="adm-main">
        {children}
      </main>
    </div>
  );
}
