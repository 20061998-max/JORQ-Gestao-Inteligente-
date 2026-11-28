import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SiteBackground } from './components/SiteBackground';
import { OwnerSignatureStamp } from './components/JorqLogo';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PublicLayout, type PublicRoute } from './components/PublicLayout';
import { LandingPage } from './pages/LandingPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { PlansPage } from './pages/PlansPage';
import { HelpManualPage } from './pages/HelpManualPage';
import { AuthPage } from './pages/AuthPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { ClientDashboard, type ClientTabId } from './pages/ClientDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import type { BillingCycle, Plan } from './types';

const OWNER_VIEW_MODE_KEY = 'jorq_owner_view_mode';

function AppRouter() {
  const { firebaseUser, emailVerified, company, isAdmin, authReady } = useAuth();
  const { t } = useLanguage();
  const [publicRoute, setPublicRoute] = useState<PublicRoute>('home');
  const [inWorkspace, setInWorkspace] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('mp_return') === '1';
  });
  const [viewMode, setViewMode] = useState<'client' | 'admin'>(() => {
    if (typeof window === 'undefined') return 'client';
    const isMpReturn = new URLSearchParams(window.location.search).get('mp_return') === '1';
    if (isMpReturn) return 'client';
    const saved = window.sessionStorage.getItem(OWNER_VIEW_MODE_KEY);
    return saved === 'admin' ? 'admin' : 'client';
  });
  const [preselectedPlanId, setPreselectedPlanId] = useState<string | undefined>();
  const [preselectedCycle, setPreselectedCycle] = useState<BillingCycle>('monthly');
  const [initialClientTab, setInitialClientTab] = useState<ClientTabId>('overview');

  const isAuthenticatedAndVerified = Boolean(firebaseUser && emailVerified);

  const updateViewMode = (next: 'client' | 'admin') => {
    setViewMode(next);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(OWNER_VIEW_MODE_KEY, next);
    }
  };

  useEffect(() => {
    if (authReady && !firebaseUser && typeof window !== 'undefined') {
      window.sessionStorage.removeItem(OWNER_VIEW_MODE_KEY);
    }
  }, [authReady, firebaseUser]);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="px-5 py-3 rounded-xl bg-slate-950/75 backdrop-blur-md border border-white/15 text-sm font-medium text-white shadow-lg">
          {t.common.loadingApp}
        </div>
      </div>
    );
  }

  // If user just signed in with unverified email, keep them on AuthPage verification gate
  if (firebaseUser && !emailVerified && (inWorkspace || publicRoute === 'auth')) {
    return (
      <PublicLayout
        currentRoute="auth"
        onNavigate={(r) => {
          setInWorkspace(false);
          setPublicRoute(r);
        }}
        isAuthenticated={false}
        onEnterApp={() => setPublicRoute('auth')}
      >
        <AuthPage />
      </PublicLayout>
    );
  }

  // Workspace view (Admin can switch between AdminDashboard and Owner Free ClientDashboard; Clients strictly to ClientDashboard)
  if (inWorkspace && isAuthenticatedAndVerified) {
    if (isAdmin && viewMode === 'admin') {
      return (
        <AdminDashboard
          onBackToClient={() => {
            setInWorkspace(false);
            setPublicRoute('home');
          }}
          onEnterClientMode={() => {
            setInitialClientTab('overview');
            updateViewMode('client');
          }}
        />
      );
    }

    if (!company) {
      return (
        <OnboardingPage
          onBackToAdmin={isAdmin ? () => updateViewMode('admin') : undefined}
        />
      );
    }

    return (
      <ClientDashboard
        initialTab={initialClientTab}
        preselectedPlanId={preselectedPlanId}
        preselectedCycle={preselectedCycle}
        onOpenAdmin={isAdmin ? () => updateViewMode('admin') : undefined}
        onGoPublicHome={() => {
          setInWorkspace(false);
          setPublicRoute('home');
        }}
      />
    );
  }

  // If user completed Auth on AuthPage and is verified, enter workspace automatically
  if (publicRoute === 'auth' && isAuthenticatedAndVerified) {
    if (isAdmin && viewMode === 'admin') {
      return (
        <AdminDashboard
          onBackToClient={() => {
            setPublicRoute('home');
          }}
          onEnterClientMode={() => {
            setInitialClientTab('overview');
            updateViewMode('client');
            setInWorkspace(true);
          }}
        />
      );
    }
    if (!company) {
      return (
        <OnboardingPage
          onBackToAdmin={isAdmin ? () => updateViewMode('admin') : undefined}
        />
      );
    }
    return (
      <ClientDashboard
        initialTab={initialClientTab}
        preselectedPlanId={preselectedPlanId}
        preselectedCycle={preselectedCycle}
        onOpenAdmin={isAdmin ? () => updateViewMode('admin') : undefined}
        onGoPublicHome={() => setPublicRoute('home')}
      />
    );
  }

  const handleSelectPlanForCheckout = (plan: Plan, cycle: BillingCycle) => {
    setPreselectedPlanId(plan.id);
    setPreselectedCycle(cycle);
    setInitialClientTab('subscription');
    updateViewMode('client');
    if (isAuthenticatedAndVerified) {
      setInWorkspace(true);
    } else {
      setPublicRoute('auth');
    }
  };

  const handleEnterClientModeFromPublic = () => {
    setInitialClientTab('overview');
    updateViewMode('client');
    setInWorkspace(true);
  };

  return (
    <PublicLayout
      currentRoute={publicRoute}
      onNavigate={setPublicRoute}
      isAuthenticated={isAuthenticatedAndVerified}
      isAdmin={isAdmin}
      onEnterClientMode={isAdmin ? handleEnterClientModeFromPublic : undefined}
      onEnterApp={() => {
        setInitialClientTab('overview');
        setInWorkspace(true);
        updateViewMode(isAdmin ? 'admin' : 'client');
      }}
    >
      {publicRoute === 'home' && (
        <LandingPage
          onNavigate={setPublicRoute}
          isAuthenticated={isAuthenticatedAndVerified}
          isAdmin={isAdmin}
          onEnterClientMode={isAdmin ? handleEnterClientModeFromPublic : undefined}
          onEnterApp={() => {
            setInitialClientTab('overview');
            setInWorkspace(true);
            updateViewMode(isAdmin ? 'admin' : 'client');
          }}
        />
      )}
      {publicRoute === 'resources' && <ResourcesPage onNavigate={setPublicRoute} />}
      {publicRoute === 'plans' && (
        <PlansPage
          onNavigate={setPublicRoute}
          isAuthenticated={isAuthenticatedAndVerified}
          onSelectPlanForCheckout={handleSelectPlanForCheckout}
        />
      )}
      {publicRoute === 'manual' && <HelpManualPage />}
      {publicRoute === 'auth' && (
        <AuthPage
          onSuccess={() => {
            setInWorkspace(true);
            updateViewMode(isAdmin ? 'admin' : 'client');
          }}
        />
      )}
    </PublicLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <SiteBackground />
          <AppRouter />
          <OfflineIndicator />
          <OwnerSignatureStamp />
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
