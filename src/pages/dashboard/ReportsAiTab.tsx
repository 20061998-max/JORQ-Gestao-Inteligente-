import React, { useMemo, useState } from 'react';
import { Download, FileText, Brain, Send, BookmarkPlus } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  SEMANTIC_COLORS,
  SemanticChartLegend,
  getSemanticStatus,
} from '../../components/SemanticChartLegend';
import { useAuth } from '../../contexts/AuthContext';
import {
  saveReportSnapshot,
  type Company,
  type CustomerClient,
  type Expense,
  type LedgerTransaction,
  type Product,
  type Revenue,
  type SavedReport,
  type ServiceItem,
} from '../../services/firestoreService';
import { exportFinancialReportPDF, exportToCSV } from '../../utils/export';
import { formatBRL, formatDateBR } from '../../utils/format';

interface ReportsAiTabProps {
  mode: 'reports' | 'ai';
  company: Company;
  userId: string;
  revenues: Revenue[];
  expenses: Expense[];
  transactions: LedgerTransaction[];
  products: Product[];
  services: ServiceItem[];
  clients: CustomerClient[];
  savedReports: SavedReport[];
}

export function ReportsAiTab({
  mode,
  company,
  userId,
  revenues,
  expenses,
  transactions,
  products,
  services,
  clients,
  savedReports,
}: ReportsAiTabProps) {
  const { getIdToken } = useAuth();
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [savingSnap, setSavingSnap] = useState(false);

  // AI state
  const [aiMode, setAiMode] = useState<'diagnosis' | 'forecast' | 'qa'>('diagnosis');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const filteredTx = useMemo(() => {
    return transactions.filter((t) => {
      if (periodStart && t.date < periodStart) return false;
      if (periodEnd && t.date > periodEnd) return false;
      return true;
    });
  }, [transactions, periodStart, periodEnd]);

  const metrics = useMemo(() => {
    const totalRevenue = filteredTx
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const totalExpense = filteredTx
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const netProfit = totalRevenue - totalExpense;
    const marginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    return { totalRevenue, totalExpense, netProfit, marginPercent };
  }, [filteredTx]);

  // 3-month projection series for reports chart
  const forecastSeries = useMemo(() => {
    const avgRev = revenues.length
      ? revenues.reduce((s, r) => s + Number(r.amount || 0), 0) / Math.max(1, new Set(revenues.map((r) => r.date.slice(0, 7))).size)
      : 0;
    const avgExp = expenses.length
      ? expenses.reduce((s, e) => s + Number(e.amount || 0), 0) / Math.max(1, new Set(expenses.map((e) => e.date.slice(0, 7))).size)
      : 0;

    return [
      { periodo: 'Mês Atual', receita: Math.round(avgRev), despesa: Math.round(avgExp), saldo: Math.round(avgRev - avgExp) },
      { periodo: 'Projeção +30d', receita: Math.round(avgRev * 1.05), despesa: Math.round(avgExp * 1.02), saldo: Math.round(avgRev * 1.05 - avgExp * 1.02) },
      { periodo: 'Projeção +60d', receita: Math.round(avgRev * 1.1), despesa: Math.round(avgExp * 1.03), saldo: Math.round(avgRev * 1.1 - avgExp * 1.03) },
      { periodo: 'Projeção +90d', receita: Math.round(avgRev * 1.16), despesa: Math.round(avgExp * 1.04), saldo: Math.round(avgRev * 1.16 - avgExp * 1.04) },
    ];
  }, [revenues, expenses]);

  const dreChartData = useMemo(() => {
    const resultSemantic = getSemanticStatus(metrics.netProfit, metrics.marginPercent);
    return [
      { label: 'Receitas', valor: metrics.totalRevenue, color: SEMANTIC_COLORS.positive, tag: 'Positivo' },
      { label: 'Despesas', valor: -metrics.totalExpense, color: SEMANTIC_COLORS.negative, tag: 'Saída' },
      {
        label: 'Resultado Líquido',
        valor: metrics.netProfit,
        color: resultSemantic.color,
        tag: resultSemantic.label,
      },
    ];
  }, [metrics]);

  const handleExportCSV = () => {
    exportToCSV(
      `jorq-financeiro-${company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      ['Data', 'Tipo', 'Descrição', 'Categoria', 'Status', 'Valor'],
      filteredTx.map((t) => [
        formatDateBR(t.date),
        t.type === 'income' ? 'Receita' : 'Despesa',
        t.description,
        t.category,
        t.status === 'settled' ? 'Liquidado' : 'Pendente',
        t.type === 'income' ? Number(t.amount) : -Number(t.amount),
      ])
    );
  };

  const handleExportPDF = () => {
    const periodLabel =
      periodStart || periodEnd
        ? `${periodStart ? formatDateBR(periodStart) : 'Início'} até ${
            periodEnd ? formatDateBR(periodEnd) : 'Hoje'
          }`
        : 'Todo o período';
    exportFinancialReportPDF({
      companyName: company.name,
      periodLabel,
      totalRevenue: metrics.totalRevenue,
      totalExpense: metrics.totalExpense,
      netProfit: metrics.netProfit,
      marginPercent: metrics.marginPercent,
      transactions: filteredTx,
    });
  };

  const handleSaveSnapshot = async () => {
    setSavingSnap(true);
    try {
      await saveReportSnapshot(company.id, userId, {
        title: `DRE ${new Date().toLocaleDateString('pt-BR')}`,
        type: 'dre',
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
        totalRevenue: metrics.totalRevenue,
        totalExpense: metrics.totalExpense,
        netProfit: metrics.netProfit,
      });
    } finally {
      setSavingSnap(false);
    }
  };

  const runAiAnalysis = async (selectedMode: 'diagnosis' | 'forecast' | 'qa', e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (selectedMode === 'qa' && !aiQuestion.trim()) return;
    setAiMode(selectedMode);
    setAiLoading(true);
    setAiError('');
    try {
      const token = await getIdToken();
      const totalRev = revenues.reduce((s, r) => s + Number(r.amount || 0), 0);
      const totalExp = expenses.reduce((s, x) => s + Number(x.amount || 0), 0);
      const res = await fetch('/api/ai/financial-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyName: company.name,
          sector: company.sector || 'Geral',
          monthlyGoal: company.monthlyGoal || 0,
          mode: selectedMode,
          question: aiQuestion,
          summary: {
            totalRevenues: totalRev,
            totalExpenses: totalExp,
            netProfit: totalRev - totalExp,
            revenuesCount: revenues.length,
            expensesCount: expenses.length,
            productsCount: products.length,
            servicesCount: services.length,
            clientsCount: clients.length,
            topExpenses: expenses.slice(0, 8).map((x) => ({
              description: x.description,
              category: x.category,
              amount: x.amount,
              date: x.date,
            })),
            topRevenues: revenues.slice(0, 8).map((r) => ({
              description: r.description,
              category: r.category,
              amount: r.amount,
              date: r.date,
            })),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || 'Erro ao gerar análise financeira.');
      } else {
        setAiResponse(data.analysis || '');
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Falha de comunicação com o servidor.');
    } finally {
      setAiLoading(false);
    }
  };

  if (mode === 'ai') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Brain className="w-6 h-6 text-[#1E40AF] shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-lg font-bold text-[#0F172A]">
                Consultor Financeiro com Inteligência Artificial
              </h2>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                As análises são processadas no servidor utilizando os lançamentos reais de receitas,
                despesas, catálogo e metas da empresa <strong>{company.name}</strong>.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => runAiAnalysis('diagnosis')}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 cursor-pointer"
            >
              Gerar Diagnóstico Financeiro
            </button>
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => runAiAnalysis('forecast')}
              className="px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              Previsão de Caixa (90 dias)
            </button>
          </div>

          <form onSubmit={(e) => runAiAnalysis('qa', e)} className="mt-5 flex gap-2">
            <input
              type="text"
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              placeholder="Pergunte sobre seus custos, margem, ponto de equilíbrio ou metas..."
              className="flex-1 px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E40AF]"
            />
            <button
              type="submit"
              disabled={aiLoading || !aiQuestion.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Perguntar</span>
            </button>
          </form>
        </div>

        {aiError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {aiError}
          </div>
        )}

        {aiLoading && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-sm text-slate-600">
            Analisando indicadores financeiros de {company.name}...
          </div>
        )}

        {!aiLoading && aiResponse && (
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <p className="text-xs font-semibold text-[#1E40AF] mb-3">
              {aiMode === 'forecast'
                ? 'Previsão Financeira 90 Dias'
                : aiMode === 'qa'
                ? 'Resposta do Consultor Financeiro'
                : 'Diagnóstico Financeiro Completo'}
            </p>
            <div className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
              {aiResponse}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter & Export Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Data inicial</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Data final</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={savingSnap}
            onClick={handleSaveSnapshot}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <BookmarkPlus className="w-4 h-4" />
            <span>{savingSnap ? 'Salvando...' : 'Salvar Relatório'}</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* DRE Simplificado */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Receitas do Período</p>
          <p className="mt-1 font-mono tabular-nums text-xl font-bold text-[#16A34A]">
            {formatBRL(metrics.totalRevenue)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Despesas do Período</p>
          <p className="mt-1 font-mono tabular-nums text-xl font-bold text-[#DC2626]">
            {formatBRL(metrics.totalExpense)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Resultado Líquido</p>
          <p
            className={`mt-1 font-mono tabular-nums text-xl font-bold ${
              metrics.netProfit >= 0 ? 'text-[#0F172A]' : 'text-[#DC2626]'
            }`}
          >
            {formatBRL(metrics.netProfit)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Margem Líquida</p>
          <p className="mt-1 font-mono tabular-nums text-xl font-bold text-[#1E40AF]">
            {metrics.marginPercent.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Executive Charts: DRE + 90-Day Projection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="font-display text-base font-bold text-[#0F172A]">
            Balanço DRE do Período (Semafórico)
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-3">
            Comparativo entre entradas, saídas e resultado final.
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
              <BarChart data={dreChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                <ReferenceLine y={0} stroke="#64748B" strokeDasharray="3 3" />
                <Tooltip
                  formatter={(val, _name, item) => [
                    `${formatBRL(Number(val))} (${item?.payload?.tag || ''})`,
                    'Valor',
                  ]}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '12px' }}
                />
                <Bar dataKey="valor" name="Valor" radius={[4, 4, 4, 4]}>
                  {dreChartData.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="font-display text-base font-bold text-[#0F172A]">
            Projeção Financeira Estimada (Próximos 90 dias)
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-3">
            Verde projeta receitas, vermelho projeta despesas e amarelo mostra a linha de saldo líquido.
          </p>
          <div className="mb-4">
            <SemanticChartLegend
              items={[
                { label: 'Receita Projetada', color: SEMANTIC_COLORS.positive },
                { label: 'Despesa Projetada', color: SEMANTIC_COLORS.negative },
                { label: 'Saldo Projetado', color: SEMANTIC_COLORS.normal },
              ]}
            />
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={forecastSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="periodo" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                <ReferenceLine y={0} stroke="#CBD5E1" />
                <Tooltip
                  formatter={(val, name) => [formatBRL(Number(val)), String(name)]}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '12px' }}
                />
                <Area
                  type="monotone"
                  dataKey="receita"
                  name="Receita Projetada"
                  stroke={SEMANTIC_COLORS.positive}
                  strokeWidth={2}
                  fill="#DCFCE7"
                />
                <Area
                  type="monotone"
                  dataKey="despesa"
                  name="Despesa Projetada"
                  stroke={SEMANTIC_COLORS.negative}
                  strokeWidth={2}
                  fill="#FEE2E2"
                />
                <Line
                  type="monotone"
                  dataKey="saldo"
                  name="Saldo Projetado"
                  stroke={SEMANTIC_COLORS.normal}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: SEMANTIC_COLORS.normal, stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Saved Reports */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-display text-base font-bold text-[#0F172A]">
            Histórico de Relatórios Salvos
          </h3>
        </div>
        {savedReports.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Nenhum relatório salvo ainda. Clique em <strong>Salvar Relatório</strong> acima para
            arquivar um fechamento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-5">Título</th>
                  <th className="py-3 px-5 text-right">Receitas</th>
                  <th className="py-3 px-5 text-right">Despesas</th>
                  <th className="py-3 px-5 text-right">Lucro Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {savedReports.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 px-5 font-medium text-slate-900">{r.title}</td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums text-[#16A34A]">
                      {formatBRL(r.totalRevenue)}
                    </td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums text-[#DC2626]">
                      {formatBRL(r.totalExpense)}
                    </td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums font-semibold">
                      {formatBRL(r.netProfit)}
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
