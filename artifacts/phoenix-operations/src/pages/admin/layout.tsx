import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import AdminNav from "@/components/admin/AdminNav";
import { getStore } from "@/lib/store";
import { Loader2 } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["auth-session"],
    queryFn: async () => {
      const response = await fetch("/api/auth/session", { credentials: "include" });
      if (!response.ok) return null;
      return response.json() as Promise<{ user: { email: string } }>;
    },
  });
  useEffect(() => { if (!sessionLoading && !session) setLocation("/login"); }, [session, sessionLoading, setLocation]);

  const { data: workspace, isLoading } = useQuery({
    queryKey: ["workspace"],
    queryFn: () => getStore().getWorkspace(),
  });

  if (isLoading || sessionLoading) {
    return <div className="adm-shell items-center justify-center"><Loader2 className="animate-spin text-orange-500 w-8 h-8" /></div>;
  }

  if (!workspace || !session) return null;
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
            <div className="name">{workspace.guide.name.split(" ")[0]} K.</div>
            <div className="role">Owner</div>
          </div>
        </div>
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
