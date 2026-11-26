import React, { useMemo, useState } from 'react';
import { Plus, Search, Trash2, CheckCircle2 } from 'lucide-react';
import {
  addExpense,
  addRevenue,
  removeExpense,
  removeRevenue,
  updateExpense,
  updateRevenue,
  type Expense,
  type LedgerTransaction,
  type Revenue,
} from '../../services/firestoreService';
import { formatBRL, formatDateBR } from '../../utils/format';

interface FinanceTabProps {
  companyId: string;
  userId: string;
  revenues: Revenue[];
  expenses: Expense[];
  transactions: LedgerTransaction[];
}

export function FinanceTab({
  companyId,
  userId,
  revenues,
  expenses,
  transactions,
}: FinanceTabProps) {
  const [subTab, setSubTab] = useState<'revenues' | 'expenses' | 'cashflow'>('revenues');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'settled' | 'pending'>('all');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'revenue' | 'expense'>('revenue');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Vendas');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [counterparty, setCounterparty] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Pix');
  const [settled, setSettled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const openNewForm = (type: 'revenue' | 'expense') => {
    setFormType(type);
    setCategory(type === 'revenue' ? 'Vendas' : 'Operacional');
    setDescription('');
    setAmount('');
    setCounterparty('');
    setSettled(true);
    setErrorMsg('');
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (description.trim().length < 2 || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setErrorMsg('Informe uma descrição válida e valor maior que zero.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    try {
      if (formType === 'revenue') {
        await addRevenue(companyId, userId, {
          description,
          category,
          amount: numericAmount,
          date,
          customerName: counterparty,
          status: settled ? 'received' : 'pending',
          paymentMethod,
        });
      } else {
        await addExpense(companyId, userId, {
          description,
          category,
          amount: numericAmount,
          date,
          supplierName: counterparty,
          status: settled ? 'paid' : 'pending',
          paymentMethod,
        });
      }
      setShowForm(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar lançamento.');
    } finally {
      setSaving(false);
    }
  };

  const filteredRevenues = useMemo(() => {
    const q = search.trim().toLowerCase();
    return revenues.filter((r) => {
      if (statusFilter === 'settled' && r.status !== 'received') return false;
      if (statusFilter === 'pending' && r.status !== 'pending') return false;
      if (!q) return true;
      return (
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.customerName || '').toLowerCase().includes(q)
      );
    });
  }, [revenues, search, statusFilter]);

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (statusFilter === 'settled' && e.status !== 'paid') return false;
      if (statusFilter === 'pending' && e.status !== 'pending') return false;
      if (!q) return true;
      return (
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.supplierName || '').toLowerCase().includes(q)
      );
    });
  }, [expenses, search, statusFilter]);

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (statusFilter === 'settled' && t.status !== 'settled') return false;
      if (statusFilter === 'pending' && t.status !== 'pending') return false;
      if (!q) return true;
      return t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    });
  }, [transactions, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setSubTab('revenues')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
              subTab === 'revenues' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Receitas ({revenues.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('expenses')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
              subTab === 'expenses' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Despesas ({expenses.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('cashflow')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
              subTab === 'cashflow' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Fluxo de Caixa ({transactions.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openNewForm('revenue')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Receita</span>
          </button>
          <button
            type="button"
            onClick={() => openNewForm('expense')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Despesa</span>
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <form
          onSubmit={handleSave}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-[#0F172A]">
              {formType === 'revenue' ? 'Registrar Nova Receita' : 'Registrar Nova Despesa'}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancelar
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição *</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  formType === 'revenue'
                    ? 'Ex: Consultoria mensal cliente X'
                    : 'Ex: Aluguel comercial'
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E40AF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria *</label>
              <input
                type="text"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex: Vendas, Serviços, Impostos"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E40AF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Valor (R$) *</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E40AF] font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Data *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E40AF] font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {formType === 'revenue' ? 'Cliente' : 'Fornecedor'}
              </label>
              <input
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="Opcional"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E40AF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Forma de pagamento
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#1E40AF]"
              >
                <option value="Pix">Pix</option>
                <option value="Cartão">Cartão de Crédito/Débito</option>
                <option value="Boleto">Boleto Bancário</option>
                <option value="Transferência">Transferência Bancária</option>
                <option value="Dinheiro">Dinheiro</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={settled}
                onChange={(e) => setSettled(e.target.checked)}
                className="rounded border-slate-300 text-[#1E40AF]"
              />
              <span>
                {formType === 'revenue' ? 'Valor já recebido em conta' : 'Conta já paga'}
              </span>
            </label>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Salvando...' : 'Salvar Lançamento'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descrição, categoria ou nome..."
            className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E40AF]"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg self-start">
          {(['all', 'settled', 'pending'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                statusFilter === st ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
            >
              {st === 'all' ? 'Todos' : st === 'settled' ? 'Liquidados' : 'Pendentes'}
            </button>
          ))}
        </div>
      </div>

      {/* Data Tables */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {subTab === 'revenues' && (
          <div className="overflow-x-auto">
            {filteredRevenues.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                Nenhuma receita encontrada. Clique em <strong>Nova Receita</strong> para registrar.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                    <th className="py-3 px-5">Data</th>
                    <th className="py-3 px-5">Descrição</th>
                    <th className="py-3 px-5">Categoria</th>
                    <th className="py-3 px-5">Cliente</th>
                    <th className="py-3 px-5">Situação</th>
                    <th className="py-3 px-5 text-right">Valor</th>
                    <th className="py-3 px-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredRevenues.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-5 font-mono tabular-nums text-xs text-slate-500">
                        {formatDateBR(r.date)}
                      </td>
                      <td className="py-3 px-5 font-medium text-slate-900">{r.description}</td>
                      <td className="py-3 px-5 text-xs text-slate-600">{r.category}</td>
                      <td className="py-3 px-5 text-xs text-slate-600">{r.customerName || '—'}</td>
                      <td className="py-3 px-5 text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            updateRevenue(r.id, {
                              status: r.status === 'received' ? 'pending' : 'received',
                            })
                          }
                          className={`inline-flex items-center gap-1 font-medium cursor-pointer ${
                            r.status === 'received' ? 'text-[#16A34A]' : 'text-[#D97706]'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{r.status === 'received' ? 'Recebido' : 'Pendente'}</span>
                        </button>
                      </td>
                      <td className="py-3 px-5 text-right font-mono tabular-nums font-semibold text-[#16A34A]">
                        {formatBRL(r.amount)}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          type="button"
                          aria-label="Excluir receita"
                          onClick={() => removeRevenue(r.id)}
                          className="p-1.5 text-slate-400 hover:text-[#DC2626] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {subTab === 'expenses' && (
          <div className="overflow-x-auto">
            {filteredExpenses.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                Nenhuma despesa encontrada. Clique em <strong>Nova Despesa</strong> para registrar.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                    <th className="py-3 px-5">Data</th>
                    <th className="py-3 px-5">Descrição</th>
                    <th className="py-3 px-5">Categoria</th>
                    <th className="py-3 px-5">Fornecedor</th>
                    <th className="py-3 px-5">Situação</th>
                    <th className="py-3 px-5 text-right">Valor</th>
                    <th className="py-3 px-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredExpenses.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-5 font-mono tabular-nums text-xs text-slate-500">
                        {formatDateBR(e.date)}
                      </td>
                      <td className="py-3 px-5 font-medium text-slate-900">{e.description}</td>
                      <td className="py-3 px-5 text-xs text-slate-600">{e.category}</td>
                      <td className="py-3 px-5 text-xs text-slate-600">{e.supplierName || '—'}</td>
                      <td className="py-3 px-5 text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            updateExpense(e.id, {
                              status: e.status === 'paid' ? 'pending' : 'paid',
                            })
                          }
                          className={`inline-flex items-center gap-1 font-medium cursor-pointer ${
                            e.status === 'paid' ? 'text-[#16A34A]' : 'text-[#D97706]'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{e.status === 'paid' ? 'Pago' : 'Pendente'}</span>
                        </button>
                      </td>
                      <td className="py-3 px-5 text-right font-mono tabular-nums font-semibold text-[#DC2626]">
                        {formatBRL(e.amount)}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          type="button"
                          aria-label="Excluir despesa"
                          onClick={() => removeExpense(e.id)}
                          className="p-1.5 text-slate-400 hover:text-[#DC2626] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {subTab === 'cashflow' && (
          <div className="overflow-x-auto">
            {filteredTransactions.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                Nenhuma movimentação no fluxo de caixa ainda.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                    <th className="py-3 px-5">Data</th>
                    <th className="py-3 px-5">Tipo</th>
                    <th className="py-3 px-5">Descrição</th>
                    <th className="py-3 px-5">Categoria</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-5 font-mono tabular-nums text-xs text-slate-500">
                        {formatDateBR(t.date)}
                      </td>
                      <td className="py-3 px-5 text-xs font-medium text-slate-700">
                        {t.type === 'income' ? 'Entrada' : 'Saída'}
                      </td>
                      <td className="py-3 px-5 font-medium text-slate-900">{t.description}</td>
                      <td className="py-3 px-5 text-xs text-slate-600">{t.category}</td>
                      <td className="py-3 px-5 text-xs text-slate-600">
                        {t.status === 'settled' ? 'Liquidado' : 'Pendente'}
                      </td>
                      <td
                        className={`py-3 px-5 text-right font-mono tabular-nums font-semibold ${
                          t.type === 'income' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                        }`}
                      >
                        {t.type === 'income' ? '+' : '-'} {formatBRL(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
