import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  RefreshCw,
  Upload,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  attachMpCheckoutToSubscription,
  createPendingSubscriptionRecord,
  markNotificationRead,
  markSubscriptionCancelledClient,
  updateCompanySettings,
  uploadCompanyLogo,
  type AppNotification,
  type Company,
  type PaymentRecord,
  type Plan,
  type Subscription,
} from '../../services/firestoreService';
import {
  BILLING_CYCLES,
  calculatePlanPrice,
  formatBRL,
  formatDateBR,
  translateSubscriptionStatus,
} from '../../utils/format';
import type { BillingCycle } from '../../types';

interface SubscriptionSettingsTabProps {
  mode: 'subscription' | 'settings' | 'notifications';
  company: Company;
  userId: string;
  userEmail: string;
  plans: Plan[];
  subscriptions: Subscription[];
  payments: PaymentRecord[];
  notifications: AppNotification[];
  preselectedPlanId?: string;
  preselectedCycle?: BillingCycle;
  isOwnerFreeMode?: boolean;
  onSubscriptionVerified: () => void;
}

export function SubscriptionSettingsTab({
  mode,
  company,
  userId,
  userEmail,
  plans,
  subscriptions,
  payments,
  notifications,
  preselectedPlanId,
  preselectedCycle,
  isOwnerFreeMode = false,
  onSubscriptionVerified,
}: SubscriptionSettingsTabProps) {
  const { getIdToken, refreshCompany } = useAuth();

  // Subscription checkout state
  const [selectedPlanId, setSelectedPlanId] = useState(preselectedPlanId || '');
  const [cycle, setCycle] = useState<BillingCycle>(preselectedCycle || 'monthly');
  const [couponCode, setCouponCode] = useState('');
  const [mpStatusInfo, setMpStatusInfo] = useState<{
    configured: boolean;
    environment: string;
  } | null>(null);
  const [subBusy, setSubBusy] = useState(false);
  const [subMessage, setSubMessage] = useState('');
  const [subError, setSubError] = useState('');

  // Company Settings state
  const [compName, setCompName] = useState(company.name);
  const [tradeName, setTradeName] = useState(company.tradeName || '');
  const [document, setDocument] = useState(company.document || '');
  const [phone, setPhone] = useState(company.phone || '');
  const [address, setAddress] = useState(company.address || '');
  const [sector, setSector] = useState(company.sector || '');
  const [monthlyGoal, setMonthlyGoal] = useState(String(company.monthlyGoal || 0));
  const [logoUrl, setLogoUrl] = useState(company.logoUrl || '');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  useEffect(() => {
    if (!selectedPlanId && plans.length > 0) {
      setSelectedPlanId(plans[0].id);
    }
  }, [plans, selectedPlanId]);

  useEffect(() => {
    fetch('/api/mercadopago/config-status')
      .then((r) => r.json())
      .then((data) => setMpStatusInfo(data))
      .catch(() => setMpStatusInfo({ configured: false, environment: 'sandbox' }));
  }, []);

  const currentPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];
  const latestSubscription = subscriptions[0] || null;

  const handleStartCheckout = async () => {
    if (!currentPlan) return;
    setSubBusy(true);
    setSubError('');
    setSubMessage('');
    try {
      const calc = calculatePlanPrice(currentPlan, cycle, 0);
      const subId = await createPendingSubscriptionRecord({
        companyId: company.id,
        userId,
        planId: currentPlan.id,
        planName: currentPlan.name,
        billingCycle: cycle,
        discountPercent: calc.cycleDiscountPercent,
        baseMonthlyPrice: currentPlan.monthlyPrice,
        totalAmount: calc.finalTotal,
        couponCode: couponCode.trim() || undefined,
      });

      const token = await getIdToken();
      const res = await fetch('/api/mercadopago/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subscriptionId: subId,
          companyId: company.id,
          planId: currentPlan.id,
          planName: currentPlan.name,
          billingCycle: cycle,
          monthlyPrice: currentPlan.monthlyPrice,
          cycleDiscounts: {
            monthly: currentPlan.discountMonthly,
            quarterly: currentPlan.discountQuarterly,
            semiannual: currentPlan.discountSemiannual,
            annual: currentPlan.discountAnnual,
          },
          payerEmail: userEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubError(data.error || 'Erro ao iniciar assinatura no Mercado Pago.');
        return;
      }

      await attachMpCheckoutToSubscription(
        subId,
        data.preapprovalId,
        data.initPoint,
        data.mpStatus || 'pending'
      );
      setSubMessage(
        'Assinatura criada como pendente no servidor. Conclua o pagamento no link oficial do Mercado Pago e clique em "Verificar Pagamento no Servidor".'
      );
    } catch (err) {
      setSubError(err instanceof Error ? err.message : 'Falha ao iniciar assinatura.');
    } finally {
      setSubBusy(false);
    }
  };

  const handleVerifyPayment = async (sub: Subscription) => {
    if (!sub.mpPreapprovalId) {
      setSubError('Esta assinatura ainda não possui identificador do Mercado Pago.');
      return;
    }
    setSubBusy(true);
    setSubError('');
    setSubMessage('');
    try {
      const token = await getIdToken();
      const res = await fetch('/api/mercadopago/verify-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          preapprovalId: sub.mpPreapprovalId,
          subscriptionId: sub.id,
          companyId: company.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubError(data.error || 'Não foi possível validar com o Mercado Pago.');
        return;
      }
      setSubMessage(
        `Status oficial verificado no Mercado Pago: ${translateSubscriptionStatus(data.status).label} (${data.mpStatus}).`
      );
      onSubscriptionVerified();
    } catch (err) {
      setSubError(err instanceof Error ? err.message : 'Erro ao consultar Mercado Pago.');
    } finally {
      setSubBusy(false);
    }
  };

  const handleCancelSubscription = async (sub: Subscription) => {
    setSubBusy(true);
    setSubError('');
    setSubMessage('');
    try {
      if (sub.mpPreapprovalId) {
        const token = await getIdToken();
        const res = await fetch('/api/mercadopago/cancel-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            preapprovalId: sub.mpPreapprovalId,
            companyId: company.id,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          setSubError(data.error || 'Erro ao cancelar no Mercado Pago.');
          setSubBusy(false);
          return;
        }
      }
      await markSubscriptionCancelledClient(sub.id);
      setSubMessage('Assinatura cancelada com sucesso.');
      onSubscriptionVerified();
    } catch (err) {
      setSubError(err instanceof Error ? err.message : 'Erro ao cancelar assinatura.');
    } finally {
      setSubBusy(false);
    }
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setSettingsMsg('');
    try {
      const url = await uploadCompanyLogo(company.id, file);
      setLogoUrl(url);
      await updateCompanySettings(company.id, { logoUrl: url });
      await refreshCompany();
      setSettingsMsg('Logotipo atualizado com sucesso.');
    } catch (err) {
      setSettingsMsg(
        err instanceof Error
          ? `Não foi possível enviar o arquivo para o Storage: ${err.message}`
          : 'Erro ao enviar logo.'
      );
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg('');
    try {
      await updateCompanySettings(company.id, {
        name: compName,
        tradeName,
        document,
        phone,
        address,
        sector,
        logoUrl,
        monthlyGoal: Number(monthlyGoal) || 0,
      });
      await refreshCompany();
      setSettingsMsg('Dados comerciais salvos com sucesso.');
    } catch (err) {
      setSettingsMsg(err instanceof Error ? err.message : 'Erro ao salvar configurações.');
    } finally {
      setSavingSettings(false);
    }
  };

  if (mode === 'notifications') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#1E40AF]" />
            <h2 className="font-display text-base font-bold text-[#0F172A]">
              Central de Notificações
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {notifications.filter((n) => !n.read).length} não lidas
          </span>
        </div>
        {notifications.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Nenhuma notificação registrada para sua empresa.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-5 flex items-start justify-between gap-4 ${
                  n.read ? 'bg-white' : 'bg-blue-50/30'
                }`}
              >
                <div>
                  <p className="text-xs font-medium text-slate-400">{n.category}</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{n.title}</p>
                  <p className="mt-1 text-xs text-slate-600">{n.message}</p>
                </div>
                {!n.read && (
                  <button
                    type="button"
                    onClick={() => markNotificationRead(n.id)}
                    className="text-xs font-semibold text-[#1E40AF] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Marcar como lida
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (mode === 'settings') {
    return (
      <form
        onSubmit={handleSaveSettings}
        className="bg-white border border-slate-200 rounded-xl p-8 space-y-6 max-w-3xl"
      >
        <div>
          <h2 className="font-display text-lg font-bold text-[#0F172A]">
            Configurações da Empresa
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Personalize sua identidade comercial, logotipo e meta mensal de faturamento.
          </p>
        </div>

        {settingsMsg && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
            {settingsMsg}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-6 border-b border-slate-100">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo da empresa"
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-xl object-cover border border-slate-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-400">
              LOGO
            </div>
          )}
          <div className="space-y-1.5">
            <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>{uploadingLogo ? 'Enviando...' : 'Enviar Logo (Firebase Storage)'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoFileChange}
                className="hidden"
              />
            </label>
            <p className="text-xs text-slate-500">Formatos PNG, JPG ou WEBP até 2 MB.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Razão Social / Nome da Empresa *
            </label>
            <input
              type="text"
              required
              value={compName}
              onChange={(e) => setCompName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Fantasia</label>
            <input
              type="text"
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">CNPJ / CPF</label>
            <input
              type="text"
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Segmento</label>
            <input
              type="text"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Endereço</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Meta Mensal de Receita (R$)
            </label>
            <input
              type="number"
              min="0"
              step="100"
              value={monthlyGoal}
              onChange={(e) => setMonthlyGoal(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={savingSettings}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 cursor-pointer"
        >
          {savingSettings ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </form>
    );
  }

  // Subscription & Mercado Pago View
  return (
    <div className="space-y-8">
      {isOwnerFreeMode && (
        <div className="bg-white border border-emerald-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#16A34A]">
              Modo Cliente do Proprietário
            </p>
            <h3 className="mt-1 font-display text-lg font-bold text-[#0F172A]">
              Acesso Total Gratuito Vitalício Ativado
            </h3>
            <p className="mt-1 text-xs text-slate-600 max-w-2xl leading-relaxed">
              Sua conta proprietária possui liberação automática e permanente para todas as
              ferramentas do JORQ (lançamentos ilimitados, relatórios PDF/CSV e inteligência
              artificial) sem necessidade de contratação ou cobrança no Mercado Pago. A vitrine
              abaixo permanece visível apenas para conferência de como os clientes visualizam seus planos.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-slate-500">Valor da assinatura</p>
            <p className="font-mono tabular-nums text-2xl font-bold text-[#16A34A]">R$ 0,00</p>
          </div>
        </div>
      )}

      {/* Mercado Pago Server Status */}
      {mpStatusInfo && !mpStatusInfo.configured && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-xs text-amber-900">
          <strong>Mercado Pago ({mpStatusInfo.environment}):</strong> Defina a variável privada{' '}
          <code className="font-mono">MP_ACCESS_TOKEN</code> e{' '}
          <code className="font-mono">MP_WEBHOOK_SECRET</code> nas variáveis de ambiente do
          servidor Node.js (Settings &gt; Secrets ou Render) para habilitar o checkout recorrente real.
        </div>
      )}

      {subError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          {subError}
        </div>
      )}
      {subMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
          {subMessage}
        </div>
      )}

      {/* Active / Latest Subscription Card */}
      {latestSubscription && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500">Assinatura Atual</p>
              <h3 className="mt-1 font-display text-xl font-bold text-[#0F172A]">
                {latestSubscription.planName} ·{' '}
                {BILLING_CYCLES.find((c) => c.id === latestSubscription.billingCycle)?.label}
              </h3>
              <p className="mt-1 text-xs text-slate-600 font-mono tabular-nums">
                Valor: {formatBRL(latestSubscription.totalAmount)} · Status:{' '}
                <strong>{translateSubscriptionStatus(latestSubscription.status).label}</strong>
                {latestSubscription.nextBillingDate
                  ? ` · Próx. vencimento: ${formatDateBR(latestSubscription.nextBillingDate)}`
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {latestSubscription.mpInitPoint && latestSubscription.status === 'pending' && (
                <a
                  href={latestSubscription.mpInitPoint}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A]"
                >
                  <span>Pagar no Mercado Pago</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {latestSubscription.mpPreapprovalId && (
                <button
                  type="button"
                  disabled={subBusy}
                  onClick={() => handleVerifyPayment(latestSubscription)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Verificar Pagamento no Servidor</span>
                </button>
              )}
              {latestSubscription.status !== 'cancelled' && (
                <button
                  type="button"
                  disabled={subBusy}
                  onClick={() => handleCancelSubscription(latestSubscription)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#DC2626] bg-white border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancelar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plan Selection & Cycle Calculator */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div>
          <h3 className="font-display text-lg font-bold text-[#0F172A]">
            Contratar ou Alterar Plano
          </h3>
          <p className="text-xs text-slate-500">
            Descontos calculados automaticamente: Mensal (0%), Trimestral (3%), Semestral (5%) e
            Anual (8%).
          </p>
        </div>

        {plans.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum plano ativo disponível no momento. Solicite ao administrador a configuração dos
            planos.
          </p>
        ) : (
          <>
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {BILLING_CYCLES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCycle(c.id)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                    cycle === c.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {c.label} {c.defaultDiscount > 0 ? `(-${c.defaultDiscount}%)` : ''}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans
                .filter((p) => p.active)
                .map((plan) => {
                  const calc = calculatePlanPrice(plan, cycle);
                  const selected = currentPlan?.id === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`text-left p-5 rounded-xl border transition-colors cursor-pointer ${
                        selected
                          ? 'border-[#1E40AF] bg-blue-50/40'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display font-bold text-base text-[#0F172A]">
                          {plan.name}
                        </span>
                        {selected && <CheckCircle2 className="w-4 h-4 text-[#1E40AF]" />}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{plan.targetAudience}</p>
                      <p className="mt-3 font-mono tabular-nums text-2xl font-bold text-[#0F172A]">
                        {formatBRL(calc.finalTotal)}
                      </p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        {formatBRL(calc.monthlyEquivalent)}/mês · {calc.cycleDiscountPercent}% desc.
                      </p>
                    </button>
                  );
                })}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end gap-4 pt-2">
              <div className="flex-1 max-w-xs">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cupom promocional (opcional)
                </label>
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="EX: BEMVINDO10"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono uppercase"
                />
              </div>
              <button
                type="button"
                disabled={subBusy || !currentPlan}
                onClick={handleStartCheckout}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>{subBusy ? 'Gerando assinatura...' : 'Assinar com Mercado Pago'}</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Payments History */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-display text-base font-bold text-[#0F172A]">
            Histórico de Cobranças
          </h3>
        </div>
        {payments.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Nenhuma cobrança processada ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-5">Pagamento</th>
                  <th className="py-3 px-5">Método</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-5 font-mono text-xs text-slate-700">
                      {p.mpPaymentId || p.id}
                    </td>
                    <td className="py-3 px-5 text-xs text-slate-600">{p.paymentMethod || 'Mercado Pago'}</td>
                    <td className="py-3 px-5 text-xs font-semibold text-slate-800">{p.status}</td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums font-semibold">
                      {formatBRL(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
