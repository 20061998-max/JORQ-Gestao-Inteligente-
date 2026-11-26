import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  Shield,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { JorqLogo } from '../components/JorqLogo';
import {
  subscribeCompanyCollection,
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
  const [activeTab, setActiveTab] = useState<ClientTabId>(initialTab);
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
  const [serverAccessVerified, setServerAccessVerified] = useState(false);

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
    }
  }, [company, firebaseUser, getIdToken]);

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

  useEffect(() => {
    if (!company || !firebaseUser) return;
    checkServerAccess();

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
      subscribeCompanyCollection<Subscription>(
        'subscriptions',
        company.id,
        firebaseUser.uid,
        setSubscriptions
      ),
      subscribeCompanyCollection<PaymentRecord>('payments', company.id, firebaseUser.uid, setPayments),
      subscribeUserNotifications(firebaseUser.uid, setNotifications),
      subscribePublicPlans(setPlans),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [company, firebaseUser, checkServerAccess]);

  if (!company || !firebaseUser) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const navItems: { id: ClientTabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'finance', label: 'Gestão Financeira', icon: Wallet },
    { id: 'catalog', label: 'Produtos e Serviços', icon: Package },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'reports', label: 'Relatórios e Gráficos', icon: BarChart3 },
    { id: 'ai', label: 'Inteligência Artificial', icon: Brain },
    { id: 'subscription', label: 'Assinatura e Planos', icon: CreditCard },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'settings', label: 'Configurações', icon: Settings },
    { id: 'manual', label: 'Ajuda e Manual', icon: BookOpen },
  ];

  const currentNav = navItems.find((n) => n.id === activeTab);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
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
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-50 text-[#1E40AF]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'notifications' && unreadCount > 0 && (
                  <span className="font-mono tabular-nums text-[11px] font-bold text-[#1E40AF]">
                    {unreadCount}
                  </span>
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
              <span>Painel Administrativo</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => logout()}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sair da Conta</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-400 truncate hidden sm:inline">{company.name}</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-display font-bold text-slate-900 truncate">
                {currentNav?.label || 'Painel'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isAdmin && (
              <span className="hidden sm:inline text-xs font-semibold text-[#16A34A]">
                Modo Proprietário (Gratuito)
              </span>
            )}
            <span className="hidden md:inline text-xs text-slate-500">
              {userProfile?.name || firebaseUser.email}
            </span>
            {isAdmin && onOpenAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Relatórios</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewTab
              company={company}
              revenues={revenues}
              expenses={expenses}
              transactions={transactions}
              activeSubscription={subscriptions[0] || null}
              serverAccessVerified={serverAccessVerified || isAdmin}
              isOwnerFreeMode={isAdmin}
              onGoToTab={(t) => setActiveTab(t as ClientTabId)}
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
              userId={firebaseUser.uid}
              revenues={revenues}
              expenses={expenses}
              transactions={transactions}
              products={products}
              services={services}
              clients={clients}
              savedReports={savedReports}
            />
          )}
          {activeTab === 'ai' && (
            <ReportsAiTab
              mode="ai"
              company={company}
              userId={firebaseUser.uid}
              revenues={revenues}
              expenses={expenses}
              transactions={transactions}
              products={products}
              services={services}
              clients={clients}
              savedReports={savedReports}
            />
          )}
          {activeTab === 'subscription' && (
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
          {activeTab === 'notifications' && (
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
          {activeTab === 'settings' && (
            <SubscriptionSettingsTab
              mode="settings"
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
          {activeTab === 'manual' && <HelpManualPage />}
        </main>
      </div>
    </div>
  );
}
