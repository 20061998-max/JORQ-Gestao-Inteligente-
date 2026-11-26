import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  CreditCard,
  FileText,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Package,
  RefreshCw,
  Settings,
  Shield,
  Sparkles,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { JorqLogo } from '../components/JorqLogo';
import { LanguageSelector } from '../components/LanguageSelector';
import { PWAInstallButton } from '../components/PWAInstallButton';
import {
  subscribeCompanyCollection,
  subscribeCompanyGoal,
  subscribePublicPlans,
  subscribeUserNotifications,
  type AppNotification,
  type CustomerClient,
  type Expense,
  type LedgerTransaction,
  type PaymentRecord,
  type Plan,
  type Product,
  type Revenue,
  type SavedReport,
  type ServiceItem,
  type Subscription,
} from '../services/firestoreService';
import { OverviewTab } from './dashboard/OverviewTab';
import { FinanceTab } from './dashboard/FinanceTab';
import { CatalogClientsTab } from './dashboard/CatalogClientsTab';
import { ReportsAiTab } from './dashboard/ReportsAiTab';
import { SubscriptionSettingsTab } from './dashboard/SubscriptionSettingsTab';
import { HelpManualPage } from './HelpManualPage';
import type { BillingCycle } from '../types';

export type ClientTabId =
  | 'overview'
  | 'finance'
  | 'catalog'
  | 'clients'
  | 'reports'
  | 'ai'
  | 'subscription'
  | 'notifications'
  | 'settings'
  | 'manual';

interface ClientDashboardProps {
  onOpenAdmin?: () => void;
  onGoPublicHome: () => void;
  preselectedPlanId?: string;
  preselectedCycle?: BillingCycle;
  initialTab?: ClientTabId;
}

export function ClientDashboard({
  onOpenAdmin,
  onGoPublicHome,
  preselectedPlanId,
  preselectedCycle,
  initialTab = 'overview',
}: ClientDashboardProps) {
  const { firebaseUser, company, userProfile, isAdmin, logout, getIdToken } = useAuth();
  const { t, pick } = useLanguage();
  const [activeTab, setActiveTab] = useState<ClientTabId>(initialTab);
  const [hasInteractedNav, setHasInteractedNav] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [clients, setClients] = useState<CustomerClient[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [privateGoal, setPrivateGoal] = useState<number | null>(null);
  const [serverAccessVerified, setServerAccessVerified] = useState(false);
  const [accessChecked, setAccessChecked] = useState(isAdmin);
  const [subsLoaded, setSubsLoaded] = useState(false);
  const [autoSyncAttemptedId, setAutoSyncAttemptedId] = useState('');
  const [verifyingPaywall, setVerifyingPaywall] = useState(false);

  const checkServerAccess = useCallback(async () => {
    if (!company || !firebaseUser) return;
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/mercadopago/company-access/${company.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setServerAccessVerified(Boolean(data.verified));
      }
    } catch {
      // ignore transient network check
    } finally {
      setAccessChecked(true);
    }
  }, [company, firebaseUser, getIdToken]);

  const hasAuthorizedFirestoreSub = subscriptions.some((s) => s.status === 'authorized');
  const hasPaidAccess =
    Boolean(company) &&
    company!.status !== 'suspended' &&
    (isAdmin || serverAccessVerified || hasAuthorizedFirestoreSub);
  const accessReady = isAdmin || (accessChecked && subsLoaded);

  const LOCKED_TABS: ClientTabId[] = [
    'overview',
    'finance',
    'catalog',
    'clients',
    'reports',
    'ai',
    'settings',
  ];
  const isTabLocked = (tabId: ClientTabId) => !hasPaidAccess && LOCKED_TABS.includes(tabId);

  // Redirect unpaid users straight to subscription checkout on initial entry
  useEffect(() => {
    if (accessReady && !hasPaidAccess && !hasInteractedNav && LOCKED_TABS.includes(activeTab)) {
      setActiveTab('subscription');
    }
  }, [accessReady, hasPaidAccess, hasInteractedNav, activeTab]);

  // Auto-reverify latest Mercado Pago preapproval on server in case of server restart
  useEffect(() => {
    if (!company || !firebaseUser || isAdmin || serverAccessVerified) return;
    const subWithMp = subscriptions.find((s) => Boolean(s.mpPreapprovalId));
    if (!subWithMp?.mpPreapprovalId || autoSyncAttemptedId === subWithMp.mpPreapprovalId) return;
    setAutoSyncAttemptedId(subWithMp.mpPreapprovalId);
    getIdToken()
      .then((token) =>
        fetch('/api/mercadopago/verify-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            preapprovalId: subWithMp.mpPreapprovalId,
            subscriptionId: subWithMp.id,
            companyId: company.id,
          }),
        })
      )
      .then(() => checkServerAccess())
      .catch(() => {});
  }, [
    company,
    firebaseUser,
    isAdmin,
    serverAccessVerified,
    subscriptions,
    autoSyncAttemptedId,
    getIdToken,
    checkServerAccess,
  ]);

  // If returning from Mercado Pago checkout, NEVER trust query parameters; query backend directly
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mp_return') === '1' && company && firebaseUser) {
      const preapprovalId = params.get('preapproval_id') || subscriptions[0]?.mpPreapprovalId;
      const subId = params.get('subscriptionId') || subscriptions[0]?.id;
      if (preapprovalId) {
        getIdToken()
          .then((token) =>
            fetch('/api/mercadopago/verify-subscription', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                preapprovalId,
                subscriptionId: subId,
                companyId: company.id,
              }),
            })
          )
          .then(() => checkServerAccess())
          .catch(() => {});
      }
      setActiveTab('subscription');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [company, firebaseUser, subscriptions, getIdToken, checkServerAccess]);

  // Always subscribe to billing, plans & notifications
  useEffect(() => {
    if (!company || !firebaseUser) return;
    checkServerAccess();

    const unsubs = [
      subscribeCompanyCollection<Subscription>(
        'subscriptions',
        company.id,
        firebaseUser.uid,
        (items) => {
          setSubscriptions(items);
          setSubsLoaded(true);
        }
      ),
      subscribeCompanyCollection<PaymentRecord>('payments', company.id, firebaseUser.uid, setPayments),
      subscribeUserNotifications(firebaseUser.uid, setNotifications),
      subscribePublicPlans(setPlans),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [company, firebaseUser, checkServerAccess]);

  // Subscribe to operational workspace collections ONLY when paid access is active
  useEffect(() => {
    if (!company || !firebaseUser || !hasPaidAccess) return;

    const unsubs = [
      subscribeCompanyCollection<Revenue>('revenues', company.id, firebaseUser.uid, setRevenues),
      subscribeCompanyCollection<Expense>('expenses', company.id, firebaseUser.uid, setExpenses),
      subscribeCompanyCollection<LedgerTransaction>(
        'transactions',
        company.id,
        firebaseUser.uid,
        setTransactions
      ),
      subscribeCompanyCollection<Product>('products', company.id, firebaseUser.uid, setProducts),
      subscribeCompanyCollection<ServiceItem>('services', company.id, firebaseUser.uid, setServices),
      subscribeCompanyCollection<CustomerClient>('clients', company.id, firebaseUser.uid, setClients),
      subscribeCompanyCollection<SavedReport>('reports', company.id, firebaseUser.uid, setSavedReports),
      subscribeCompanyGoal(company.id, setPrivateGoal),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [company, firebaseUser, hasPaidAccess]);

  if (!company || !firebaseUser) return null;

  const effectiveMonthlyGoal = privateGoal ?? company.monthlyGoal ?? 0;
  const latestSubWithMp = subscriptions.find((s) => Boolean(s.mpPreapprovalId));

  const handlePaywallVerifyNow = async () => {
    if (!latestSubWithMp?.mpPreapprovalId) {
      setHasInteractedNav(true);
      setActiveTab('subscription');
      return;
    }
    setVerifyingPaywall(true);
    try {
      const token = await getIdToken();
      await fetch('/api/mercadopago/verify-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          preapprovalId: latestSubWithMp.mpPreapprovalId,
          subscriptionId: latestSubWithMp.id,
          companyId: company.id,
        }),
      });
      await checkServerAccess();
    } finally {
      setVerifyingPaywall(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const navItems: { id: ClientTabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: t.clientNav.overview, icon: LayoutDashboard },
    { id: 'finance', label: t.clientNav.finance, icon: Wallet },
    { id: 'catalog', label: t.clientNav.catalog, icon: Package },
    { id: 'clients', label: t.clientNav.clients, icon: Users },
    { id: 'reports', label: t.clientNav.reports, icon: BarChart3 },
    { id: 'ai', label: t.clientNav.ai, icon: Brain },
    { id: 'subscription', label: t.clientNav.subscription, icon: CreditCard },
    { id: 'notifications', label: t.clientNav.notifications, icon: Bell },
    { id: 'settings', label: t.clientNav.settings, icon: Settings },
    { id: 'manual', label: t.clientNav.manual, icon: BookOpen },
  ];

  const currentNav = navItems.find((n) => n.id === activeTab);

  return (
    <div className="min-h-screen bg-[#F8FAFC]/82 backdrop-blur-[2px] flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform lg:translate-x-0 lg:static ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
          <button type="button" onClick={onGoPublicHome} className="cursor-pointer">
            <JorqLogo />
          </button>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-slate-500 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Company Identity */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          {company.logoUrl ? (
            <img
              src={company.logoUrl}
              alt={company.name}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-[#0F172A] text-white flex items-center justify-center text-xs font-bold shrink-0">
              {company.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{company.name}</p>
            <p className="text-xs text-slate-500 truncate">{company.sector || 'Empresa'}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            const locked = accessReady && isTabLocked(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setHasInteractedNav(true);
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-50 text-[#1E40AF]'
                    : locked
                    ? 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {locked ? (
                  <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                ) : (
                  item.id === 'notifications' &&
                  unreadCount > 0 && (
                    <span className="font-mono tabular-nums text-[11px] font-bold text-[#1E40AF]">
                      {unreadCount}
                    </span>
                  )
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 space-y-1">
          {isAdmin && onOpenAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>{t.clientNav.adminPanel}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => logout()}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>{t.common.logout}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 text-slate-600 hover:bg-slate-100 rounded-lg shrink-0 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 truncate hidden md:inline max-w-[160px]">{company.name}</span>
              <span className="text-slate-300 hidden md:inline">/</span>
              <h1 className="font-display font-bold text-slate-900 truncate">
                {currentNav?.label || t.clientNav.defaultPanelTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <LanguageSelector compact />
            <PWAInstallButton compact />
            {isAdmin && (
              <span className="hidden xl:inline text-xs font-semibold text-[#16A34A] whitespace-nowrap">
                {t.clientNav.ownerFreeMode}
              </span>
            )}
            <span className="hidden xl:inline text-xs text-slate-500 truncate max-w-[140px]">
              {userProfile?.name || firebaseUser.email}
            </span>
            {isAdmin && onOpenAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{t.clientNav.adminShort}</span>
              </button>
            )}
            {hasPaidAccess ? (
              <button
                type="button"
                onClick={() => {
                  setHasInteractedNav(true);
                  setActiveTab('reports');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.clientNav.reportsShort}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setHasInteractedNav(true);
                  setActiveTab('subscription');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {pick({
                    pt: 'Assinar Plano',
                    en: 'Subscribe Now',
                    es: 'Suscribirse',
                    fr: "S'abonner",
                  })}
                </span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {!accessReady ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-lg mx-auto mt-8 shadow-sm">
              <p className="text-sm font-semibold text-slate-800">
                {pick({
                  pt: 'Verificando status da assinatura...',
                  en: 'Verifying subscription status...',
                  es: 'Verificando el estado de la suscripción...',
                  fr: "Vérification du statut de l'abonnement...",
                })}
              </p>
            </div>
          ) : isTabLocked(activeTab) ? (
            <div className="max-w-2xl mx-auto mt-6 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-5">
                <Lock className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="font-display text-2xl font-bold text-[#0F172A]">
                {company.status === 'suspended'
                  ? pick({
                      pt: 'Acesso da empresa suspenso',
                      en: 'Company access suspended',
                      es: 'Acceso de la empresa suspendido',
                      fr: 'Accès entreprise suspendu',
                    })
                  : pick({
                      pt: 'Assinatura necessária para liberar o sistema',
                      en: 'Active subscription required to unlock the workspace',
                      es: 'Suscripción activa necesaria para liberar el sistema',
                      fr: 'Abonnement actif requis pour débloquer le système',
                    })}
              </h2>
              <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">
                {company.status === 'suspended'
                  ? pick({
                      pt: 'A assinatura desta empresa está suspensa no momento. Regularize seu plano na aba Assinatura para restaurar todos os dados e ferramentas.',
                      en: 'This company subscription is currently suspended. Update your plan in the Subscription tab to restore all features.',
                      es: 'La suscripción de esta empresa está suspendida. Regulariza tu plan en la pestaña Suscripción.',
                      fr: "L'abonnement de cette entreprise est suspendu. Régularisez votre offre dans l'onglet Abonnement.",
                    })
                  : pick({
                      pt: 'Para evitar uso indevido sem contratação, os módulos de Visão Geral, Financeiro, Catálogo, Clientes, Relatórios e Consultor IA só são liberados após confirmação de pagamento do seu plano.',
                      en: 'Overview, Finance, Catalog, Clients, Reports, and AI Advisor modules unlock automatically right after confirming your subscription payment.',
                      es: 'Los módulos de Resumen, Finanzas, Catálogo, Clientes, Informes y Consultor IA se liberan automáticamente tras confirmar el pago de tu plan.',
                      fr: 'Les modules Aperçu, Finances, Catalogue, Clients, Rapports et Conseiller IA sont débloqués dès la confirmation du paiement.',
                    })}
              </p>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#1E40AF] shrink-0" />
                  <span>
                    {pick({
                      pt: 'Controle completo de receitas e despesas',
                      en: 'Full revenue & expense tracking',
                      es: 'Control total de ingresos y gastos',
                      fr: 'Suivi complet des revenus et dépenses',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#1E40AF] shrink-0" />
                  <span>
                    {pick({
                      pt: 'Catálogo de produtos, serviços e CRM',
                      en: 'Products, services catalog & CRM',
                      es: 'Catálogo de productos, servicios y CRM',
                      fr: 'Catalogue produits, services et CRM',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#1E40AF] shrink-0" />
                  <span>
                    {pick({
                      pt: 'Relatórios em PDF e CSV prontos',
                      en: 'Ready-to-export PDF & CSV reports',
                      es: 'Informes listos en PDF y CSV',
                      fr: 'Rapports PDF et CSV prêts à exporter',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#1E40AF] shrink-0" />
                  <span>
                    {pick({
                      pt: 'Consultor Financeiro com Inteligência Artificial',
                      en: 'AI Financial Consultant',
                      es: 'Consultor Financiero con IA',
                      fr: 'Conseiller Financier IA',
                    })}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setHasInteractedNav(true);
                    setActiveTab('subscription');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {pick({
                      pt: 'Escolher Plano e Assinar Agora',
                      en: 'Choose Plan & Subscribe Now',
                      es: 'Elegir Plan y Suscribirse',
                      fr: 'Choisir une Offre et Payer',
                    })}
                  </span>
                </button>

                {latestSubWithMp?.mpPreapprovalId && (
                  <button
                    type="button"
                    disabled={verifyingPaywall}
                    onClick={handlePaywallVerifyNow}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${verifyingPaywall ? 'animate-spin' : ''}`} />
                    <span>
                      {pick({
                        pt: 'Já paguei · Verificar Pagamento',
                        en: 'Already Paid · Verify Now',
                        es: 'Ya pagué · Verificar Pago',
                        fr: 'Déjà payé · Vérifier',
                      })}
                    </span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewTab
                  company={company}
                  monthlyGoal={effectiveMonthlyGoal}
                  revenues={revenues}
                  expenses={expenses}
                  transactions={transactions}
                  activeSubscription={subscriptions[0] || null}
                  serverAccessVerified={serverAccessVerified || isAdmin}
                  isOwnerFreeMode={isAdmin}
                  onGoToTab={(t) => {
                    setHasInteractedNav(true);
                    setActiveTab(t as ClientTabId);
                  }}
                />
              )}
              {activeTab === 'finance' && (
                <FinanceTab
                  companyId={company.id}
                  userId={firebaseUser.uid}
                  revenues={revenues}
                  expenses={expenses}
                  transactions={transactions}
                />
              )}
              {activeTab === 'catalog' && (
                <CatalogClientsTab
                  mode="catalog"
                  companyId={company.id}
                  userId={firebaseUser.uid}
                  products={products}
                  services={services}
                  clients={clients}
                />
              )}
              {activeTab === 'clients' && (
                <CatalogClientsTab
                  mode="clients"
                  companyId={company.id}
                  userId={firebaseUser.uid}
                  products={products}
                  services={services}
                  clients={clients}
                />
              )}
              {activeTab === 'reports' && (
                <ReportsAiTab
                  mode="reports"
                  company={company}
                  monthlyGoal={effectiveMonthlyGoal}
                  userId={firebaseUser.uid}
                  revenues={revenues}
                  expenses={expenses}
                  transactions={transactions}
                  products={products}
                  services={services}
                  clients={clients}
                  savedReports={savedReports}
                  activeSubscription={subscriptions[0] || null}
                />
              )}
              {activeTab === 'ai' && (
                <ReportsAiTab
                  mode="ai"
                  company={company}
                  monthlyGoal={effectiveMonthlyGoal}
                  userId={firebaseUser.uid}
                  revenues={revenues}
                  expenses={expenses}
                  transactions={transactions}
                  products={products}
                  services={services}
                  clients={clients}
                  savedReports={savedReports}
                  activeSubscription={subscriptions[0] || null}
                />
              )}
              {activeTab === 'settings' && (
                <SubscriptionSettingsTab
                  mode="settings"
                  company={company}
                  companyGoal={effectiveMonthlyGoal}
                  userId={firebaseUser.uid}
                  userEmail={firebaseUser.email || ''}
                  plans={plans}
                  subscriptions={subscriptions}
                  payments={payments}
                  notifications={notifications}
                  onSubscriptionVerified={checkServerAccess}
                />
              )}
            </>
          )}

          {accessReady && activeTab === 'subscription' && (
            <SubscriptionSettingsTab
              mode="subscription"
              company={company}
              userId={firebaseUser.uid}
              userEmail={firebaseUser.email || ''}
              plans={plans}
              subscriptions={subscriptions}
              payments={payments}
              notifications={notifications}
              preselectedPlanId={preselectedPlanId}
              preselectedCycle={preselectedCycle}
              isOwnerFreeMode={isAdmin}
              onSubscriptionVerified={checkServerAccess}
            />
          )}
          {accessReady && activeTab === 'notifications' && (
            <SubscriptionSettingsTab
              mode="notifications"
              company={company}
              userId={firebaseUser.uid}
              userEmail={firebaseUser.email || ''}
              plans={plans}
              subscriptions={subscriptions}
              payments={payments}
              notifications={notifications}
              onSubscriptionVerified={checkServerAccess}
            />
          )}
          {accessReady && activeTab === 'manual' && <HelpManualPage />}
        </main>
      </div>
    </div>
  );
}
