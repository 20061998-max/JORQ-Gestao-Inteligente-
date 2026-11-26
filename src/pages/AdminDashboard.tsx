import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle2,
  CreditCard,
  FileSearch,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Trash2,
  Users,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from 'recharts';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { JorqLogo } from '../components/JorqLogo';
import { LanguageSelector } from '../components/LanguageSelector';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { SEMANTIC_COLORS, SemanticChartLegend } from '../components/SemanticChartLegend';
import {
  adminDeleteCoupon,
  adminDeletePlan,
  adminSaveCoupon,
  adminSavePlan,
  adminSaveSystemSettings,
  adminToggleCoupon,
  adminUpdateCompanyStatus,
  adminUpdateSubscriptionStatus,
  createAuditLog,
  subscribeAdminCollection,
  type AuditLog,
  type Company,
  type Coupon,
  type PaymentRecord,
  type Plan,
  type Subscription,
  type SystemSettings,
  type UserProfile,
} from '../services/firestoreService';
import { formatBRL, translateSubscriptionStatus } from '../utils/format';

type AdminTabId =
  | 'executive'
  | 'clients'
  | 'plans'
  | 'coupons'
  | 'billing'
  | 'security'
  | 'audit'
  | 'settings';

interface SecurityStatusResponse {
  headers: {
    csp: boolean;
    nosniff: boolean;
    hsts: boolean;
    referrerPolicy: boolean;
    coop: boolean;
    permissionsPolicy: boolean;
    poweredByHidden: boolean;
  };
  protections: {
    rateLimiting: boolean;
    prototypePollutionGuard: boolean;
    nosqlOperatorSanitizer: boolean;
    originVerification: boolean;
    firebaseIdTokenVerification: boolean;
    firestoreStrictRules: boolean;
    mpWebhookHmac: boolean;
    appCheckConfigured: boolean;
  };
  telemetry: {
    rateLimitedRequests: number;
    blockedOriginRequests: number;
    sanitizedPayloads: number;
    invalidWebhookSignatures: number;
    startedAt: string;
  };
}

interface WebhookLogItem {
  id: string;
  receivedAt: string;
  type: string;
  action: string;
  dataId: string;
  signatureValid: boolean;
  idempotentDuplicate: boolean;
  resolvedStatus: string;
  error?: string;
}

export function AdminDashboard({
  onBackToClient,
  onEnterClientMode,
}: {
  onBackToClient?: () => void;
  onEnterClientMode?: () => void;
}) {
  const { firebaseUser, isAdmin, logout, getIdToken } = useAuth();
  const { t: i18n, pick } = useLanguage();
  const [activeTab, setActiveTab] = useState<AdminTabId>('executive');
  const [securityStatus, setSecurityStatus] = useState<SecurityStatusResponse | null>(null);
  const [loadingSecurity, setLoadingSecurity] = useState(false);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLogItem[]>([]);

  // Plan editor state
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState('');
  const [planAudience, setPlanAudience] = useState('');
  const [planDesc, setPlanDesc] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [discMonthly, setDiscMonthly] = useState('0');
  const [discQuarterly, setDiscQuarterly] = useState('3');
  const [discSemiannual, setDiscSemiannual] = useState('5');
  const [discAnnual, setDiscAnnual] = useState('8');
  const [maxUsers, setMaxUsers] = useState('3');
  const [maxTx, setMaxTx] = useState('500');
  const [aiLimit, setAiLimit] = useState('50');
  const [planFeaturesText, setPlanFeaturesText] = useState('');
  const [planActive, setPlanActive] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponPercent, setCouponPercent] = useState('10');
  const [couponMaxUses, setCouponMaxUses] = useState('100');
  const [couponExpires, setCouponExpires] = useState('');

  // System settings state
  const [platformName, setPlatformName] = useState('JORQ Gestão Inteligente');
  const [supportEmail, setSupportEmail] = useState('suporte@jorq.com.br');
  const [mpEnv, setMpEnv] = useState<'sandbox' | 'production'>('sandbox');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  useEffect(() => {
    if (!isAdmin || !firebaseUser) return;

    const unsubs = [
      subscribeAdminCollection<UserProfile>('users', setUsers),
      subscribeAdminCollection<Company>('companies', setCompanies),
      subscribeAdminCollection<Subscription>('subscriptions', setSubscriptions),
      subscribeAdminCollection<PaymentRecord>('payments', setPayments),
      subscribeAdminCollection<Plan>('plans', setPlans),
      subscribeAdminCollection<Coupon>('coupons', setCoupons),
      subscribeAdminCollection<AuditLog>('audit_logs', (items) => {
        setAuditLogs(
          items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        );
      }),
    ];

    getDoc(doc(db, 'system_settings', 'global'))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data() as SystemSettings;
          setPlatformName(d.platformName || 'JORQ Gestão Inteligente');
          setSupportEmail(d.supportEmail || 'suporte@jorq.com.br');
          setMpEnv(d.mpEnvironment || 'sandbox');
          setMaintenanceMode(Boolean(d.maintenanceMode));
        }
      })
      .catch(() => {});

    getIdToken()
      .then((token) =>
        fetch('/api/mercadopago/webhook-logs', {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.logs) setWebhookLogs(data.logs);
      })
      .catch(() => {});

    fetchSecurityStatus();

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [isAdmin, firebaseUser, getIdToken]);

  const fetchSecurityStatus = async () => {
    if (!isAdmin || !firebaseUser) return;
    setLoadingSecurity(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/security/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as SecurityStatusResponse;
        setSecurityStatus(data);
      }
    } catch {
      // ignore transient network errors
    } finally {
      setLoadingSecurity(false);
    }
  };

  const metrics = useMemo(() => {
    const approvedPayments = payments.filter((p) => p.status === 'approved');
    const totalRevenue = approvedPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const activeSubs = subscriptions.filter((s) => s.status === 'authorized');
    const pendingSubs = subscriptions.filter((s) => s.status === 'pending');
    const overdueSubs = subscriptions.filter((s) => s.status === 'overdue' || s.status === 'suspended');
    const cancelledSubs = subscriptions.filter((s) => s.status === 'cancelled');

    const mrr = activeSubs.reduce((s, sub) => s + (Number(sub.baseMonthlyPrice) || 0), 0);
    const pendingMrr = pendingSubs.reduce((s, sub) => s + (Number(sub.baseMonthlyPrice) || 0), 0);
    const churnRiskMrr = [...overdueSubs, ...cancelledSubs].reduce(
      (s, sub) => s + (Number(sub.baseMonthlyPrice) || 0),
      0
    );

    const statusPie = [
      { name: 'Ativas (Positivo)', value: activeSubs.length, color: SEMANTIC_COLORS.positive },
      { name: 'Pendentes (Normal)', value: pendingSubs.length, color: SEMANTIC_COLORS.normal },
      {
        name: 'Inadimplentes / Canceladas (Negativo)',
        value: overdueSubs.length + cancelledSubs.length,
        color: SEMANTIC_COLORS.negative,
      },
    ].filter((x) => x.value > 0);

    const growthMap = new Map<
      string,
      { mes: string; positivas: number; pendentes: number; negativas: number; saldoEmpresas: number }
    >();
    const ensureBucket = (sec?: number) => {
      const d = sec ? new Date(sec * 1000) : new Date();
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
      const cur = growthMap.get(key) || {
        mes: label,
        positivas: 0,
        pendentes: 0,
        negativas: 0,
        saldoEmpresas: 0,
      };
      return { key, cur };
    };

    companies.forEach((c) => {
      const { key, cur } = ensureBucket(c.createdAt?.seconds);
      if (c.status === 'suspended') {
        cur.negativas += 1;
        cur.saldoEmpresas -= 1;
      } else {
        cur.saldoEmpresas += 1;
      }
      growthMap.set(key, cur);
    });

    subscriptions.forEach((sub) => {
      const { key, cur } = ensureBucket(sub.createdAt?.seconds);
      if (sub.status === 'authorized') cur.positivas += 1;
      else if (sub.status === 'pending') cur.pendentes += 1;
      else cur.negativas += 1;
      growthMap.set(key, cur);
    });

    const growthSeries = Array.from(growthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);

    const revenueHealthBars = [
      { categoria: 'Recorrente Ativo', valor: mrr, color: SEMANTIC_COLORS.positive, tag: 'Positivo' },
      { categoria: 'Em Cobrança / Pendente', valor: pendingMrr, color: SEMANTIC_COLORS.normal, tag: 'Normal' },
      { categoria: 'Perda / Inadimplência', valor: -churnRiskMrr, color: SEMANTIC_COLORS.negative, tag: 'Negativo' },
    ];

    return {
      totalRevenue,
      mrr,
      activeCount: activeSubs.length,
      pendingCount: pendingSubs.length,
      overdueCount: overdueSubs.length,
      cancelledCount: cancelledSubs.length,
      statusPie,
      growthSeries,
      revenueHealthBars,
    };
  }, [payments, subscriptions, companies]);

  if (!isAdmin || !firebaseUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md text-center">
          <h1 className="font-display text-xl font-bold text-slate-900">Acesso Restrito</h1>
          <p className="mt-2 text-sm text-slate-600">
            Somente administradores verificados podem acessar o painel proprietário do JORQ.
          </p>
        </div>
      </div>
    );
  }

  const resetPlanForm = () => {
    setEditingPlanId(null);
    setPlanName('');
    setPlanAudience('');
    setPlanDesc('');
    setPlanPrice('');
    setDiscMonthly('0');
    setDiscQuarterly('3');
    setDiscSemiannual('5');
    setDiscAnnual('8');
    setMaxUsers('3');
    setMaxTx('500');
    setAiLimit('50');
    setPlanFeaturesText('');
    setPlanActive(true);
  };

  const handleEditPlan = (p: Plan) => {
    setEditingPlanId(p.id);
    setPlanName(p.name);
    setPlanAudience(p.targetAudience);
    setPlanDesc(p.description || '');
    setPlanPrice(String(p.monthlyPrice));
    setDiscMonthly(String(p.discountMonthly));
    setDiscQuarterly(String(p.discountQuarterly));
    setDiscSemiannual(String(p.discountSemiannual));
    setDiscAnnual(String(p.discountAnnual));
    setMaxUsers(String(p.maxUsers));
    setMaxTx(String(p.maxTransactions));
    setAiLimit(String(p.aiQueriesLimit));
    setPlanFeaturesText((p.features || []).join('\n'));
    setPlanActive(p.active);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = Number(planPrice);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) return;
    setSavingPlan(true);
    try {
      await adminSavePlan(editingPlanId, {
        name: planName,
        targetAudience: planAudience,
        description: planDesc,
        monthlyPrice: numericPrice,
        discountMonthly: Number(discMonthly) || 0,
        discountQuarterly: Number(discQuarterly) || 0,
        discountSemiannual: Number(discSemiannual) || 0,
        discountAnnual: Number(discAnnual) || 0,
        maxUsers: Number(maxUsers) || 1,
        maxTransactions: Number(maxTx) || 100,
        aiQueriesLimit: Number(aiLimit) || 0,
        features: planFeaturesText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        active: planActive,
        sortOrder: plans.length + 1,
      });
      await createAuditLog({
        actorUid: firebaseUser.uid,
        actorEmail: firebaseUser.email || '',
        action: editingPlanId ? 'UPDATE_PLAN' : 'CREATE_PLAN',
        targetCollection: 'plans',
        targetId: editingPlanId || undefined,
        details: `Plano ${planName} configurado com mensalidade R$ ${numericPrice}`,
      });
      resetPlanForm();
    } finally {
      setSavingPlan(false);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    await adminSaveCoupon({
      code: couponCode,
      discountPercent: Number(couponPercent) || 10,
      maxUses: Number(couponMaxUses) || 50,
      usedCount: 0,
      active: true,
      expiresAt: couponExpires || undefined,
    });
    await createAuditLog({
      actorUid: firebaseUser.uid,
      actorEmail: firebaseUser.email || '',
      action: 'CREATE_COUPON',
      targetCollection: 'coupons',
      details: `Cupom ${couponCode.toUpperCase()} (${couponPercent}%) criado`,
    });
    setCouponCode('');
    setCouponExpires('');
  };

  const handleToggleCompany = async (comp: Company) => {
    const nextStatus = comp.status === 'suspended' ? 'active' : 'suspended';
    await adminUpdateCompanyStatus(comp.id, nextStatus);
    await createAuditLog({
      actorUid: firebaseUser.uid,
      actorEmail: firebaseUser.email || '',
      companyId: comp.id,
      action: nextStatus === 'suspended' ? 'SUSPEND_COMPANY' : 'REACTIVATE_COMPANY',
      targetCollection: 'companies',
      targetId: comp.id,
      details: `Empresa ${comp.name} alterada para ${nextStatus}`,
    });
  };

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await adminSaveSystemSettings({
      platformName,
      supportEmail,
      mpEnvironment: mpEnv,
      defaultCurrency: 'BRL',
      maintenanceMode,
      updatedBy: firebaseUser.uid,
    });
    await createAuditLog({
      actorUid: firebaseUser.uid,
      actorEmail: firebaseUser.email || '',
      action: 'UPDATE_SYSTEM_SETTINGS',
      targetCollection: 'system_settings',
      targetId: 'global',
      details: `Ambiente MP: ${mpEnv} · Manutenção: ${maintenanceMode}`,
    });
    setSettingsMsg('Configurações gerais salvas e registradas na auditoria.');
  };

  const navTabs: { id: AdminTabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'executive', label: i18n.adminNav.executive, icon: BarChart3 },
    { id: 'clients', label: i18n.adminNav.clients, icon: Building2 },
    { id: 'plans', label: i18n.adminNav.plans, icon: CreditCard },
    { id: 'coupons', label: i18n.adminNav.coupons, icon: Tag },
    { id: 'billing', label: i18n.adminNav.billing, icon: Activity },
    { id: 'security', label: i18n.adminNav.security, icon: Lock },
    { id: 'audit', label: i18n.adminNav.audit, icon: FileSearch },
    { id: 'settings', label: i18n.adminNav.settings, icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC]/82 backdrop-blur-[2px] flex">
      <aside className="w-64 bg-[#0F172A] text-white flex flex-col shrink-0">
        <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
          <JorqLogo dark />
        </div>
        <div className="px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-300">
            <ShieldCheck className="w-4 h-4" />
            <span>{i18n.adminNav.brandSubtitle}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400 truncate">{firebaseUser.email}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navTabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  active ? 'bg-[#1E40AF] text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-800 space-y-1">
          {onEnterClientMode && (
            <button
              type="button"
              onClick={onEnterClientMode}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-emerald-300 bg-emerald-950/50 border border-emerald-800/70 hover:bg-emerald-900/60 rounded-lg cursor-pointer"
            >
              <Briefcase className="w-4 h-4 shrink-0" />
              <span className="truncate">{i18n.adminNav.clientModeFree}</span>
            </button>
          )}
          {onBackToClient && (
            <button
              type="button"
              onClick={onBackToClient}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{i18n.adminNav.publicSite}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => logout()}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{i18n.common.signOutShort}</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-6 lg:px-8 flex items-center justify-between gap-4">
          <h1 className="font-display text-lg font-bold text-[#0F172A] truncate">
            {navTabs.find((t) => t.id === activeTab)?.label}
          </h1>
          <div className="flex items-center gap-3 shrink-0">
            <LanguageSelector compact />
            <PWAInstallButton compact />
            <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500 font-mono tabular-nums">
              <span>
                {companies.length}{' '}
                {pick({ pt: 'empresas', en: 'companies', es: 'empresas', fr: 'entreprises' })}
              </span>
              <span>·</span>
              <span>
                {users.length}{' '}
                {pick({ pt: 'usuários', en: 'users', es: 'usuarios', fr: 'utilisateurs' })}
              </span>
            </div>
            {onEnterClientMode && (
              <button
                type="button"
                onClick={onEnterClientMode}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>{i18n.adminNav.clientModeFree}</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-8 max-w-7xl w-full mx-auto space-y-8">
          {activeTab === 'executive' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <p className="text-xs font-semibold text-slate-500">Faturamento Total</p>
                  <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-[#0F172A]">
                    {formatBRL(metrics.totalRevenue)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Soma de cobranças aprovadas</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <p className="text-xs font-semibold text-slate-500">MRR (Recorrente Mensal)</p>
                  <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-[#1E40AF]">
                    {formatBRL(metrics.mrr)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {metrics.activeCount} assinaturas ativas
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <p className="text-xs font-semibold text-slate-500">Inadimplentes / Suspensos</p>
                  <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-[#DC2626]">
                    {metrics.overdueCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Empresas com acesso bloqueado ou vencido</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <p className="text-xs font-semibold text-slate-500">Cancelamentos</p>
                  <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-slate-800">
                    {metrics.cancelledCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Assinaturas encerradas</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
                  <h2 className="font-display text-base font-bold text-[#0F172A]">
                    Saúde Mensal de Assinaturas e Crescimento
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 mb-3">
                    Verde indica assinaturas ativas, amarelo indica pendentes em processo e vermelho indica cancelamentos ou suspensões.
                  </p>
                  <div className="mb-4">
                    <SemanticChartLegend
                      items={[
                        { label: 'Ativas (Positivo)', color: SEMANTIC_COLORS.positive },
                        { label: 'Pendentes (Normal)', color: SEMANTIC_COLORS.normal },
                        { label: 'Inadimp. / Canceladas (Negativo)', color: SEMANTIC_COLORS.negative },
                      ]}
                    />
                  </div>
                  {metrics.growthSeries.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-sm text-slate-500">
                      Sem dados suficientes para exibir o gráfico.
                    </div>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={metrics.growthSeries}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                          <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748B' }} />
                          <YAxis tick={{ fontSize: 12, fill: '#64748B' }} allowDecimals={false} />
                          <ReferenceLine y={0} stroke="#CBD5E1" />
                          <Tooltip
                            contentStyle={{
                              borderRadius: '10px',
                              border: '1px solid #E2E8F0',
                              fontSize: '12px',
                            }}
                          />
                          <Bar
                            dataKey="positivas"
                            name="Ativas (Positivo)"
                            fill={SEMANTIC_COLORS.positive}
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="pendentes"
                            name="Pendentes (Normal)"
                            fill={SEMANTIC_COLORS.normal}
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="negativas"
                            name="Cancel./Inadimp. (Negativo)"
                            fill={SEMANTIC_COLORS.negative}
                            radius={[4, 4, 0, 0]}
                          />
                          <Line
                            type="monotone"
                            dataKey="saldoEmpresas"
                            name="Saldo de Empresas"
                            stroke="#0F172A"
                            strokeWidth={2}
                            dot={{ r: 3.5, fill: '#0F172A' }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
                  <h2 className="font-display text-base font-bold text-[#0F172A]">
                    Termômetro Financeiro de Receita (MRR)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 mb-3">
                    Receita recorrente garantida vs valores pendentes vs impacto negativo de cancelamentos.
                  </p>
                  <div className="mb-4">
                    <SemanticChartLegend
                      items={[
                        { label: 'Positivo', color: SEMANTIC_COLORS.positive },
                        { label: 'Normal', color: SEMANTIC_COLORS.normal },
                        { label: 'Negativo', color: SEMANTIC_COLORS.negative },
                      ]}
                    />
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.revenueHealthBars}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                        <XAxis dataKey="categoria" tick={{ fontSize: 11, fill: '#64748B' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                        <ReferenceLine y={0} stroke="#64748B" strokeDasharray="3 3" />
                        <Tooltip
                          formatter={(val, _name, item) => [
                            `${formatBRL(Number(val))} (${item?.payload?.tag || ''})`,
                            'Receita Mensal',
                          ]}
                          contentStyle={{
                            borderRadius: '10px',
                            border: '1px solid #E2E8F0',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="valor" name="Valor (R$)" radius={[4, 4, 4, 4]}>
                          {metrics.revenueHealthBars.map((entry) => (
                            <Cell key={entry.categoria} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
                  <h2 className="font-display text-base font-bold text-[#0F172A]">
                    Distribuição Semafórica das Assinaturas
                  </h2>
                  <p className="text-xs text-slate-500 mb-4">
                    Proporção atual da base entre contas positivas, normais e negativas.
                  </p>
                  {metrics.statusPie.length === 0 ? (
                    <div className="h-56 flex items-center justify-center text-sm text-slate-500">
                      Nenhuma assinatura registrada.
                    </div>
                  ) : (
                    <div>
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={metrics.statusPie}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={75}
                              paddingAngle={2}
                            >
                              {metrics.statusPie.map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-3 space-y-1.5">
                        {metrics.statusPie.map((item) => (
                          <div key={item.name} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-slate-700">
                              <span
                                className="w-2.5 h-2.5 rounded-sm shrink-0"
                                style={{ backgroundColor: item.color }}
                              />
                              <span>{item.name}</span>
                            </span>
                            <span className="font-mono tabular-nums font-semibold text-slate-900">
                              {item.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
                  <div>
                    <h2 className="font-display text-base font-bold text-[#0F172A]">
                      Critérios Semafóricos do Painel Administrativo
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Referência visual para acompanhamento imediato da carteira SaaS do JORQ.
                    </p>
                  </div>
                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-4">
                      <p className="text-xs font-bold text-[#16A34A]">Verde · Positivo</p>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                        Assinaturas autorizadas e receita recorrente mensal (MRR) ativa e adimplente.
                      </p>
                    </div>
                    <div className="border border-amber-200 bg-amber-50/60 rounded-lg p-4">
                      <p className="text-xs font-bold text-[#B45309]">Amarelo · Normal</p>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                        Assinaturas pendentes de confirmação no Mercado Pago ou em processo de ativação.
                      </p>
                    </div>
                    <div className="border border-red-200 bg-red-50/50 rounded-lg p-4">
                      <p className="text-xs font-bold text-[#DC2626]">Vermelho · Negativo</p>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                        Contas inadimplentes, suspensas ou canceladas que impactam negativamente a base.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'clients' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-[#0F172A]">
                    Empresas Cadastradas ({companies.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                        <th className="py-3 px-5">Empresa</th>
                        <th className="py-3 px-5">Segmento</th>
                        <th className="py-3 px-5">Documento</th>
                        <th className="py-3 px-5">Status</th>
                        <th className="py-3 px-5 text-right">Controle de Acesso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {companies.map((c) => (
                        <tr key={c.id}>
                          <td className="py-3 px-5 font-semibold text-slate-900">{c.name}</td>
                          <td className="py-3 px-5 text-xs text-slate-600">{c.sector || '—'}</td>
                          <td className="py-3 px-5 font-mono text-xs text-slate-600">
                            {c.document || '—'}
                          </td>
                          <td className="py-3 px-5 text-xs font-semibold">
                            <span
                              className={
                                c.status === 'suspended' ? 'text-[#DC2626]' : 'text-[#16A34A]'
                              }
                            >
                              {c.status === 'suspended' ? 'Suspensa' : 'Ativa'}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleCompany(c)}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                                c.status === 'suspended'
                                  ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                                  : 'border-red-200 text-red-700 hover:bg-red-50'
                              }`}
                            >
                              {c.status === 'suspended' ? 'Reativar Acesso' : 'Suspender Acesso'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#1E40AF]" />
                  <h2 className="font-display text-base font-bold text-[#0F172A]">
                    Usuários Registrados ({users.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                        <th className="py-3 px-5">Nome</th>
                        <th className="py-3 px-5">E-mail</th>
                        <th className="py-3 px-5">Papel</th>
                        <th className="py-3 px-5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {users.map((u) => (
                        <tr key={u.uid}>
                          <td className="py-3 px-5 font-medium text-slate-900">{u.name}</td>
                          <td className="py-3 px-5 text-xs text-slate-600">{u.email}</td>
                          <td className="py-3 px-5 text-xs font-semibold text-slate-700">
                            {u.role === 'admin' ? 'Administrador' : 'Cliente'}
                          </td>
                          <td className="py-3 px-5 text-xs text-slate-600">{u.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'plans' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleSavePlan}
                className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4 self-start"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-[#0F172A]">
                    {editingPlanId ? 'Editar Plano' : 'Criar Novo Plano'}
                  </h2>
                  {editingPlanId && (
                    <button
                      type="button"
                      onClick={resetPlanForm}
                      className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      Novo
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome do Plano *
                  </label>
                  <input
                    type="text"
                    required
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder="Ex: Essencial, Profissional, Corporativo"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Público-alvo *
                  </label>
                  <input
                    type="text"
                    required
                    value={planAudience}
                    onChange={(e) => setPlanAudience(e.target.value)}
                    placeholder="Ex: Para pequenas empresas em crescimento"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Descrição
                  </label>
                  <input
                    type="text"
                    value={planDesc}
                    onChange={(e) => setPlanDesc(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Preço Mensal Base (R$) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={planPrice}
                    onChange={(e) => setPlanPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Desc. Mensal (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="90"
                      value={discMonthly}
                      onChange={(e) => setDiscMonthly(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Desc. Trimestral (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="90"
                      value={discQuarterly}
                      onChange={(e) => setDiscQuarterly(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Desc. Semestral (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="90"
                      value={discSemiannual}
                      onChange={(e) => setDiscSemiannual(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Desc. Anual (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="90"
                      value={discAnnual}
                      onChange={(e) => setDiscAnnual(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Usuários</label>
                    <input
                      type="number"
                      min="1"
                      value={maxUsers}
                      onChange={(e) => setMaxUsers(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Lanç./mês</label>
                    <input
                      type="number"
                      min="1"
                      value={maxTx}
                      onChange={(e) => setMaxTx(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">IA/mês</label>
                    <input
                      type="number"
                      min="0"
                      value={aiLimit}
                      onChange={(e) => setAiLimit(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Benefícios (1 por linha, máx. 10)
                  </label>
                  <textarea
                    rows={3}
                    value={planFeaturesText}
                    onChange={(e) => setPlanFeaturesText(e.target.value)}
                    placeholder="Exportação PDF e CSV&#10;Previsão financeira com IA"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={planActive}
                    onChange={(e) => setPlanActive(e.target.checked)}
                  />
                  <span>Plano visível para contratação</span>
                </label>

                <button
                  type="submit"
                  disabled={savingPlan}
                  className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] cursor-pointer"
                >
                  {savingPlan ? 'Salvando...' : editingPlanId ? 'Atualizar Plano' : 'Publicar Plano'}
                </button>
              </form>

              <div className="lg:col-span-7 space-y-4">
                {plans.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
                    Nenhum plano configurado ainda. Utilize o formulário ao lado para definir os
                    planos e valores comerciais.
                  </div>
                ) : (
                  plans.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div>
                        <p className="text-xs font-medium text-[#1E40AF]">
                          {p.active ? 'Ativo' : 'Oculto'} · {p.targetAudience}
                        </p>
                        <h3 className="mt-1 font-display text-lg font-bold text-[#0F172A]">
                          {p.name} —{' '}
                          <span className="font-mono tabular-nums">
                            {formatBRL(p.monthlyPrice)}/mês
                          </span>
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 font-mono">
                          Descontos: M {p.discountMonthly}% · T {p.discountQuarterly}% · S{' '}
                          {p.discountSemiannual}% · A {p.discountAnnual}% | Limites: {p.maxUsers}{' '}
                          usuários, {p.maxTransactions} lanç., {p.aiQueriesLimit} IA
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditPlan(p)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => adminDeletePlan(p.id)}
                          className="p-1.5 text-slate-400 hover:text-[#DC2626] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'coupons' && (
            <div className="space-y-6">
              <form
                onSubmit={handleCreateCoupon}
                className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Código do Cupom *
                  </label>
                  <input
                    type="text"
                    required
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="JORQ15"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Desconto (%) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="90"
                    value={couponPercent}
                    onChange={(e) => setCouponPercent(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Limite de Usos
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={couponMaxUses}
                    onChange={(e) => setCouponMaxUses(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Criar Cupom</span>
                </button>
              </form>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                      <th className="py-3 px-5">Código</th>
                      <th className="py-3 px-5">Desconto</th>
                      <th className="py-3 px-5">Usos</th>
                      <th className="py-3 px-5">Status</th>
                      <th className="py-3 px-5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {coupons.map((c) => (
                      <tr key={c.id}>
                        <td className="py-3 px-5 font-mono font-bold text-slate-900">{c.code}</td>
                        <td className="py-3 px-5 font-mono tabular-nums">{c.discountPercent}%</td>
                        <td className="py-3 px-5 font-mono tabular-nums">
                          {c.usedCount} / {c.maxUses}
                        </td>
                        <td className="py-3 px-5 text-xs">
                          <button
                            type="button"
                            onClick={() => adminToggleCoupon(c.id, !c.active)}
                            className={`font-semibold cursor-pointer ${
                              c.active ? 'text-[#16A34A]' : 'text-slate-500'
                            }`}
                          >
                            {c.active ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                        <td className="py-3 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => adminDeleteCoupon(c.id)}
                            className="p-1.5 text-slate-400 hover:text-[#DC2626] cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="font-display text-base font-bold text-[#0F172A]">
                    Assinaturas de Clientes ({subscriptions.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                        <th className="py-3 px-5">Plano</th>
                        <th className="py-3 px-5">Ciclo</th>
                        <th className="py-3 px-5 text-right">Valor</th>
                        <th className="py-3 px-5">Status</th>
                        <th className="py-3 px-5 text-right">Ação Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {subscriptions.map((s) => (
                        <tr key={s.id}>
                          <td className="py-3 px-5 font-semibold text-slate-900">{s.planName}</td>
                          <td className="py-3 px-5 text-xs text-slate-600">{s.billingCycle}</td>
                          <td className="py-3 px-5 text-right font-mono tabular-nums font-semibold">
                            {formatBRL(s.totalAmount)}
                          </td>
                          <td className="py-3 px-5 text-xs font-semibold">
                            {translateSubscriptionStatus(s.status).label}
                          </td>
                          <td className="py-3 px-5 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => adminUpdateSubscriptionStatus(s.id, 'authorized')}
                              className="text-xs font-semibold text-[#16A34A] hover:underline cursor-pointer"
                            >
                              Ativar
                            </button>
                            <button
                              type="button"
                              onClick={() => adminUpdateSubscriptionStatus(s.id, 'suspended')}
                              className="text-xs font-semibold text-[#DC2626] hover:underline cursor-pointer"
                            >
                              Suspender
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="font-display text-base font-bold text-[#0F172A]">
                    Eventos de Webhook Mercado Pago ({webhookLogs.length})
                  </h2>
                </div>
                {webhookLogs.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    Nenhum evento de webhook recebido até o momento.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                          <th className="py-3 px-5">Recebido em</th>
                          <th className="py-3 px-5">Tópico / Ação</th>
                          <th className="py-3 px-5">ID Recurso</th>
                          <th className="py-3 px-5">Assinatura</th>
                          <th className="py-3 px-5">Resultado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {webhookLogs.map((w) => (
                          <tr key={w.id}>
                            <td className="py-3 px-5 font-mono text-slate-500">{w.receivedAt}</td>
                            <td className="py-3 px-5 font-medium text-slate-900">
                              {w.type} · {w.action}
                            </td>
                            <td className="py-3 px-5 font-mono text-slate-600">{w.dataId || '—'}</td>
                            <td className="py-3 px-5">
                              {w.signatureValid ? 'Válida' : 'Inválida'}
                              {w.idempotentDuplicate ? ' (Duplicado)' : ''}
                            </td>
                            <td className="py-3 px-5 font-semibold text-slate-800">
                              {w.error || w.resolvedStatus}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#1E40AF]">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Blindagem Gratuita Multi-Camada Ativa</span>
                  </div>
                  <h2 className="mt-1 font-display text-lg font-bold text-[#0F172A]">
                    Monitoramento de Segurança e Proteção Anti-Ataques
                  </h2>
                  <p className="mt-1 text-xs text-slate-600">
                    Camadas HTTP, anti-DDoS, sanitização de payloads, verificação de origem e regras
                    estritas no banco de dados sem custos adicionais.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchSecurityStatus}
                  disabled={loadingSecurity}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingSecurity ? 'animate-spin' : ''}`} />
                  <span>{loadingSecurity ? 'Atualizando...' : 'Atualizar Diagnóstico'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-semibold text-slate-500">Ataques / Flood Bloqueados (429)</p>
                  <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-[#0F172A]">
                    {securityStatus?.telemetry.rateLimitedRequests ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Rate limiter ativo por IP</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-semibold text-slate-500">Origens Externas Barradas (403)</p>
                  <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-[#0F172A]">
                    {securityStatus?.telemetry.blockedOriginRequests ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Proteção CSRF / Cross-Origin</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-semibold text-slate-500">Payloads Maliciosos Limpos</p>
                  <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-[#0F172A]">
                    {securityStatus?.telemetry.sanitizedPayloads ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Bloqueio de __proto__ e operadores $</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-semibold text-slate-500">Webhooks Falsos Rejeitados</p>
                  <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-[#DC2626]">
                    {securityStatus?.telemetry.invalidWebhookSignatures ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Validação HMAC-SHA256 Mercado Pago</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <h3 className="font-display text-base font-bold text-[#0F172A]">
                    Cabeçalhos HTTP de Segurança (Ativos)
                  </h3>
                  <div className="divide-y divide-slate-100 text-xs">
                    {[
                      {
                        label: 'Content-Security-Policy (CSP)',
                        desc: 'Restringe scripts, conexões e objetos maliciosos (anti-XSS).',
                        ok: securityStatus?.headers.csp ?? true,
                      },
                      {
                        label: 'Strict-Transport-Security (HSTS)',
                        desc: 'Força navegação HTTPS criptografada em navegadores modernos.',
                        ok: securityStatus?.headers.hsts ?? true,
                      },
                      {
                        label: 'X-Content-Type-Options: nosniff',
                        desc: 'Impede MIME-sniffing e execução de arquivos disfarçados.',
                        ok: securityStatus?.headers.nosniff ?? true,
                      },
                      {
                        label: 'Cross-Origin-Opener-Policy & Referrer-Policy',
                        desc: 'Isola janelas e oculta parâmetros sensíveis em links externos.',
                        ok: (securityStatus?.headers.coop ?? true) && (securityStatus?.headers.referrerPolicy ?? true),
                      },
                      {
                        label: 'Permissions-Policy & Ocultação de Stack',
                        desc: 'Desativa câmera/USB/microfone e remove header X-Powered-By.',
                        ok: (securityStatus?.headers.permissionsPolicy ?? true) && (securityStatus?.headers.poweredByHidden ?? true),
                      },
                    ].map((item) => (
                      <div key={item.label} className="py-3 flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">{item.label}</p>
                          <p className="text-slate-500 mt-0.5">{item.desc}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 font-semibold text-[#16A34A] shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{item.ok ? 'Ativo' : 'Pendente'}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <h3 className="font-display text-base font-bold text-[#0F172A]">
                    Defesas de Aplicação, Dados e Anti-Bot
                  </h3>
                  <div className="divide-y divide-slate-100 text-xs">
                    {[
                      {
                        label: 'Rate Limiting por IP (API, IA, Checkout e Webhook)',
                        desc: 'Limita requisições por minuto com resposta HTTP 429 automática.',
                        ok: securityStatus?.protections.rateLimiting ?? true,
                      },
                      {
                        label: 'Sanitização Anti-Prototype Pollution & NoSQL Injection',
                        desc: 'Remove recursivamente chaves __proto__, constructor, prototype e $.',
                        ok:
                          (securityStatus?.protections.prototypePollutionGuard ?? true) &&
                          (securityStatus?.protections.nosqlOperatorSanitizer ?? true),
                      },
                      {
                        label: 'Autenticação Firebase + E-mail Verificado + Regras Firestore',
                        desc: 'Isolamento estrito por empresa (tenant) e bloqueio de escalação de papel.',
                        ok:
                          (securityStatus?.protections.firebaseIdTokenVerification ?? true) &&
                          (securityStatus?.protections.firestoreStrictRules ?? true),
                      },
                      {
                        label: 'Assinatura HMAC-SHA256 em Webhooks Mercado Pago',
                        desc: 'Defina MP_WEBHOOK_SECRET no servidor para validar toda notificação.',
                        ok: Boolean(securityStatus?.protections.mpWebhookHmac),
                      },
                      {
                        label: 'Firebase App Check + Google reCAPTCHA v3 (Gratuito)',
                        desc: 'Proteção anti-bot invisível nas chamadas ao Firebase e APIs.',
                        ok: Boolean(securityStatus?.protections.appCheckConfigured),
                      },
                    ].map((item) => (
                      <div key={item.label} className="py-3 flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">{item.label}</p>
                          <p className="text-slate-500 mt-0.5">{item.desc}</p>
                        </div>
                        {item.ok ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#16A34A] shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Ativo</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#D97706] shrink-0">
                            <ShieldAlert className="w-4 h-4" />
                            <span>Configurar Chave</span>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 text-slate-100 rounded-xl p-6 space-y-3">
                <h3 className="font-display text-sm font-bold text-white">
                  Como ativar 100% gratuitamente o reCAPTCHA v3 + Firebase App Check e Cloudflare
                </h3>
                <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1.5 leading-relaxed">
                  <li>
                    Acesse o <strong className="text-white">Google reCAPTCHA Admin</strong> (plano
                    gratuito até 1 milhão de verificações/mês), crie uma chave v3 para o seu
                    domínio e registre-a no <strong className="text-white">Firebase Console &gt; App Check</strong>.
                  </li>
                  <li>
                    Adicione a variável pública <code className="font-mono text-blue-300">VITE_FIREBASE_APP_CHECK_SITE_KEY</code>{' '}
                    nas configurações de ambiente (Secrets ou Render) e <code className="font-mono text-blue-300">MP_WEBHOOK_SECRET</code>{' '}
                    para validar webhooks do Mercado Pago.
                  </li>
                  <li>
                    Em produção com domínio próprio, aponte seu DNS pelo plano gratuito da{' '}
                    <strong className="text-white">Cloudflare</strong> para somar WAF, proxy DNS e
                    mitigação DDoS L3/L4/L7 na borda sem custo mensal.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="font-display text-base font-bold text-[#0F172A]">
                  Registros de Auditoria ({auditLogs.length})
                </h2>
              </div>
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Nenhum registro de auditoria disponível ainda.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                        <th className="py-3 px-5">Ação</th>
                        <th className="py-3 px-5">Autor</th>
                        <th className="py-3 px-5">Coleção</th>
                        <th className="py-3 px-5">Detalhes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {auditLogs.map((l) => (
                        <tr key={l.id}>
                          <td className="py-3 px-5 font-mono font-semibold text-slate-900">
                            {l.action}
                          </td>
                          <td className="py-3 px-5 text-slate-600">{l.actorEmail || l.actorUid}</td>
                          <td className="py-3 px-5 font-mono text-slate-600">{l.targetCollection}</td>
                          <td className="py-3 px-5 text-slate-700">{l.details || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-3xl">
              <form
                onSubmit={handleSaveSystemSettings}
                className="bg-white border border-slate-200 rounded-xl p-8 space-y-5"
              >
                <h2 className="font-display text-lg font-bold text-[#0F172A]">
                  Configurações Gerais da Plataforma
                </h2>
                {settingsMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                    {settingsMsg}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome da Plataforma
                  </label>
                  <input
                    type="text"
                    required
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail de Suporte
                  </label>
                  <input
                    type="email"
                    required
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ambiente Mercado Pago
                  </label>
                  <select
                    value={mpEnv}
                    onChange={(e) => setMpEnv(e.target.value as 'sandbox' | 'production')}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="sandbox">Sandbox (Credenciais de Teste)</option>
                    <option value="production">Produção</option>
                  </select>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={maintenanceMode}
                    onChange={(e) => setMaintenanceMode(e.target.checked)}
                  />
                  <span>Modo manutenção programada</span>
                </label>
                <div>
                  <button
                    type="submit"
                    className="px-6 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] cursor-pointer"
                  >
                    Salvar Configurações
                  </button>
                </div>
              </form>

              <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-[#16A34A]">
                    Auto-Deploy GitHub + Render Configurado
                  </p>
                  <h3 className="mt-1 font-display text-base font-bold text-[#0F172A]">
                    Publicação Automática em Produção (Render)
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Os arquivos <code className="font-mono">render.yaml</code>,{' '}
                    <code className="font-mono">.node-version</code> e{' '}
                    <code className="font-mono">.github/workflows/deploy.yml</code> já estão
                    preparados para validar e publicar automaticamente toda atualização enviada para
                    a branch <code className="font-mono">main</code> no GitHub.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="font-semibold text-slate-800">Build &amp; Start (Render)</p>
                    <p className="mt-1 font-mono text-slate-600">
                      Build: npm install &amp;&amp; npm run build
                    </p>
                    <p className="font-mono text-slate-600">Start: npm start</p>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="font-semibold text-slate-800">Endpoints de Produção</p>
                    <p className="mt-1 font-mono text-slate-600 break-all">
                      Health: {typeof window !== 'undefined' ? `${window.location.origin}/api/health` : '/api/health'}
                    </p>
                    <p className="font-mono text-slate-600 break-all">
                      Webhook MP: {typeof window !== 'undefined' ? `${window.location.origin}/api/mercadopago/webhook` : '/api/mercadopago/webhook'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Lembrete ao publicar no Render: adicione o domínio <code className="font-mono">*.onrender.com</code>{' '}
                  do seu serviço em <strong>Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains</strong>{' '}
                  e preencha <code className="font-mono">GEMINI_API_KEY</code>,{' '}
                  <code className="font-mono">MP_ACCESS_TOKEN</code> e{' '}
                  <code className="font-mono">MP_WEBHOOK_SECRET</code> no painel de ambiente do Render.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
