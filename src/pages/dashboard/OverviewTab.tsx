import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
  LabelList,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, AlertTriangle, CheckCircle2, Clock, HelpCircle } from 'lucide-react';
import {
  formatBRL,
  formatCompactBRL,
  formatDateBR,
  formatDateTimeBR,
  formatTrialRemaining,
  isIsoDateExpired,
  isSubscriptionActiveAndValid,
  translateSubscriptionStatus,
} from '../../utils/format';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  SEMANTIC_COLORS,
  SemanticChartLegend,
  getSemanticStatus,
} from '../../components/SemanticChartLegend';
import type {
  Company,
  Expense,
  LedgerTransaction,
  Revenue,
  Subscription,
} from '../../types';

interface OverviewTabProps {
  company: Company;
  monthlyGoal?: number;
  revenues: Revenue[];
  expenses: Expense[];
  transactions: LedgerTransaction[];
  activeSubscription: Subscription | null;
  serverAccessVerified: boolean;
  isOwnerFreeMode?: boolean;
  onGoToTab: (tab: string) => void;
}

const EXPENSE_SLICE_COLORS = [
  '#DC2626',
  '#EAB308',
  '#16A34A',
  '#0F172A',
  '#64748B',
  '#94A3B8',
];

export function OverviewTab({
  company,
  monthlyGoal,
  revenues,
  expenses,
  transactions,
  activeSubscription,
  serverAccessVerified,
  isOwnerFreeMode = false,
  onGoToTab,
}: OverviewTabProps) {
  const { lang, pick } = useLanguage();
  const stats = useMemo(() => {
    const totalRev = revenues.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const totalExp = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const receivedRev = revenues
      .filter((r) => r.status === 'received')
      .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const paidExp = expenses
      .filter((e) => e.status === 'paid')
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

    const netProfit = totalRev - totalExp;
    const cashBalance = receivedRev - paidExp;
    const margin = totalRev > 0 ? (netProfit / totalRev) * 100 : 0;

    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const monthRevenue = revenues
      .filter((r) => (r.date || '').startsWith(currentMonthKey))
      .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

    const goal = Number(monthlyGoal ?? company.monthlyGoal) || 0;
    const goalPercent = goal > 0 ? Math.min(100, (monthRevenue / goal) * 100) : 0;

    return {
      totalRev,
      totalExp,
      netProfit,
      cashBalance,
      margin,
      monthRevenue,
      goal,
      goalPercent,
    };
  }, [revenues, expenses, monthlyGoal, company.monthlyGoal]);

  // Build monthly chart data with semaphoric status per month
  const monthlyData = useMemo(() => {
    const map = new Map<
      string,
      {
        month: string;
        receitas: number;
        despesas: number;
        lucro: number;
        margem: number;
        statusColor: string;
        statusLabel: string;
      }
    >();
    const addEntry = (dateStr: string, type: 'rev' | 'exp', amount: number) => {
      const key = (dateStr || new Date().toISOString()).slice(0, 7);
      const [y, m] = key.split('-');
      const label = m && y ? `${m}/${y.slice(2)}` : key;
      const cur = map.get(key) || {
        month: label,
        receitas: 0,
        despesas: 0,
        lucro: 0,
        margem: 0,
        statusColor: SEMANTIC_COLORS.normal,
        statusLabel: 'Normal',
      };
      if (type === 'rev') cur.receitas += amount;
      else cur.despesas += amount;
      cur.lucro = cur.receitas - cur.despesas;
      cur.margem = cur.receitas > 0 ? (cur.lucro / cur.receitas) * 100 : cur.lucro < 0 ? -100 : 0;
      const semantic = getSemanticStatus(cur.lucro, cur.margem, lang);
      cur.statusColor = semantic.color;
      cur.statusLabel = semantic.label;
      map.set(key, cur);
    };

    revenues.forEach((r) => addEntry(r.date, 'rev', Number(r.amount) || 0));
    expenses.forEach((e) => addEntry(e.date, 'exp', Number(e.amount) || 0));

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, v]) => v);
  }, [revenues, expenses, lang]);

  // Expense breakdown by category
  const expenseCategories = useMemo(() => {
    const catMap = new Map<string, number>();
    expenses.forEach((e) => {
      const cat = e.category || pick({ pt: 'Outros', en: 'Other', es: 'Otros', fr: 'Autres' });
      catMap.set(cat, (catMap.get(cat) || 0) + (Number(e.amount) || 0));
    });
    return Array.from(catMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [expenses, pick]);

  const profitSemantic = getSemanticStatus(stats.netProfit, stats.margin, lang);
  const cashSemantic = getSemanticStatus(stats.cashBalance, undefined, lang);
  const goalBarColor =
    stats.goalPercent >= 90
      ? SEMANTIC_COLORS.positive
      : stats.goalPercent >= 50
      ? SEMANTIC_COLORS.normal
      : SEMANTIC_COLORS.negative;
  const goalStatusText =
    stats.goal <= 0
      ? pick({ pt: 'Meta não definida', en: 'Goal not set', es: 'Meta no definida', fr: 'Objectif non défini' })
      : stats.goalPercent >= 90
      ? pick({ pt: 'Positivo · Meta próxima ou superada', en: 'Positive · Goal near or exceeded', es: 'Positivo · Meta cercana o superada', fr: 'Positif · Objectif proche ou dépassé' })
      : stats.goalPercent >= 50
      ? pick({ pt: 'Normal · Ritmo regular no mês', en: 'Normal · Steady monthly pace', es: 'Normal · Ritmo regular en el mes', fr: 'Normal · Rythme mensuel régulier' })
      : pick({ pt: 'Atenção · Abaixo de 50% da meta', en: 'Attention · Below 50% of goal', es: 'Atención · Por debajo del 50% de la meta', fr: 'Attention · Sous les 50% de l’objectif' });

  const isTrialValid =
    !isOwnerFreeMode &&
    company.status === 'trial' &&
    Boolean(company.trialExpiresAt) &&
    !isIsoDateExpired(company.trialExpiresAt);
  const effectiveSubValid = activeSubscription
    ? isSubscriptionActiveAndValid(activeSubscription)
    : false;
  const effectiveSubStatus = activeSubscription
    ? activeSubscription.status === 'authorized' && !effectiveSubValid
      ? 'overdue'
      : activeSubscription.status
    : null;
  const subStatus = effectiveSubStatus
    ? translateSubscriptionStatus(effectiveSubStatus, lang)
    : null;

  return (
    <div className="space-y-8">
      {/* Subscription & Verification Banner */}
      {isOwnerFreeMode ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-950">
                {pick({
                  pt: 'Modo Cliente do Proprietário · Acesso Total Gratuito',
                  en: 'Owner Client Mode · Full Free Access',
                  es: 'Modo Cliente del Propietario · Acceso Total Gratis',
                  fr: 'Mode Client Propriétaire · Accès Total Gratuit',
                })}
              </p>
              <p className="mt-0.5 text-xs text-emerald-800">
                {pick({
                  pt: 'Você está utilizando todos os recursos do JORQ sem cobrança ou assinatura ativa como proprietário da plataforma.',
                  en: 'You are using all JORQ features with no charges or active subscription as the platform owner.',
                  es: 'Está utilizando todas las funciones de JORQ sin cobros ni suscripción activa como propietario.',
                  fr: 'Vous utilisez toutes les fonctionnalités JORQ sans frais en tant que propriétaire.',
                })}
              </p>
            </div>
          </div>
        </div>
      ) : isTrialValid ? (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-indigo-950">
                {pick({
                  pt: `Modo Cliente Teste · Tempo restante: ${formatTrialRemaining(company.trialExpiresAt)}`,
                  en: `Test Client Mode · Remaining: ${formatTrialRemaining(company.trialExpiresAt)}`,
                  es: `Modo Cliente de Prueba · Tiempo restante: ${formatTrialRemaining(company.trialExpiresAt)}`,
                  fr: `Mode Client Test · Temps restant : ${formatTrialRemaining(company.trialExpiresAt)}`,
                })}
              </p>
              <p className="mt-0.5 text-xs text-indigo-800">
                {pick({
                  pt: `Acesso gratuito de teste válido até ${formatDateTimeBR(company.trialExpiresAt, lang)}.`,
                  en: `Free test access valid until ${formatDateTimeBR(company.trialExpiresAt, lang)}.`,
                  es: `Acceso de prueba gratuito válido hasta ${formatDateTimeBR(company.trialExpiresAt, lang)}.`,
                  fr: `Accès test gratuit valable jusqu'au ${formatDateTimeBR(company.trialExpiresAt, lang)}.`,
                })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onGoToTab('subscription')}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] whitespace-nowrap shrink-0 cursor-pointer"
          >
            {pick({ pt: 'Assinar Plano', en: 'Choose Plan', es: 'Elegir Plan', fr: 'Choisir une Offre' })}
          </button>
        </div>
      ) : company.status === 'suspended' ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-900">
                {pick({
                  pt: 'Acesso da empresa suspenso',
                  en: 'Company access suspended',
                  es: 'Acceso de la empresa suspendido',
                  fr: 'Accès entreprise suspendu',
                })}
              </p>
              <p className="mt-1 text-xs text-red-700">
                {pick({
                  pt: 'Regularize sua assinatura ou entre em contato com o suporte para reativar os recursos.',
                  en: 'Update your subscription or contact support to reactivate features.',
                  es: 'Regularice su suscripción o contacte a soporte para reactivar las funciones.',
                  fr: 'Régularisez votre abonnement ou contactez le support pour réactiver les fonctions.',
                })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onGoToTab('subscription')}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#DC2626] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            {pick({ pt: 'Ver Assinatura', en: 'View Plan', es: 'Ver Suscripción', fr: 'Voir Abonnement' })}
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            {effectiveSubValid || (serverAccessVerified && effectiveSubStatus !== 'overdue') ? (
              <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" />
            ) : (
              <HelpCircle className="w-5 h-5 text-[#1E40AF] shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {activeSubscription
                  ? `${pick({ pt: 'Plano', en: 'Plan', es: 'Plan', fr: 'Formule' })} ${activeSubscription.planName} · Status: ${subStatus?.label}`
                  : pick({
                      pt: 'Nenhum plano recorrente contratado ainda',
                      en: 'No recurring plan subscribed yet',
                      es: 'Aún no hay un plan recurrente contratado',
                      fr: 'Aucun abonnement récurrent souscrit',
                    })}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {activeSubscription
                  ? pick({
                      pt: 'A liberação do plano é confirmada exclusivamente após verificação no servidor junto ao Mercado Pago.',
                      en: 'Plan activation is confirmed exclusively after server-side Mercado Pago verification.',
                      es: 'La activación del plan se confirma exclusivamente tras la verificación en servidor con Mercado Pago.',
                      fr: 'L’activation est confirmée uniquement après vérification serveur auprès de Mercado Pago.',
                    })
                  : pick({
                      pt: 'Escolha um plano na aba Assinatura para habilitar cobrança recorrente via Mercado Pago.',
                      en: 'Choose a plan in the Subscription tab to enable recurring billing via Mercado Pago.',
                      es: 'Elija un plan en la pestaña Suscripción para habilitar cobros vía Mercado Pago.',
                      fr: 'Choisissez une formule dans Abonnement pour activer la facturation Mercado Pago.',
                    })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onGoToTab('subscription')}
            className="px-4 py-2 text-xs font-semibold text-[#1E40AF] border border-blue-200 bg-blue-50/50 rounded-lg hover:bg-blue-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {activeSubscription
              ? pick({ pt: 'Gerenciar Assinatura', en: 'Manage Plan', es: 'Gestionar Plan', fr: 'Gérer l’Abonnement' })
              : pick({ pt: 'Escolher Plano', en: 'Choose Plan', es: 'Elegir Plan', fr: 'Choisir une Formule' })}
          </button>
        </div>
      )}

      {/* Primary KPI Grid with Plain-Language Explanations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {pick({ pt: 'Receitas Totais', en: 'Total Revenues', es: 'Ingresos Totales', fr: 'Revenus Totaux' })}
            </span>
            <ArrowUpRight className="w-4 h-4 text-[#16A34A]" />
          </div>
          <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-[#16A34A]">
            {formatBRL(stats.totalRev)}
          </p>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            {pick({
              pt: 'Soma de todas as vendas e entradas registradas para sua empresa.',
              en: 'Sum of all sales and inflows recorded for your company.',
              es: 'Suma de todas las ventas y entradas registradas para su empresa.',
              fr: 'Somme de toutes les ventes et entrées enregistrées pour votre entreprise.',
            })}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {pick({ pt: 'Despesas Totais', en: 'Total Expenses', es: 'Gastos Totales', fr: 'Dépenses Totales' })}
            </span>
            <ArrowDownRight className="w-4 h-4 text-[#DC2626]" />
          </div>
          <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-[#DC2626]">
            {formatBRL(stats.totalExp)}
          </p>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            {pick({
              pt: 'Total de gastos fixos, variáveis e compras lançadas no sistema.',
              en: 'Total fixed, variable expenses and purchases recorded.',
              es: 'Total de gastos fijos, variables y compras registradas.',
              fr: 'Total des frais fixes, variables et achats enregistrés.',
            })}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {stats.netProfit >= 0
                ? pick({ pt: 'Lucro Líquido', en: 'Net Profit', es: 'Beneficio Neto', fr: 'Bénéfice Net' })
                : pick({ pt: 'Prejuízo Líquido', en: 'Net Loss', es: 'Pérdida Neta', fr: 'Perte Nette' })}
            </span>
            <span className={`text-xs font-semibold ${profitSemantic.textClass}`}>
              {profitSemantic.label}
            </span>
          </div>
          <p className={`mt-2 font-mono tabular-nums text-2xl font-bold ${profitSemantic.textClass}`}>
            {formatBRL(stats.netProfit)}
          </p>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            {pick({ pt: 'Margem de', en: 'Margin of', es: 'Margen del', fr: 'Marge de' })}{' '}
            <strong className="font-mono tabular-nums text-slate-700">
              {stats.margin.toFixed(1)}%
            </strong>{' '}
            —{' '}
            {pick({
              pt: 'quanto sobra após pagar todos os custos.',
              en: 'what remains after paying all costs.',
              es: 'lo que queda tras pagar todos los costos.',
              fr: 'ce qui reste après paiement des charges.',
            })}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {pick({ pt: 'Saldo em Caixa', en: 'Cash Balance', es: 'Saldo en Caja', fr: 'Solde de Trésorerie' })}
            </span>
            <span className={`text-xs font-semibold ${cashSemantic.textClass}`}>
              {cashSemantic.label}
            </span>
          </div>
          <p className={`mt-2 font-mono tabular-nums text-2xl font-bold ${cashSemantic.textClass}`}>
            {formatBRL(stats.cashBalance)}
          </p>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            {pick({
              pt: 'Diferença real entre valores já recebidos e contas já pagas.',
              en: 'Real difference between received amounts and paid bills.',
              es: 'Diferencia real entre cobros recibidos y cuentas pagadas.',
              fr: 'Différence réelle entre encaissements reçus et factures payées.',
            })}
          </p>
        </div>
      </div>

      {/* Monthly Goal Tracker */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-[#0F172A]">
              {pick({
                pt: 'Acompanhamento da Meta Mensal de Receita',
                en: 'Monthly Revenue Goal Tracker',
                es: 'Seguimiento de la Meta Mensual de Ingresos',
                fr: 'Suivi de l’Objectif Mensuel de Revenus',
              })}
            </h2>
            <p className="text-xs text-slate-500">
              {goalStatusText} ·{' '}
              {pick({
                pt: 'Compara o faturamento do mês com a meta configurada.',
                en: 'Compares monthly revenue against your configured target.',
                es: 'Compara la facturación del mes con la meta configurada.',
                fr: 'Compare le chiffre d’affaires mensuel à l’objectif fixé.',
              })}
            </p>
          </div>
          <div className="font-mono tabular-nums text-sm font-semibold text-[#0F172A]">
            {formatBRL(stats.monthRevenue)} / {formatBRL(stats.goal)} (
            {stats.goalPercent.toFixed(0)}%)
          </div>
        </div>
        <div className="mt-4 w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${stats.goalPercent}%`, backgroundColor: goalBarColor }}
          />
        </div>
      </div>

      {/* Executive Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 1. Receitas (Verde) vs Despesas (Vermelho) + Linha Resultado (Amarelo/Normal referência) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#0F172A]">
                {pick({
                  pt: 'Fluxo Mensal: Entradas, Saídas e Resultado',
                  en: 'Monthly Flow: Inflows, Outflows & Net Result',
                  es: 'Flujo Mensual: Entradas, Salidas y Resultado',
                  fr: 'Flux Mensuel : Entrées, Sorties & Résultat',
                })}
              </h2>
              <p className="text-xs text-slate-500">
                {pick({
                  pt: 'Verde indica receitas positivas, vermelho indica despesas e a linha acompanha o saldo líquido.',
                  en: 'Green shows positive revenue, red shows expenses, and the line tracks net profit.',
                  es: 'Verde indica ingresos positivos, rojo gastos y la línea sigue el saldo neto.',
                  fr: 'Vert indique les revenus, rouge les dépenses et la ligne suit le solde net.',
                })}
              </p>
            </div>
          </div>
          <div className="mb-4">
            <SemanticChartLegend
              items={[
                { label: pick({ pt: 'Receitas (Positivo)', en: 'Revenues (Positive)', es: 'Ingresos (Positivo)', fr: 'Revenus (Positif)' }), color: SEMANTIC_COLORS.positive },
                { label: pick({ pt: 'Despesas (Saídas)', en: 'Expenses (Outflows)', es: 'Gastos (Salidas)', fr: 'Dépenses (Sorties)' }), color: SEMANTIC_COLORS.negative },
                { label: pick({ pt: 'Linha de Lucro / Equilíbrio', en: 'Profit / Balance Line', es: 'Línea de Beneficio / Equilibrio', fr: 'Ligne Résultat / Équilibre' }), color: SEMANTIC_COLORS.normal },
              ]}
            />
          </div>

          {monthlyData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-lg p-6">
              <p className="text-sm font-semibold text-slate-700">
                {pick({
                  pt: 'Ainda não há lançamentos financeiros registrados',
                  en: 'No financial entries recorded yet',
                  es: 'Aún no hay movimientos financieros registrados',
                  fr: 'Aucune écriture financière enregistrée',
                })}
              </p>
              <p className="mt-1 text-xs text-slate-500 max-w-sm">
                {pick({
                  pt: 'Adicione sua primeira receita ou despesa na aba Gestão Financeira para gerar os gráficos automáticos.',
                  en: 'Add your first revenue or expense under Financial Management to generate automatic charts.',
                  es: 'Agregue su primer ingreso o gasto en Gestión Financiera para generar los gráficos.',
                  fr: 'Ajoutez votre premier revenu ou dépense dans Gestion Financière pour générer les graphiques.',
                })}
              </p>
              <button
                type="button"
                onClick={() => onGoToTab('finance')}
                className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg cursor-pointer"
              >
                {pick({
                  pt: 'Lançar Primeiro Movimento',
                  en: 'Add First Entry',
                  es: 'Registrar Primer Movimiento',
                  fr: 'Ajouter la Première Écriture',
                })}
              </button>
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData} margin={{ top: 24, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                  <ReferenceLine y={0} stroke="#CBD5E1" strokeWidth={1.5} />
                  <Tooltip
                    formatter={(value, name) => [formatBRL(Number(value)), String(name)]}
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                      backgroundColor: '#FFFFFF',
                    }}
                  />
                  <Bar
                    dataKey="receitas"
                    name={pick({ pt: 'Receitas', en: 'Revenues', es: 'Ingresos', fr: 'Revenus' })}
                    fill={SEMANTIC_COLORS.positive}
                    radius={[4, 4, 0, 0]}
                  >
                    <LabelList
                      dataKey="receitas"
                      position="top"
                      formatter={(v) => (Number(v) > 0 ? formatCompactBRL(Number(v)) : '')}
                      style={{ fontSize: 10, fill: '#15803D', fontWeight: 600 }}
                    />
                  </Bar>
                  <Bar
                    dataKey="despesas"
                    name={pick({ pt: 'Despesas', en: 'Expenses', es: 'Gastos', fr: 'Dépenses' })}
                    fill={SEMANTIC_COLORS.negative}
                    radius={[4, 4, 0, 0]}
                  >
                    <LabelList
                      dataKey="despesas"
                      position="top"
                      formatter={(v) => (Number(v) > 0 ? formatCompactBRL(Number(v)) : '')}
                      style={{ fontSize: 10, fill: '#B91C1C', fontWeight: 600 }}
                    />
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="lucro"
                    name={pick({ pt: 'Resultado Líquido', en: 'Net Result', es: 'Resultado Neto', fr: 'Résultat Net' })}
                    stroke={SEMANTIC_COLORS.normal}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: SEMANTIC_COLORS.normal, strokeWidth: 2, stroke: '#FFFFFF' }}
                    activeDot={{ r: 6 }}
                  >
                    <LabelList
                      dataKey="lucro"
                      position="top"
                      offset={8}
                      formatter={(v) => formatCompactBRL(Number(v))}
                      style={{ fontSize: 10, fill: '#B45309', fontWeight: 700 }}
                    />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 2. Termômetro Semafórico de Lucro Mensal */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <div className="mb-3">
            <h2 className="font-display text-base font-bold text-[#0F172A]">
              {pick({
                pt: 'Termômetro de Resultado por Mês',
                en: 'Monthly Result Thermometer',
                es: 'Termómetro de Resultado Mensual',
                fr: 'Thermomètre de Résultat Mensuel',
              })}
            </h2>
            <p className="text-xs text-slate-500">
              {pick({
                pt: 'Classificação automática: positivo (margem ≥ 10%), normal (0% a 10%) ou negativo (prejuízo).',
                en: 'Automatic rating: positive (margin ≥ 10%), normal (0% to 10%), or negative (loss).',
                es: 'Clasificación automática: positivo (margen ≥ 10%), normal (0% a 10%) o negativo (pérdida).',
                fr: 'Classement automatique : positif (marge ≥ 10 %), normal (0 % à 10 %) ou négatif (perte).',
              })}
            </p>
          </div>
          <div className="mb-4">
            <SemanticChartLegend
              items={[
                { label: pick({ pt: 'Positivo', en: 'Positive', es: 'Positivo', fr: 'Positif' }), color: SEMANTIC_COLORS.positive },
                { label: pick({ pt: 'Normal', en: 'Normal', es: 'Normal', fr: 'Normal' }), color: SEMANTIC_COLORS.normal },
                { label: pick({ pt: 'Negativo', en: 'Negative', es: 'Negativo', fr: 'Négatif' }), color: SEMANTIC_COLORS.negative },
              ]}
            />
          </div>

          {monthlyData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg p-6 text-center">
              {pick({
                pt: 'Registre receitas e despesas para visualizar o termômetro mensal.',
                en: 'Record revenues and expenses to view the monthly thermometer.',
                es: 'Registre ingresos y gastos para ver el termómetro mensual.',
                fr: 'Enregistrez des revenus et dépenses pour voir le thermomètre mensuel.',
              })}
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 24, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                  <ReferenceLine y={0} stroke="#64748B" strokeDasharray="3 3" />
                  <Tooltip
                    formatter={(value, _name, item) => [
                      `${formatBRL(Number(value))} (${item?.payload?.statusLabel || ''})`,
                      pick({ pt: 'Resultado', en: 'Result', es: 'Resultado', fr: 'Résultat' }),
                    ]}
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="lucro"
                    name={pick({ pt: 'Resultado Líquido', en: 'Net Result', es: 'Resultado Neto', fr: 'Résultat Net' })}
                    radius={[4, 4, 4, 4]}
                  >
                    <LabelList
                      dataKey="lucro"
                      position="top"
                      formatter={(v) => formatCompactBRL(Number(v))}
                      style={{ fontSize: 10, fill: '#0F172A', fontWeight: 700 }}
                    />
                    {monthlyData.map((entry) => (
                      <Cell key={entry.month} fill={entry.statusColor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Expense Distribution + Health Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-base font-bold text-[#0F172A]">
            {pick({
              pt: 'Distribuição de Despesas por Categoria',
              en: 'Expense Breakdown by Category',
              es: 'Distribución de Gastos por Categoría',
              fr: 'Répartition des Dépenses par Catégorie',
            })}
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            {pick({
              pt: 'Categorias que mais consomem recursos do seu caixa.',
              en: 'Categories consuming the largest share of your cash.',
              es: 'Categorías que más consumen recursos de su caja.',
              fr: 'Catégories consommant le plus de ressources de trésorerie.',
            })}
          </p>

          {expenseCategories.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg p-6 text-center">
              {pick({
                pt: 'Cadastre despesas para visualizar a distribuição por categoria.',
                en: 'Record expenses to see the category breakdown.',
                es: 'Registre gastos para ver la distribución por categoría.',
                fr: 'Enregistrez des dépenses pour voir la répartition par catégorie.',
              })}
            </div>
          ) : (
            <div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseCategories}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={66}
                      paddingAngle={2}
                      label={({ value, percent }) =>
                        `${formatCompactBRL(Number(value || 0))} (${Math.round((Number(percent) || 0) * 100)}%)`
                      }
                      labelLine={{ stroke: '#94A3B8', strokeWidth: 1 }}
                    >
                      {expenseCategories.map((entry, idx) => (
                        <Cell
                          key={entry.name}
                          fill={EXPENSE_SLICE_COLORS[idx % EXPENSE_SLICE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val) => formatBRL(Number(val))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-1.5">
                {expenseCategories.map((cat, idx) => (
                  <div key={cat.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-600 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{
                          backgroundColor:
                            EXPENSE_SLICE_COLORS[idx % EXPENSE_SLICE_COLORS.length],
                        }}
                      />
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {formatBRL(cat.value)}
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
              {pick({
                pt: 'Leitura Rápida dos Indicadores Semafóricos',
                en: 'Quick Guide to Traffic-Light Indicators',
                es: 'Lectura Rápida de los Indicadores Semafóricos',
                fr: 'Lecture Rapide des Indicateurs Visuels',
              })}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {pick({
                pt: 'Entenda em segundos o significado de cada cor nos gráficos da sua empresa.',
                en: 'Understand in seconds what each color means across your company charts.',
                es: 'Comprenda en segundos el significado de cada color en los gráficos de su empresa.',
                fr: 'Comprenez en quelques secondes la signification de chaque couleur dans vos graphiques.',
              })}
            </p>
          </div>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-4">
              <p className="text-xs font-bold text-[#16A34A]">
                {pick({
                  pt: 'Verde · Positivo',
                  en: 'Green · Positive',
                  es: 'Verde · Positivo',
                  fr: 'Vert · Positif',
                })}
              </p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                {pick({
                  pt: 'Receitas acima dos custos com margem líquida igual ou superior a 10% ou meta atingida.',
                  en: 'Revenues above costs with a net margin of 10%+ or monthly goal achieved.',
                  es: 'Ingresos superiores a los costos con margen neto igual o mayor al 10% o meta cumplida.',
                  fr: 'Revenus supérieurs aux coûts avec marge nette ≥ 10 % ou objectif atteint.',
                })}
              </p>
            </div>
            <div className="border border-amber-200 bg-amber-50/60 rounded-lg p-4">
              <p className="text-xs font-bold text-[#B45309]">
                {pick({
                  pt: 'Amarelo · Normal',
                  en: 'Yellow · Normal',
                  es: 'Amarillo · Normal',
                  fr: 'Jaune · Normal',
                })}
              </p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                {pick({
                  pt: 'Equilíbrio financeiro (margem entre 0% e 10%), ritmo regular ou valores em aberto.',
                  en: 'Break-even range (0% to 10% margin), steady pace, or pending receivables.',
                  es: 'Equilibrio financiero (margen entre 0% y 10%), ritmo regular o valores pendientes.',
                  fr: 'Équilibre financier (marge entre 0 % et 10 %), rythme régulier ou montants en attente.',
                })}
              </p>
            </div>
            <div className="border border-red-200 bg-red-50/50 rounded-lg p-4">
              <p className="text-xs font-bold text-[#DC2626]">
                {pick({
                  pt: 'Vermelho · Negativo',
                  en: 'Red · Negative',
                  es: 'Rojo · Negativo',
                  fr: 'Rouge · Négatif',
                })}
              </p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                {pick({
                  pt: 'Despesas maiores que receitas (prejuízo no mês) ou ritmo abaixo do mínimo esperado.',
                  en: 'Expenses exceed revenues (monthly loss) or performance below target threshold.',
                  es: 'Gastos mayores que ingresos (pérdida en el mes) o ritmo por debajo de lo esperado.',
                  fr: 'Dépenses supérieures aux revenus (perte mensuelle) ou rythme insuffisant.',
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Cash Flow Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-[#0F172A]">
              {pick({
                pt: 'Últimas Movimentações do Fluxo de Caixa',
                en: 'Latest Cash Flow Movements',
                es: 'Últimos Movimientos del Flujo de Caja',
                fr: 'Derniers Mouvements de Trésorerie',
              })}
            </h2>
            <p className="text-xs text-slate-500">
              {pick({
                pt: 'Resumo cronológico das entradas e saídas recentes.',
                en: 'Chronological summary of recent inflows and outflows.',
                es: 'Resumen cronológico de las entradas y salidas recientes.',
                fr: 'Résumé chronologique des entrées et sorties récentes.',
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onGoToTab('finance')}
            className="text-xs font-semibold text-[#1E40AF] hover:underline cursor-pointer"
          >
            {pick({ pt: 'Ver tudo', en: 'View all', es: 'Ver todo', fr: 'Tout voir' })}
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {pick({
              pt: 'Nenhuma movimentação encontrada.',
              en: 'No transactions found.',
              es: 'No se encontraron movimientos.',
              fr: 'Aucun mouvement trouvé.',
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-6">{pick({ pt: 'Data', en: 'Date', es: 'Fecha', fr: 'Date' })}</th>
                  <th className="py-3 px-6">{pick({ pt: 'Descrição', en: 'Description', es: 'Descripción', fr: 'Description' })}</th>
                  <th className="py-3 px-6">{pick({ pt: 'Categoria', en: 'Category', es: 'Categoría', fr: 'Catégorie' })}</th>
                  <th className="py-3 px-6">{pick({ pt: 'Situação', en: 'Status', es: 'Estado', fr: 'Statut' })}</th>
                  <th className="py-3 px-6 text-right">{pick({ pt: 'Valor', en: 'Amount', es: 'Valor', fr: 'Montant' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {transactions.slice(0, 6).map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-6 font-mono tabular-nums text-xs text-slate-500">
                      {formatDateBR(t.date, lang)}
                    </td>
                    <td className="py-3 px-6 font-medium text-slate-900">{t.description}</td>
                    <td className="py-3 px-6 text-xs text-slate-600">{t.category}</td>
                    <td className="py-3 px-6 text-xs font-medium text-slate-700">
                      {t.status === 'settled'
                        ? pick({ pt: 'Liquidado', en: 'Settled', es: 'Liquidado', fr: 'Réglé' })
                        : pick({ pt: 'Pendente', en: 'Pending', es: 'Pendiente', fr: 'En attente' })}
                    </td>
                    <td
                      className={`py-3 px-6 text-right font-mono tabular-nums font-semibold ${
                        t.type === 'income' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                      }`}
                    >
                      {t.type === 'income' ? '+' : '-'} {formatBRL(t.amount)}
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
