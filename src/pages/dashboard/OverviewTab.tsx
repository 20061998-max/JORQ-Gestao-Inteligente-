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
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { formatBRL, formatDateBR, translateSubscriptionStatus } from '../../utils/format';
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
  revenues,
  expenses,
  transactions,
  activeSubscription,
  serverAccessVerified,
  isOwnerFreeMode = false,
  onGoToTab,
}: OverviewTabProps) {
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

    const goal = Number(company.monthlyGoal) || 0;
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
  }, [revenues, expenses, company.monthlyGoal]);

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
      const semantic = getSemanticStatus(cur.lucro, cur.margem);
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
  }, [revenues, expenses]);

  // Expense breakdown by category
  const expenseCategories = useMemo(() => {
    const catMap = new Map<string, number>();
    expenses.forEach((e) => {
      const cat = e.category || 'Outros';
      catMap.set(cat, (catMap.get(cat) || 0) + (Number(e.amount) || 0));
    });
    return Array.from(catMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [expenses]);

  const profitSemantic = getSemanticStatus(stats.netProfit, stats.margin);
  const cashSemantic = getSemanticStatus(stats.cashBalance);
  const goalBarColor =
    stats.goalPercent >= 90
      ? SEMANTIC_COLORS.positive
      : stats.goalPercent >= 50
      ? SEMANTIC_COLORS.normal
      : SEMANTIC_COLORS.negative;
  const goalStatusText =
    stats.goal <= 0
      ? 'Meta não definida'
      : stats.goalPercent >= 90
      ? 'Positivo · Meta próxima ou superada'
      : stats.goalPercent >= 50
      ? 'Normal · Ritmo regular no mês'
      : 'Atenção · Abaixo de 50% da meta';

  const subStatus = activeSubscription
    ? translateSubscriptionStatus(serverAccessVerified ? 'authorized' : activeSubscription.status)
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
                Modo Cliente do Proprietário · Acesso Total Gratuito
              </p>
              <p className="mt-0.5 text-xs text-emerald-800">
                Você está utilizando todos os recursos do JORQ sem cobrança ou assinatura ativa
                como proprietário da plataforma.
              </p>
            </div>
          </div>
        </div>
      ) : company.status === 'suspended' ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-900">Acesso da empresa suspenso</p>
              <p className="mt-1 text-xs text-red-700">
                Regularize sua assinatura ou entre em contato com o suporte para reativar os recursos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onGoToTab('subscription')}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#DC2626] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            Ver Assinatura
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            {serverAccessVerified || activeSubscription?.status === 'authorized' ? (
              <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" />
            ) : (
              <HelpCircle className="w-5 h-5 text-[#1E40AF] shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {activeSubscription
                  ? `Plano ${activeSubscription.planName} · Status: ${subStatus?.label}`
                  : 'Nenhum plano recorrente contratado ainda'}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {activeSubscription
                  ? 'A liberação do plano é confirmada exclusivamente após verificação no servidor junto ao Mercado Pago.'
                  : 'Escolha um plano na aba Assinatura para habilitar cobrança recorrente via Mercado Pago.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onGoToTab('subscription')}
            className="px-4 py-2 text-xs font-semibold text-[#1E40AF] border border-blue-200 bg-blue-50/50 rounded-lg hover:bg-blue-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {activeSubscription ? 'Gerenciar Assinatura' : 'Escolher Plano'}
          </button>
        </div>
      )}

      {/* Primary KPI Grid with Plain-Language Explanations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Receitas Totais</span>
            <ArrowUpRight className="w-4 h-4 text-[#16A34A]" />
          </div>
          <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-[#16A34A]">
            {formatBRL(stats.totalRev)}
          </p>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Soma de todas as vendas e entradas registradas para sua empresa.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Despesas Totais</span>
            <ArrowDownRight className="w-4 h-4 text-[#DC2626]" />
          </div>
          <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-[#DC2626]">
            {formatBRL(stats.totalExp)}
          </p>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Total de gastos fixos, variáveis e compras lançadas no sistema.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {stats.netProfit >= 0 ? 'Lucro Líquido' : 'Prejuízo Líquido'}
            </span>
            <span className={`text-xs font-semibold ${profitSemantic.textClass}`}>
              {profitSemantic.label}
            </span>
          </div>
          <p className={`mt-2 font-mono tabular-nums text-2xl font-bold ${profitSemantic.textClass}`}>
            {formatBRL(stats.netProfit)}
          </p>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Margem de{' '}
            <strong className="font-mono tabular-nums text-slate-700">
              {stats.margin.toFixed(1)}%
            </strong>{' '}
            — quanto sobra após pagar todos os custos.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Saldo em Caixa</span>
            <span className={`text-xs font-semibold ${cashSemantic.textClass}`}>
              {cashSemantic.label}
            </span>
          </div>
          <p className={`mt-2 font-mono tabular-nums text-2xl font-bold ${cashSemantic.textClass}`}>
            {formatBRL(stats.cashBalance)}
          </p>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Diferença real entre valores já recebidos e contas já pagas.
          </p>
        </div>
      </div>

      {/* Monthly Goal Tracker */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-[#0F172A]">
              Acompanhamento da Meta Mensal de Receita
            </h2>
            <p className="text-xs text-slate-500">
              {goalStatusText} · Compara o faturamento do mês com a meta configurada.
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
                Fluxo Mensal: Entradas, Saídas e Resultado
              </h2>
              <p className="text-xs text-slate-500">
                Verde indica receitas positivas, vermelho indica despesas e a linha acompanha o saldo líquido.
              </p>
            </div>
          </div>
          <div className="mb-4">
            <SemanticChartLegend
              items={[
                { label: 'Receitas (Positivo)', color: SEMANTIC_COLORS.positive },
                { label: 'Despesas (Saídas)', color: SEMANTIC_COLORS.negative },
                { label: 'Linha de Lucro / Equilíbrio', color: SEMANTIC_COLORS.normal },
              ]}
            />
          </div>

          {monthlyData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-lg p-6">
              <p className="text-sm font-semibold text-slate-700">
                Ainda não há lançamentos financeiros registrados
              </p>
              <p className="mt-1 text-xs text-slate-500 max-w-sm">
                Adicione sua primeira receita ou despesa na aba Gestão Financeira para gerar os
                gráficos automáticos.
              </p>
              <button
                type="button"
                onClick={() => onGoToTab('finance')}
                className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg cursor-pointer"
              >
                Lançar Primeiro Movimento
              </button>
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData}>
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
                    name="Receitas"
                    fill={SEMANTIC_COLORS.positive}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="despesas"
                    name="Despesas"
                    fill={SEMANTIC_COLORS.negative}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="lucro"
                    name="Resultado Líquido"
                    stroke={SEMANTIC_COLORS.normal}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: SEMANTIC_COLORS.normal, strokeWidth: 2, stroke: '#FFFFFF' }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 2. Termômetro Semafórico de Lucro Mensal */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <div className="mb-3">
            <h2 className="font-display text-base font-bold text-[#0F172A]">
              Termômetro de Resultado por Mês
            </h2>
            <p className="text-xs text-slate-500">
              Classificação automática: positivo (margem &ge; 10%), normal (0% a 10%) ou negativo (prejuízo).
            </p>
          </div>
          <div className="mb-4">
            <SemanticChartLegend
              items={[
                { label: 'Positivo', color: SEMANTIC_COLORS.positive },
                { label: 'Normal', color: SEMANTIC_COLORS.normal },
                { label: 'Negativo', color: SEMANTIC_COLORS.negative },
              ]}
            />
          </div>

          {monthlyData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg p-6 text-center">
              Registre receitas e despesas para visualizar o termômetro mensal.
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                  <ReferenceLine y={0} stroke="#64748B" strokeDasharray="3 3" />
                  <Tooltip
                    formatter={(value, _name, item) => [
                      `${formatBRL(Number(value))} (${item?.payload?.statusLabel || ''})`,
                      'Resultado',
                    ]}
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="lucro" name="Resultado Líquido" radius={[4, 4, 4, 4]}>
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
            Distribuição de Despesas por Categoria
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Categorias que mais consomem recursos do seu caixa.
          </p>

          {expenseCategories.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg p-6 text-center">
              Cadastre despesas para visualizar a distribuição por categoria.
            </div>
          ) : (
            <div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseCategories}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={44}
                      outerRadius={74}
                      paddingAngle={2}
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
              Leitura Rápida dos Indicadores Semafóricos
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Entenda em segundos o significado de cada cor nos gráficos da sua empresa.
            </p>
          </div>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-4">
              <p className="text-xs font-bold text-[#16A34A]">Verde · Positivo</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Receitas acima dos custos com margem líquida igual ou superior a 10% ou meta atingida.
              </p>
            </div>
            <div className="border border-amber-200 bg-amber-50/60 rounded-lg p-4">
              <p className="text-xs font-bold text-[#B45309]">Amarelo · Normal</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Equilíbrio financeiro (margem entre 0% e 10%), ritmo regular ou valores em aberto.
              </p>
            </div>
            <div className="border border-red-200 bg-red-50/50 rounded-lg p-4">
              <p className="text-xs font-bold text-[#DC2626]">Vermelho · Negativo</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Despesas maiores que receitas (prejuízo no mês) ou ritmo abaixo do mínimo esperado.
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
              Últimas Movimentações do Fluxo de Caixa
            </h2>
            <p className="text-xs text-slate-500">Resumo cronológico das entradas e saídas recentes.</p>
          </div>
          <button
            type="button"
            onClick={() => onGoToTab('finance')}
            className="text-xs font-semibold text-[#1E40AF] hover:underline cursor-pointer"
          >
            Ver tudo
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Nenhuma movimentação encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-6">Data</th>
                  <th className="py-3 px-6">Descrição</th>
                  <th className="py-3 px-6">Categoria</th>
                  <th className="py-3 px-6">Situação</th>
                  <th className="py-3 px-6 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {transactions.slice(0, 6).map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-6 font-mono tabular-nums text-xs text-slate-500">
                      {formatDateBR(t.date)}
                    </td>
                    <td className="py-3 px-6 font-medium text-slate-900">{t.description}</td>
                    <td className="py-3 px-6 text-xs text-slate-600">{t.category}</td>
                    <td className="py-3 px-6 text-xs font-medium text-slate-700">
                      {t.status === 'settled' ? 'Liquidado' : 'Pendente'}
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
