import { useState } from 'react';
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

function AppRouter() {
  const { firebaseUser, emailVerified, company, isAdmin, authReady } = useAuth();
  const { t } = useLanguage();
  const [publicRoute, setPublicRoute] = useState<PublicRoute>('home');
  const [inWorkspace, setInWorkspace] = useState(false);
  const [viewMode, setViewMode] = useState<'client' | 'admin'>('client');
  const [preselectedPlanId, setPreselectedPlanId] = useState<string | undefined>();
  const [preselectedCycle, setPreselectedCycle] = useState<BillingCycle>('monthly');
  const [initialClientTab, setInitialClientTab] = useState<ClientTabId>('overview');

  const isAuthenticatedAndVerified = Boolean(firebaseUser && emailVerified);

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

  // Workspace view (Client or Admin)
  if (inWorkspace && isAuthenticatedAndVerified) {
    if (viewMode === 'admin' && isAdmin) {
      return (
        <AdminDashboard
          onEnterClientMode={() => {
            setInWorkspace(true);
            setViewMode('client');
          }}
          onBackToClient={() => {
            setInWorkspace(false);
            setPublicRoute('home');
          }}
        />
      );
    }

    if (!company) {
      if (isAdmin && viewMode === 'admin') {
        return (
          <AdminDashboard
            onEnterClientMode={() => {
              setInWorkspace(true);
              setViewMode('client');
            }}
          />
        );
      }
      return (
        <OnboardingPage
          onBackToAdmin={
            isAdmin
              ? () => {
                  setInWorkspace(true);
                  setViewMode('admin');
                }
              : undefined
          }
        />
      );
    }

    return (
      <ClientDashboard
        initialTab={initialClientTab}
        preselectedPlanId={preselectedPlanId}
        preselectedCycle={preselectedCycle}
        onOpenAdmin={isAdmin ? () => setViewMode('admin') : undefined}
        onGoPublicHome={() => {
          setInWorkspace(false);
          setPublicRoute('home');
        }}
      />
    );
  }

  // If user completed Auth on AuthPage and is verified, enter workspace automatically
  if (publicRoute === 'auth' && isAuthenticatedAndVerified) {
    if (isAdmin && !company) {
      return (
        <AdminDashboard
          onEnterClientMode={() => {
            setInWorkspace(true);
            setViewMode('client');
          }}
          onBackToClient={() => {
            setPublicRoute('home');
          }}
        />
      );
    }
    if (!company) {
      return (
        <OnboardingPage
          onBackToAdmin={
            isAdmin
              ? () => {
                  setInWorkspace(true);
                  setViewMode('admin');
                }
              : undefined
          }
        />
      );
    }
    return (
      <ClientDashboard
        initialTab={initialClientTab}
        preselectedPlanId={preselectedPlanId}
        preselectedCycle={preselectedCycle}
        onOpenAdmin={
          isAdmin
            ? () => {
                setInWorkspace(true);
                setViewMode('admin');
              }
            : undefined
        }
        onGoPublicHome={() => setPublicRoute('home')}
      />
    );
  }

  const handleSelectPlanForCheckout = (plan: Plan, cycle: BillingCycle) => {
    setPreselectedPlanId(plan.id);
    setPreselectedCycle(cycle);
    setInitialClientTab('subscription');
    if (isAuthenticatedAndVerified) {
      setInWorkspace(true);
      setViewMode('client');
    } else {
      setPublicRoute('auth');
    }
  };

  return (
    <PublicLayout
      currentRoute={publicRoute}
      onNavigate={setPublicRoute}
      isAuthenticated={isAuthenticatedAndVerified}
      onEnterApp={() => {
        setInitialClientTab('overview');
        setInWorkspace(true);
        setViewMode(isAdmin && !company ? 'admin' : 'client');
      }}
    >
      {publicRoute === 'home' && (
        <LandingPage
          onNavigate={setPublicRoute}
          isAuthenticated={isAuthenticatedAndVerified}
          onEnterApp={() => {
            setInitialClientTab('overview');
            setInWorkspace(true);
            setViewMode(isAdmin && !company ? 'admin' : 'client');
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
            setViewMode(isAdmin && !company ? 'admin' : 'client');
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
