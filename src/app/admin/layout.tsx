import "../admin.css";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import { getStore, supabaseConfigured } from "@/lib/store";
import { getAuthClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Auth gate: with Supabase configured, /admin requires a signed-in user.
  // Demo mode (no Supabase env) leaves the admin open and shows a banner.
  const demoMode = !supabaseConfigured();
  if (!demoMode) {
    const supabase = await getAuthClient();
    const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
    if (!data.user) redirect("/login");
  }

  const workspace = await getStore().getWorkspace();

  return (
    <div className="adm-shell">
      <aside className="adm-sidebar">
        <div className="adm-sidebar-brand">
          <Image src={workspace.brand.markUrl} alt="" width={30} height={30} style={{ height: 30, width: "auto" }} />
          <div className="adm-brand-word">
            <div className="top">PHOENIX</div>
            <div className="bottom">OPERATIONS</div>
          </div>
        </div>
        <AdminNav />
        <div className="adm-user">
          <Image src={workspace.guide.photoUrl} alt="" width={34} height={34} />
          <div>
            <div className="name">{workspace.guide.name.split(" ")[0]} K.</div>
            <div className="role">Owner</div>
          </div>
        </div>
        <Link href="/" className="adm-viewsite">
          ← View site
        </Link>
      </aside>
      <main className="adm-main">
        {demoMode && (
          <div className="demo-banner">
            Demo mode — running on the seeded in-memory store. Set the Supabase env vars to
            enable Postgres persistence and authentication (see README).
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
