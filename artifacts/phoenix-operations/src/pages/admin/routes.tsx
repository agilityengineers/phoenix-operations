import { Route, Switch } from "wouter";
import type { ComponentType } from "react";
import AdminDashboard from "@/pages/admin/dashboard";
import ContactsPage from "@/pages/admin/contacts";
import ContactDetail from "@/pages/admin/contact-detail";
import FunnelsPage from "@/pages/admin/funnels";
import FunnelDetail from "@/pages/admin/funnel-detail";
import SequencesPage from "@/pages/admin/sequences";
import ContentPage from "@/pages/admin/content";
import NetworkPage from "@/pages/admin/network";
import IntegrationsPage from "@/pages/admin/integrations";
import BillingPage from "@/pages/admin/billing";
import WhiteLabelPage from "@/pages/admin/white-label";
import SettingsPage from "@/pages/admin/settings";
import NotFound from "@/pages/not-found";

/**
 * The admin route table. App.tsx mounts it under `<Route path="/admin" nest>`,
 * so every path here is relative to /admin: "/funnels" is /admin/funnels.
 * Links, redirects and `setLocation` calls rendered inside the admin shell
 * follow the same rule (see AdminNav). Add a screen here and to AdminNav
 * together; routes.test.tsx checks that the two agree.
 */
export const adminRoutes: ReadonlyArray<{ path: string; component: ComponentType }> = [
  { path: "/", component: AdminDashboard },
  { path: "/contacts", component: ContactsPage },
  { path: "/contacts/:id", component: ContactDetail },
  { path: "/funnels", component: FunnelsPage },
  { path: "/funnels/:id", component: FunnelDetail },
  { path: "/sequences", component: SequencesPage },
  { path: "/content", component: ContentPage },
  { path: "/network", component: NetworkPage },
  { path: "/integrations", component: IntegrationsPage },
  { path: "/billing", component: BillingPage },
  { path: "/white-label", component: WhiteLabelPage },
  // Your own account. Deliberately absent from AdminNav: it belongs to the
  // person, not the workspace, so its door is the profile button in the sidebar
  // rather than a permissioned menu item.
  { path: "/settings", component: SettingsPage },
];

export function AdminRoutes() {
  return (
    <Switch>
      {adminRoutes.map((route) => (
        <Route key={route.path} path={route.path} component={route.component} />
      ))}
      <Route component={NotFound} />
    </Switch>
  );
}
