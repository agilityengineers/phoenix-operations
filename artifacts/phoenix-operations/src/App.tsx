import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { type ReactNode } from 'react';

// Pages
import HomePage from '@/pages/site/home';
import GuidePage from '@/pages/site/guide';
import ResultsPage from '@/pages/site/results';
import LegalPage from '@/pages/site/legal';
import LoginPage from '@/pages/auth/login';
import SignupPage from '@/pages/auth/signup';
import ResetPage from '@/pages/auth/reset';
import BootstrapPage from '@/pages/auth/bootstrap';
import FunnelPage from '@/pages/f/[slug]';

// Admin Pages
import AdminLayout from '@/pages/admin/layout';
import AdminDashboard from '@/pages/admin/dashboard';
import ContactsPage from '@/pages/admin/contacts';
import ContactDetail from '@/pages/admin/contact-detail';
import FunnelsPage from '@/pages/admin/funnels';
import FunnelDetail from '@/pages/admin/funnel-detail';
import SequencesPage from '@/pages/admin/sequences';
import ContentPage from '@/pages/admin/content';
import NetworkPage from '@/pages/admin/network';
import IntegrationsPage from '@/pages/admin/integrations';
import BillingPage from '@/pages/admin/billing';
import WhiteLabelPage from '@/pages/admin/white-label';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        {/* Site routes */}
        <Route path="/" component={HomePage} />
        <Route path="/guide" component={GuidePage} />
        <Route path="/results" component={ResultsPage} />
        <Route path="/legal/:doc" component={LegalPage} />

        {/* Auth routes */}
        <Route path="/login" component={LoginPage} />
        <Route path="/signup" component={SignupPage} />
        <Route path="/reset" component={ResetPage} />
        <Route path="/bootstrap" component={BootstrapPage} />

        {/* Funnel route */}
        <Route path="/f/:slug" component={FunnelPage} />

        {/* Admin routes wrapped in layout */}
        <Route path="/admin" nest>
          <AdminLayout>
            <Switch>
              <Route path="/" component={AdminDashboard} />
              <Route path="/contacts" component={ContactsPage} />
              <Route path="/contacts/:id" component={ContactDetail} />
              <Route path="/funnels" component={FunnelsPage} />
              <Route path="/funnels/:id" component={FunnelDetail} />
              <Route path="/sequences" component={SequencesPage} />
              <Route path="/content" component={ContentPage} />
              <Route path="/network" component={NetworkPage} />
              <Route path="/integrations" component={IntegrationsPage} />
              <Route path="/billing" component={BillingPage} />
              <Route path="/white-label" component={WhiteLabelPage} />
              <Route component={NotFound} />
            </Switch>
          </AdminLayout>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
