import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BellRing,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  FileSearch,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Trash2,
  Users,
  X,
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
  LabelList,
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
  adminDeleteUserDoc,
  adminSaveCoupon,
  adminSavePlan,
  adminSaveSystemSettings,
  adminSendBillingNotification,
  adminSetCompanyTrial,
  adminToggleCoupon,
  adminUpdateCompanyStatus,
  adminUpdateSubscriptionStatus,
  createAuditLog,
  subscribeAdminCollection,
  type AuditLog,
  type Company,
  type CompanyMember,
  type Coupon,
  type PaymentRecord,
  type Plan,
  type Subscription,
  type SystemSettings,
  type UserProfile,
} from '../services/firestoreService';
import { exportToCSV } from '../utils/export';
import {
  addMonthsToDateIso,
  formatBRL,
  formatCompactBRL,
  formatDateBR,
  formatDateTimeBR,
  formatTrialRemaining,
  getDaysUntilDate,
  getSubscriptionDueDateIso,
  isIsoDateExpired,
  isSubscriptionActiveAndValid,
  translateSubscriptionStatus,
} from '../utils/format';

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

interface VerifiedSubscriptionServerItem {
  subscriptionId: string;
  companyId: string;
  userId: string;
  preapprovalId: string;
  planName: string;
  billingCycle: string;
  status: string;
  nextBillingDate: string | null;
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [securityStatus, setSecurityStatus] = useState<SecurityStatusResponse | null>(null);
  const [loadingSecurity, setLoadingSecurity] = useState(false);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLogItem[]>([]);
  const [verifiedSubscriptions, setVerifiedSubscriptions] = useState<VerifiedSubscriptionServerItem[]>([]);
  const [notifiedSubIds, setNotifiedSubIds] = useState<Record<string, boolean>>({});
  const [billingFeedback, setBillingFeedback] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [copiedContactId, setCopiedContactId] = useState('');

  // Cliente Teste modal state
  const [trialModalCompany, setTrialModalCompany] = useState<{
    company: Company;
    clientName: string;
    clientEmail: string;
  } | null>(null);
  const [trialPresetKey, setTrialPresetKey] = useState<
    '1h' | '1d' | '3d' | '7d' | '15d' | '30d' | 'custom' | 'exact'
  >('7d');
  const [trialCustomAmount, setTrialCustomAmount] = useState('7');
  const [trialCustomUnit, setTrialCustomUnit] = useState<'hours' | 'days'>('days');
  const [trialExactDatetime, setTrialExactDatetime] = useState('');
  const [trialNote, setTrialNote] = useState('');
  const [trialBusy, setTrialBusy] = useState(false);
  const [trialFeedback, setTrialFeedback] = useState('');

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
    const id = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isAdmin || !firebaseUser) return;

    const unsubs = [
      subscribeAdminCollection<UserProfile>('users', setUsers),
      subscribeAdminCollection<Company>('companies', setCompanies),
      subscribeAdminCollection<CompanyMember>('company_members', setCompanyMembers),
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
        if (Array.isArray(data?.verifiedSubscriptions)) {
          setVerifiedSubscriptions(data.verifiedSubscriptions);
        }
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

    const activeSubs = subscriptions.filter((s) => isSubscriptionActiveAndValid(s, nowMs));
    const pendingSubs = subscriptions.filter((s) => s.status === 'pending');
    const overdueSubs = subscriptions.filter(
      (s) =>
        s.status === 'overdue' ||
        s.status === 'suspended' ||
        (s.status === 'authorized' && !isSubscriptionActiveAndValid(s, nowMs))
    );
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
      if (isSubscriptionActiveAndValid(sub, nowMs)) cur.positivas += 1;
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
  }, [payments, subscriptions, companies, nowMs]);

  const clientDirectory = useMemo(() => {
    return companies.map((c) => {
      const ownerMember =
        companyMembers.find((m) => m.companyId === c.id && m.role === 'owner') ||
        companyMembers.find((m) => m.companyId === c.id) ||
        companyMembers.find((m) => m.userId === c.ownerId);
      const legacyUser = users.find((u) => u.uid === c.ownerId || u.companyId === c.id);
      const clientName = ownerMember?.name || legacyUser?.name || c.name;
      const clientEmail = ownerMember?.email || legacyUser?.email || '';
      const phone = c.phone || '';
      const rawDigits = phone.replace(/\D/g, '');
      const whatsappNumber =
        rawDigits.length === 10 || rawDigits.length === 11
          ? `55${rawDigits}`
          : rawDigits.length >= 12
            ? rawDigits
            : '';
      const companySubs = subscriptions
        .filter((s) => s.companyId === c.id)
        .sort((a, b) => (b.updatedAt?.seconds || b.createdAt?.seconds || 0) - (a.updatedAt?.seconds || a.createdAt?.seconds || 0));
      const latestSub =
        companySubs.find((s) => isSubscriptionActiveAndValid(s, nowMs)) || companySubs[0] || null;

      return {
        company: c,
        clientName,
        clientEmail,
        phone,
        whatsappNumber,
        latestSub,
      };
    });
  }, [companies, companyMembers, users, subscriptions, nowMs]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clientDirectory;
    return clientDirectory.filter(
      (item) =>
        item.clientName.toLowerCase().includes(q) ||
        item.company.name.toLowerCase().includes(q) ||
        (item.company.tradeName || '').toLowerCase().includes(q) ||
        item.clientEmail.toLowerCase().includes(q) ||
        item.phone.toLowerCase().includes(q) ||
        (item.company.document || '').toLowerCase().includes(q)
    );
  }, [clientDirectory, clientSearch]);

  const trialClients = useMemo(
    () => clientDirectory.filter((item) => item.company.status === 'trial'),
    [clientDirectory]
  );

  const subscriptionDueRows = useMemo(() => {
    return subscriptions.map((s) => {
      const comp = companies.find((c) => c.id === s.companyId);
      const dirEntry = clientDirectory.find((d) => d.company.id === s.companyId);
      const serverMatch = verifiedSubscriptions.find(
        (vs) =>
          vs.subscriptionId === s.id ||
          (s.mpPreapprovalId && vs.preapprovalId === s.mpPreapprovalId) ||
          vs.companyId === s.companyId
      );
      const dueDateIso = serverMatch?.nextBillingDate || getSubscriptionDueDateIso(s);
      const daysRemaining = getDaysUntilDate(dueDateIso);
      const valid = isSubscriptionActiveAndValid(s, nowMs);
      const isOverdue =
        s.status === 'overdue' ||
        (s.status === 'authorized' && (!valid || (daysRemaining !== null && daysRemaining < 0)));
      const isExpiringSoon =
        !isOverdue && valid && daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7;

      return {
        sub: s,
        companyName: comp?.name || s.companyId,
        clientName: dirEntry?.clientName || comp?.name || '',
        clientEmail: dirEntry?.clientEmail || '',
        clientPhone: dirEntry?.phone || '',
        dueDateIso,
        daysRemaining,
        isOverdue,
        isExpiringSoon,
      };
    });
  }, [subscriptions, companies, clientDirectory, verifiedSubscriptions, nowMs]);

  const expiringAlerts = useMemo(
    () => subscriptionDueRows.filter((row) => row.isOverdue || row.isExpiringSoon),
    [subscriptionDueRows]
  );

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

  const openTrialModal = (item: {
    company: Company;
    clientName: string;
    clientEmail: string;
  }) => {
    setTrialModalCompany(item);
    setTrialPresetKey(item.company.status === 'trial' && item.company.trialExpiresAt ? 'exact' : '7d');
    setTrialCustomAmount('7');
    setTrialCustomUnit('days');
    if (item.company.trialExpiresAt) {
      const dt = new Date(item.company.trialExpiresAt);
      if (!Number.isNaN(dt.getTime())) {
        const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setTrialExactDatetime(local);
      } else {
        setTrialExactDatetime('');
      }
    } else {
      const def = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      setTrialExactDatetime(
        new Date(def.getTime() - def.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      );
    }
    setTrialNote(item.company.trialNote || '');
  };

  const computeTrialExpiresIso = (): string | null => {
    const now = Date.now();
    if (trialPresetKey === '1h') return new Date(now + 60 * 60 * 1000).toISOString();
    if (trialPresetKey === '1d') return new Date(now + 24 * 60 * 60 * 1000).toISOString();
    if (trialPresetKey === '3d') return new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString();
    if (trialPresetKey === '7d') return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    if (trialPresetKey === '15d') return new Date(now + 15 * 24 * 60 * 60 * 1000).toISOString();
    if (trialPresetKey === '30d') return new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
    if (trialPresetKey === 'custom') {
      const num = Math.max(1, Number(trialCustomAmount) || 1);
      const ms = trialCustomUnit === 'hours' ? num * 60 * 60 * 1000 : num * 24 * 60 * 60 * 1000;
      return new Date(now + ms).toISOString();
    }
    if (trialExactDatetime) {
      const d = new Date(trialExactDatetime);
      if (!Number.isNaN(d.getTime()) && d.getTime() > now) return d.toISOString();
    }
    return null;
  };

  const handleSaveTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trialModalCompany) return;
    const expiresIso = computeTrialExpiresIso();
    if (!expiresIso) {
      setTrialFeedback('Escolha um prazo futuro válido para o Cliente Teste.');
      return;
    }
    setTrialBusy(true);
    try {
      const comp = trialModalCompany.company;
      await adminSetCompanyTrial(comp.id, {
        active: true,
        expiresAt: expiresIso,
        note: trialNote,
      });
      try {
        const token = await getIdToken();
        await fetch('/api/admin/set-company-trial', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            companyId: comp.id,
            active: true,
            expiresAt: expiresIso,
            note: trialNote,
          }),
        });
      } catch {
        // ignore transient server ledger sync
      }
      await createAuditLog({
        actorUid: firebaseUser.uid,
        actorEmail: firebaseUser.email || '',
        companyId: comp.id,
        action: 'GRANT_CLIENT_TRIAL',
        targetCollection: 'companies',
        targetId: comp.id,
        details: `Cliente Teste liberado para ${comp.name} até ${formatDateTimeBR(expiresIso, 'pt')}${
          trialNote ? ` · ${trialNote}` : ''
        }`,
      });
      setTrialFeedback(
        `Acesso gratuito de Cliente Teste liberado para ${comp.name} até ${formatDateTimeBR(
          expiresIso,
          'pt'
        )}.`
      );
      setTrialModalCompany(null);
    } finally {
      setTrialBusy(false);
    }
  };

  const handleRevokeTrial = async (comp: Company) => {
    setTrialBusy(true);
    try {
      await adminSetCompanyTrial(comp.id, { active: false });
      try {
        const token = await getIdToken();
        await fetch('/api/admin/set-company-trial', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            companyId: comp.id,
            active: false,
          }),
        });
      } catch {
        // ignore transient server ledger sync
      }
      await createAuditLog({
        actorUid: firebaseUser.uid,
        actorEmail: firebaseUser.email || '',
        companyId: comp.id,
        action: 'REVOKE_CLIENT_TRIAL',
        targetCollection: 'companies',
        targetId: comp.id,
        details: `Modo Cliente Teste encerrado para ${comp.name}`,
      });
      setTrialFeedback(`Modo Cliente Teste encerrado para ${comp.name}.`);
    } finally {
      setTrialBusy(false);
    }
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

  const handleNotifyClientDue = async (row: {
    sub: Subscription;
    companyName: string;
    dueDateIso: string | null;
    daysRemaining: number | null;
    isOverdue: boolean;
  }) => {
    const dueLabel = row.dueDateIso ? formatDateBR(row.dueDateIso, 'pt') : 'em breve';
    const title = row.isOverdue
      ? `Mensalidade vencida · ${row.sub.planName}`
      : `Lembrete de vencimento · ${row.sub.planName}`;
    const message = row.isOverdue
      ? `A assinatura do plano ${row.sub.planName} da empresa ${row.companyName} venceu em ${dueLabel}. Regularize via Pix ou Mercado Pago na aba Assinatura para manter seu acesso ativo.`
      : row.daysRemaining === 0
        ? `A mensalidade do plano ${row.sub.planName} (${row.companyName}) vence hoje (${dueLabel}). Renove via Pix ou Mercado Pago na aba Assinatura.`
        : `A mensalidade do plano ${row.sub.planName} (${row.companyName}) vence em ${row.daysRemaining} dia(s) (${dueLabel}).`;

    await adminSendBillingNotification({
      userId: row.sub.userId,
      companyId: row.sub.companyId,
      title,
      message,
    });
    setNotifiedSubIds((prev) => ({ ...prev, [row.sub.id]: true }));
    setBillingFeedback(`Aviso de vencimento enviado no painel para ${row.companyName}.`);
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
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0F172A] text-white flex flex-col shrink-0 transition-transform lg:translate-x-0 lg:static ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
          <JorqLogo dark />
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-300">
            <ShieldCheck className="w-4 h-4" />
            <span>{i18n.adminNav.brandSubtitle}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400 truncate">{firebaseUser.email}</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navTabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveTab(t.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  active ? 'bg-[#1E40AF] text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t.label}</span>
                </span>
                {t.id === 'billing' && expiringAlerts.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-amber-500 text-slate-950 shrink-0">
                    {expiringAlerts.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-800 space-y-1">
          {onEnterClientMode && (
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                onEnterClientMode();
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-emerald-300 bg-emerald-950/50 border border-emerald-800/70 hover:bg-emerald-900/60 rounded-lg cursor-pointer"
            >
              <Briefcase className="w-4 h-4 shrink-0" />
              <span className="truncate">{i18n.adminNav.clientModeFree}</span>
            </button>
          )}
          {onBackToClient && (
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                onBackToClient();
              }}
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
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 text-slate-600 hover:bg-slate-100 rounded-lg shrink-0 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-display text-base sm:text-lg font-bold text-[#0F172A] truncate">
              {navTabs.find((t) => t.id === activeTab)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <LanguageSelector compact />
            <PWAInstallButton compact />
            <div className="hidden md:flex items-center gap-3 text-xs text-slate-500 font-mono tabular-nums">
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
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{i18n.adminNav.clientModeFree}</span>
                <span className="sm:hidden">Modo Cliente</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-8">
          {expiringAlerts.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-display text-sm font-bold text-amber-950">
                      Aviso de Mensalidades Prestes a Vencer ou Vencidas ({expiringAlerts.length})
                    </h2>
                    <p className="text-xs text-amber-900 mt-0.5">
                      Clientes listados abaixo vencem nos próximos 7 dias ou já estão em atraso.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('billing')}
                  className="px-3.5 py-1.5 text-xs font-semibold text-amber-950 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 shrink-0 cursor-pointer"
                >
                  Gerenciar em Assinaturas &amp; MP
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {expiringAlerts.slice(0, 6).map((item) => (
                  <div
                    key={item.sub.id}
                    className={`p-3.5 rounded-lg border bg-white flex items-center justify-between gap-3 ${
                      item.isOverdue ? 'border-red-200' : 'border-amber-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {item.clientName && item.clientName !== item.companyName
                          ? `${item.clientName} (${item.companyName})`
                          : item.companyName}{' '}
                        · {item.sub.planName}
                      </p>
                      {(item.clientEmail || item.clientPhone) && (
                        <p className="text-[11px] text-slate-500 truncate">
                          {[item.clientEmail, item.clientPhone].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-600 mt-0.5 font-mono">
                        {item.dueDateIso ? `Venc.: ${formatDateBR(item.dueDateIso, 'pt')} · ` : ''}
                        <span className={item.isOverdue ? 'text-[#DC2626] font-bold' : 'text-amber-700 font-bold'}>
                          {item.isOverdue
                            ? item.daysRemaining !== null && item.daysRemaining < 0
                              ? `Vencida há ${Math.abs(item.daysRemaining)} dia(s)`
                              : 'Mensalidade vencida'
                            : item.daysRemaining === 0
                              ? 'Vence hoje!'
                              : `Vence em ${item.daysRemaining} dia(s)`}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNotifyClientDue(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#1E40AF] bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 shrink-0 cursor-pointer"
                    >
                      <BellRing className="w-3 h-3" />
                      <span>{notifiedSubIds[item.sub.id] ? 'Avisado' : 'Avisar Cliente'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                        <ComposedChart data={metrics.growthSeries} margin={{ top: 24, right: 16, left: 4, bottom: 4 }}>
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
                          >
                            <LabelList
                              dataKey="positivas"
                              position="top"
                              formatter={(v) => (Number(v) > 0 ? String(v) : '')}
                              style={{ fontSize: 10, fill: '#15803D', fontWeight: 700 }}
                            />
                          </Bar>
                          <Bar
                            dataKey="pendentes"
                            name="Pendentes (Normal)"
                            fill={SEMANTIC_COLORS.normal}
                            radius={[4, 4, 0, 0]}
                          >
                            <LabelList
                              dataKey="pendentes"
                              position="top"
                              formatter={(v) => (Number(v) > 0 ? String(v) : '')}
                              style={{ fontSize: 10, fill: '#B45309', fontWeight: 700 }}
                            />
                          </Bar>
                          <Bar
                            dataKey="negativas"
                            name="Cancel./Inadimp. (Negativo)"
                            fill={SEMANTIC_COLORS.negative}
                            radius={[4, 4, 0, 0]}
                          >
                            <LabelList
                              dataKey="negativas"
                              position="top"
                              formatter={(v) => (Number(v) > 0 ? String(v) : '')}
                              style={{ fontSize: 10, fill: '#B91C1C', fontWeight: 700 }}
                            />
                          </Bar>
                          <Line
                            type="monotone"
                            dataKey="saldoEmpresas"
                            name="Saldo de Empresas"
                            stroke="#0F172A"
                            strokeWidth={2}
                            dot={{ r: 3.5, fill: '#0F172A' }}
                          >
                            <LabelList
                              dataKey="saldoEmpresas"
                              position="top"
                              offset={8}
                              style={{ fontSize: 10, fill: '#0F172A', fontWeight: 700 }}
                            />
                          </Line>
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
                      <BarChart data={metrics.revenueHealthBars} margin={{ top: 24, right: 12, left: 4, bottom: 4 }}>
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
                          <LabelList
                            dataKey="valor"
                            position="top"
                            formatter={(v) => formatCompactBRL(Number(v))}
                            style={{ fontSize: 11, fill: '#0F172A', fontWeight: 700 }}
                          />
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
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={metrics.statusPie}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={42}
                              outerRadius={68}
                              paddingAngle={2}
                              label={({ value, percent }) =>
                                `${value} (${Math.round((Number(percent) || 0) * 100)}%)`
                              }
                              labelLine={{ stroke: '#94A3B8', strokeWidth: 1 }}
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
              {trialFeedback && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between gap-3 text-xs text-indigo-900 font-medium">
                  <span>{trialFeedback}</span>
                  <button
                    type="button"
                    onClick={() => setTrialFeedback('')}
                    className="text-indigo-700 hover:text-indigo-950 font-semibold cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              )}

              {trialClients.length > 0 && (
                <div className="bg-white border border-indigo-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-700" />
                      <h2 className="font-display text-sm font-bold text-[#0F172A]">
                        Clientes Teste Liberados ({trialClients.length})
                      </h2>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      O acesso é bloqueado automaticamente ao fim do prazo.
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {trialClients.map((item) => {
                      const c = item.company;
                      const expired = isIsoDateExpired(c.trialExpiresAt, nowMs);
                      return (
                        <div
                          key={c.id}
                          className={`p-3.5 rounded-lg border flex flex-col justify-between gap-2.5 ${
                            expired ? 'bg-red-50/40 border-red-200' : 'bg-indigo-50/40 border-indigo-200'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold text-slate-900 truncate">{c.name}</p>
                              <span
                                className={`text-[11px] font-bold font-mono shrink-0 ${
                                  expired ? 'text-[#DC2626]' : 'text-indigo-700'
                                }`}
                              >
                                {expired ? 'Expirado' : formatTrialRemaining(c.trialExpiresAt, nowMs)}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {item.clientName} {item.clientEmail ? `· ${item.clientEmail}` : ''}
                            </p>
                            <p className="text-[11px] font-mono text-slate-600 mt-1">
                              Até: {formatDateTimeBR(c.trialExpiresAt, 'pt')}
                            </p>
                            {c.trialNote && (
                              <p className="text-[11px] text-slate-500 mt-0.5 italic truncate">
                                {c.trialNote}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => openTrialModal(item)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-indigo-800 bg-white border border-indigo-200 rounded hover:bg-indigo-50 cursor-pointer"
                            >
                              Alterar Prazo
                            </button>
                            <button
                              type="button"
                              disabled={trialBusy}
                              onClick={() => handleRevokeTrial(c)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-[#DC2626] bg-white border border-red-200 rounded hover:bg-red-50 cursor-pointer"
                            >
                              Encerrar Teste
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-bold text-[#0F172A]">
                      Lista de Clientes — Nome e Contato ({filteredClients.length})
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Todos os clientes cadastrados com responsável, empresa, e-mail, telefone/WhatsApp, plano e opção Cliente Teste.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        placeholder="Buscar nome, empresa, e-mail ou telefone..."
                        className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg w-64 focus:outline-none focus:border-[#1E40AF]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        exportToCSV(
                          `clientes-jorq-${new Date().toISOString().slice(0, 10)}.csv`,
                          ['Nome do Cliente', 'Empresa', 'E-mail', 'Telefone', 'Segmento', 'Plano', 'Status'],
                          filteredClients.map((item) => {
                            const subExpired =
                              item.latestSub?.status === 'authorized' &&
                              !isSubscriptionActiveAndValid(item.latestSub, nowMs);
                            const companyStatusLabel =
                              item.company.status === 'suspended'
                                ? 'Suspensa'
                                : item.company.status === 'trial'
                                  ? isIsoDateExpired(item.company.trialExpiresAt, nowMs)
                                    ? 'Teste Expirado'
                                    : `Cliente Teste até ${formatDateTimeBR(item.company.trialExpiresAt, 'pt')}`
                                  : 'Ativa';
                            return [
                              item.clientName,
                              item.company.name,
                              item.clientEmail || '—',
                              item.phone || '—',
                              item.company.sector || '—',
                              item.latestSub
                                ? `${item.latestSub.planName} (${translateSubscriptionStatus(subExpired ? 'overdue' : item.latestSub.status, 'pt').label})`
                                : 'Sem assinatura',
                              companyStatusLabel,
                            ];
                          })
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Exportar Contatos (CSV)</span>
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                        <th className="py-3 px-5">Cliente (Nome)</th>
                        <th className="py-3 px-5">Empresa / Segmento</th>
                        <th className="py-3 px-5">Contato (E-mail e Telefone)</th>
                        <th className="py-3 px-5">Assinatura / Status</th>
                        <th className="py-3 px-5 text-right">Controle de Acesso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredClients.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 px-5 text-center text-xs text-slate-500">
                            Nenhum cliente encontrado para a busca atual.
                          </td>
                        </tr>
                      ) : (
                        filteredClients.map((item) => {
                          const c = item.company;
                          const isTrial = c.status === 'trial';
                          const trialExpired = isTrial && isIsoDateExpired(c.trialExpiresAt, nowMs);
                          const subValid = item.latestSub
                            ? isSubscriptionActiveAndValid(item.latestSub, nowMs)
                            : false;
                          const subStatusKey = item.latestSub
                            ? item.latestSub.status === 'authorized' && !subValid
                              ? 'overdue'
                              : item.latestSub.status
                            : '';
                          return (
                            <tr key={c.id} className="hover:bg-slate-50/60">
                              <td className="py-3.5 px-5 align-top">
                                <p className="font-semibold text-slate-900">{item.clientName}</p>
                                {c.document && (
                                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">{c.document}</p>
                                )}
                              </td>
                              <td className="py-3.5 px-5 align-top">
                                <p className="font-medium text-slate-800">{c.name}</p>
                                <p className="text-xs text-slate-500">{c.sector || '—'}</p>
                              </td>
                              <td className="py-3.5 px-5 align-top space-y-1.5">
                                {item.clientEmail ? (
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <a
                                      href={`mailto:${item.clientEmail}`}
                                      className="text-[#1E40AF] hover:underline truncate max-w-[220px]"
                                    >
                                      {item.clientEmail}
                                    </a>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await navigator.clipboard.writeText(item.clientEmail);
                                          setCopiedContactId(c.id);
                                          window.setTimeout(() => setCopiedContactId(''), 2000);
                                        } catch {
                                          // ignore clipboard failure
                                        }
                                      }}
                                      title="Copiar e-mail"
                                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                    {copiedContactId === c.id && (
                                      <span className="text-[10px] font-semibold text-[#16A34A]">Copiado!</span>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400">E-mail não informado</p>
                                )}

                                {item.phone ? (
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="inline-flex items-center gap-1 text-slate-700 font-mono">
                                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                      {item.phone}
                                    </span>
                                    {item.whatsappNumber && (
                                      <a
                                        href={`https://wa.me/${item.whatsappNumber}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-[#16A34A] bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100"
                                      >
                                        <MessageCircle className="w-3 h-3" />
                                        <span>WhatsApp</span>
                                      </a>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400">Telefone não informado</p>
                                )}
                              </td>
                              <td className="py-3.5 px-5 align-top text-xs">
                                {item.latestSub ? (
                                  <div>
                                    <p className="font-semibold text-slate-800">{item.latestSub.planName}</p>
                                    <p
                                      className={`mt-0.5 font-semibold ${
                                        subStatusKey === 'authorized'
                                          ? 'text-[#16A34A]'
                                          : subStatusKey === 'pending'
                                            ? 'text-amber-700'
                                            : 'text-[#DC2626]'
                                      }`}
                                    >
                                      {translateSubscriptionStatus(subStatusKey, 'pt').label}
                                      {subStatusKey === 'overdue' && item.latestSub.nextBillingDate
                                        ? ` (${formatDateBR(item.latestSub.nextBillingDate, 'pt')})`
                                        : ''}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">Sem assinatura</span>
                                )}
                                {isTrial ? (
                                  <p
                                    className={`mt-1 font-semibold ${
                                      trialExpired ? 'text-[#DC2626]' : 'text-indigo-700'
                                    }`}
                                  >
                                    {trialExpired
                                      ? 'Cliente Teste (Expirado)'
                                      : `Cliente Teste (${formatTrialRemaining(c.trialExpiresAt, nowMs)})`}
                                  </p>
                                ) : (
                                  <p
                                    className={`mt-1 font-semibold ${
                                      c.status === 'suspended' ? 'text-[#DC2626]' : 'text-[#16A34A]'
                                    }`}
                                  >
                                    Empresa {c.status === 'suspended' ? 'Suspensa' : 'Ativa'}
                                  </p>
                                )}
                              </td>
                              <td className="py-3.5 px-5 align-top text-right">
                                <div className="inline-flex flex-wrap justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openTrialModal(item)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 cursor-pointer"
                                  >
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{isTrial ? 'Editar Teste' : 'Cliente Teste'}</span>
                                  </button>
                                  {isTrial && (
                                    <button
                                      type="button"
                                      disabled={trialBusy}
                                      onClick={() => handleRevokeTrial(c)}
                                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 cursor-pointer"
                                    >
                                      Encerrar Teste
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCompany(c)}
                                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                                      c.status === 'suspended'
                                        ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                                        : 'border-red-200 text-red-700 hover:bg-red-50'
                                    }`}
                                  >
                                    {c.status === 'suspended' ? 'Reativar' : 'Suspender'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#1E40AF]" />
                    <h2 className="font-display text-base font-bold text-[#0F172A]">
                      Usuários no Banco Real ({users.length})
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500">
                    Somente o proprietário permanece gravado no banco; logins Google de clientes ficam no LocalStorage do cliente.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                        <th className="py-3 px-5">Nome</th>
                        <th className="py-3 px-5">E-mail</th>
                        <th className="py-3 px-5">Papel</th>
                        <th className="py-3 px-5">Status</th>
                        <th className="py-3 px-5 text-right">Limpeza</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {users.map((u) => {
                        const isOwnerAccount =
                          u.email?.toLowerCase() === 'josuelroque05052020@gmail.com';
                        return (
                          <tr key={u.uid}>
                            <td className="py-3 px-5 font-medium text-slate-900">{u.name}</td>
                            <td className="py-3 px-5 text-xs text-slate-600">{u.email}</td>
                            <td className="py-3 px-5 text-xs font-semibold text-slate-700">
                              {u.role === 'admin' ? 'Proprietário / Admin' : 'Cliente (Legado)'}
                            </td>
                            <td className="py-3 px-5 text-xs text-slate-600">{u.status}</td>
                            <td className="py-3 px-5 text-right">
                              {!isOwnerAccount ? (
                                <button
                                  type="button"
                                  onClick={() => adminDeleteUserDoc(u.uid)}
                                  className="text-xs font-semibold text-[#DC2626] hover:underline cursor-pointer"
                                >
                                  Remover do Banco
                                </button>
                              ) : (
                                <span className="text-xs font-semibold text-[#16A34A]">
                                  Login Principal
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
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
                className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
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
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Validade (opcional)
                  </label>
                  <input
                    type="date"
                    value={couponExpires}
                    onChange={(e) => setCouponExpires(e.target.value)}
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
                      <th className="py-3 px-5">Validade</th>
                      <th className="py-3 px-5">Status</th>
                      <th className="py-3 px-5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {coupons.map((c) => {
                      const exhausted = Number(c.usedCount || 0) >= Number(c.maxUses || 0);
                      return (
                        <tr key={c.id}>
                          <td className="py-3 px-5 font-mono font-bold text-slate-900">{c.code}</td>
                          <td className="py-3 px-5 font-mono tabular-nums">{c.discountPercent}%</td>
                          <td className="py-3 px-5 font-mono tabular-nums">
                            <span>
                              {c.usedCount} / {c.maxUses}
                            </span>
                            {exhausted && (
                              <span className="ml-2 text-[11px] font-semibold text-[#DC2626]">
                                Esgotado
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-5 font-mono text-xs text-slate-600">
                            {c.expiresAt ? formatDateBR(c.expiresAt, 'pt') : 'Sem vencimento'}
                          </td>
                          <td className="py-3 px-5 text-xs">
                            <button
                              type="button"
                              onClick={() => adminToggleCoupon(c.id, !c.active)}
                              className={`font-semibold cursor-pointer ${
                                c.active && !exhausted ? 'text-[#16A34A]' : 'text-slate-500'
                              }`}
                            >
                              {!c.active ? 'Inativo' : exhausted ? 'Ativo (Esgotado)' : 'Ativo'}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              {billingFeedback && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
                  {billingFeedback}
                </div>
              )}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-[#0F172A]">
                    Assinaturas de Clientes ({subscriptions.length})
                  </h2>
                  {expiringAlerts.length > 0 && (
                    <span className="text-xs font-semibold text-amber-700">
                      {expiringAlerts.length} vencendo ou vencida(s)
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                        <th className="py-3 px-5">Empresa</th>
                        <th className="py-3 px-5">Plano</th>
                        <th className="py-3 px-5">Ciclo</th>
                        <th className="py-3 px-5 text-right">Valor</th>
                        <th className="py-3 px-5">Próx. Vencimento</th>
                        <th className="py-3 px-5">Status</th>
                        <th className="py-3 px-5 text-right">Ação Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {subscriptionDueRows.map((row) => {
                        const s = row.sub;
                        return (
                          <tr
                            key={s.id}
                            className={
                              row.isOverdue
                                ? 'bg-red-50/40'
                                : row.isExpiringSoon
                                  ? 'bg-amber-50/40'
                                  : ''
                            }
                          >
                            <td className="py-3 px-5 font-medium text-slate-800">
                              {row.companyName}
                            </td>
                            <td className="py-3 px-5 font-semibold text-slate-900">{s.planName}</td>
                            <td className="py-3 px-5 text-xs text-slate-600">{s.billingCycle}</td>
                            <td className="py-3 px-5 text-right font-mono tabular-nums font-semibold">
                              {formatBRL(s.totalAmount)}
                            </td>
                            <td className="py-3 px-5 text-xs font-mono">
                              <div>{row.dueDateIso ? formatDateBR(row.dueDateIso, 'pt') : '—'}</div>
                              {row.isOverdue && (
                                <span className="text-[11px] font-bold text-[#DC2626]">
                                  {row.daysRemaining !== null && row.daysRemaining < 0
                                    ? `Vencida há ${Math.abs(row.daysRemaining)}d`
                                    : 'Vencida'}
                                </span>
                              )}
                              {row.isExpiringSoon && (
                                <span className="text-[11px] font-bold text-amber-700">
                                  {row.daysRemaining === 0
                                    ? 'Vence hoje'
                                    : `Faltam ${row.daysRemaining}d`}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-5 text-xs font-semibold">
                              <span className={row.isOverdue ? 'text-[#DC2626]' : ''}>
                                {translateSubscriptionStatus(
                                  row.isOverdue && s.status === 'authorized' ? 'overdue' : s.status,
                                  'pt'
                                ).label}
                              </span>
                            </td>
                            <td className="py-3 px-5 text-right space-x-2 whitespace-nowrap">
                              {(row.isExpiringSoon || row.isOverdue) && (
                                <button
                                  type="button"
                                  onClick={() => handleNotifyClientDue(row)}
                                  className="text-xs font-semibold text-[#1E40AF] hover:underline cursor-pointer"
                                >
                                  {notifiedSubIds[s.id] ? 'Avisado' : 'Avisar'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={async () => {
                                  const nextDue =
                                    row.dueDateIso ||
                                    addMonthsToDateIso(new Date().toISOString(), s.billingCycle);
                                  await adminUpdateSubscriptionStatus(s.id, 'authorized', nextDue);
                                  try {
                                    const token = await getIdToken();
                                    await fetch('/api/admin/set-company-access', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        Authorization: `Bearer ${token}`,
                                      },
                                      body: JSON.stringify({
                                        companyId: s.companyId,
                                        subscriptionId: s.id,
                                        userId: s.userId,
                                        planId: s.planId,
                                        planName: s.planName,
                                        billingCycle: s.billingCycle,
                                        totalAmount: s.totalAmount,
                                        status: 'authorized',
                                        nextBillingDate: nextDue,
                                      }),
                                    });
                                  } catch {
                                    // ignore transient sync failure
                                  }
                                }}
                                className="text-xs font-semibold text-[#16A34A] hover:underline cursor-pointer"
                              >
                                Ativar
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await adminUpdateSubscriptionStatus(s.id, 'suspended');
                                  try {
                                    const token = await getIdToken();
                                    await fetch('/api/admin/set-company-access', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        Authorization: `Bearer ${token}`,
                                      },
                                      body: JSON.stringify({
                                        companyId: s.companyId,
                                        subscriptionId: s.id,
                                        userId: s.userId,
                                        planId: s.planId,
                                        planName: s.planName,
                                        billingCycle: s.billingCycle,
                                        totalAmount: s.totalAmount,
                                        status: 'suspended',
                                      }),
                                    });
                                  } catch {
                                    // ignore transient sync failure
                                  }
                                }}
                                className="text-xs font-semibold text-[#DC2626] hover:underline cursor-pointer"
                              >
                                Suspender
                              </button>
                            </td>
                          </tr>
                        );
                      })}
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

      {trialModalCompany && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
                  <Clock className="w-4 h-4" />
                  <span>Liberar Cliente Teste (Gratuito por Tempo Determinado)</span>
                </div>
                <h2 className="mt-1 font-display text-lg font-bold text-[#0F172A]">
                  {trialModalCompany.company.name}
                </h2>
                <p className="text-xs text-slate-500">
                  {trialModalCompany.clientName}
                  {trialModalCompany.clientEmail ? ` · ${trialModalCompany.clientEmail}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTrialModalCompany(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTrial} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Escolha o Prazo do Teste Gratuito
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { id: '1h', label: '1 hora' },
                      { id: '1d', label: '1 dia' },
                      { id: '3d', label: '3 dias' },
                      { id: '7d', label: '7 dias' },
                      { id: '15d', label: '15 dias' },
                      { id: '30d', label: '30 dias' },
                      { id: 'custom', label: 'Personalizado' },
                      { id: 'exact', label: 'Data/Hora' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTrialPresetKey(opt.id)}
                      className={`px-2.5 py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
                        trialPresetKey === opt.id
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {trialPresetKey === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="3650"
                      required
                      value={trialCustomAmount}
                      onChange={(e) => setTrialCustomAmount(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Unidade
                    </label>
                    <select
                      value={trialCustomUnit}
                      onChange={(e) => setTrialCustomUnit(e.target.value as 'hours' | 'days')}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="hours">Hora(s)</option>
                      <option value="days">Dia(s)</option>
                    </select>
                  </div>
                </div>
              )}

              {trialPresetKey === 'exact' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data e Hora de Expiração
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={trialExactDatetime}
                    onChange={(e) => setTrialExactDatetime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observação interna (opcional)
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={trialNote}
                  onChange={(e) => setTrialNote(e.target.value)}
                  placeholder="Ex.: Demonstração comercial 7 dias"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                {(() => {
                  const previewIso = computeTrialExpiresIso();
                  return previewIso
                    ? `O acesso completo será liberado gratuitamente até ${formatDateTimeBR(previewIso, 'pt')} e bloqueado automaticamente depois.`
                    : 'Informe uma data e hora futura válida para visualizar o vencimento.';
                })()}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTrialModalCompany(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={trialBusy}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                >
                  {trialBusy ? 'Salvando...' : 'Liberar Acesso Teste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
