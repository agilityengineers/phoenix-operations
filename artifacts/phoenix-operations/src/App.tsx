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
import SchedulePage from '@/pages/site/schedule';
import LegalPage from '@/pages/site/legal';
import LoginPage from '@/pages/auth/login';
import SignupPage from '@/pages/auth/signup';
import ResetPage from '@/pages/auth/reset';
import BootstrapPage from '@/pages/auth/bootstrap';
import WorkspacesPage from '@/pages/auth/workspaces';
import FunnelPage from '@/pages/f/[slug]';

// Admin
import AdminLayout from '@/pages/admin/layout';
import { AdminRoutes } from '@/pages/admin/routes';
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
        <Route path="/schedule" component={SchedulePage} />
        <Route path="/legal/:doc" component={LegalPage} />

        {/* Auth routes */}
        <Route path="/login" component={LoginPage} />
        <Route path="/signup" component={SignupPage} />
        <Route path="/reset" component={ResetPage} />
        <Route path="/bootstrap" component={BootstrapPage} />
        <Route path="/workspaces" component={WorkspacesPage} />
        <Route path="/admin/login" component={LoginPage} />

        {/* Funnel route */}
        <Route path="/f/:slug" component={FunnelPage} />

        {/*
          Admin routes, nested under /admin. Everything rendered in here — the
          route table, the nav, links, redirects — addresses paths relative to
          that base, so "/contacts" means /admin/contacts. See pages/admin/routes.tsx.
        */}
        <Route path="/admin" nest>
          <AdminLayout>
            <AdminRoutes />
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
