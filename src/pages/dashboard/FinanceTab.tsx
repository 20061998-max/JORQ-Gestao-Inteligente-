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
import { useLanguage } from '../../contexts/LanguageContext';

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
  const { lang, pick } = useLanguage();
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
    setCategory(
      type === 'revenue'
        ? pick({ pt: 'Vendas', en: 'Sales', es: 'Ventas', fr: 'Ventes' })
        : pick({ pt: 'Operacional', en: 'Operating', es: 'Operativo', fr: 'Exploitation' })
    );
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
      setErrorMsg(
        pick({
          pt: 'Informe uma descrição válida e valor maior que zero.',
          en: 'Enter a valid description and an amount greater than zero.',
          es: 'Ingrese una descripción válida y un valor mayor a cero.',
          fr: 'Saisissez une description valide et un montant supérieur à zéro.',
        })
      );
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
      setErrorMsg(
        err instanceof Error
          ? err.message
          : pick({
              pt: 'Erro ao salvar lançamento.',
              en: 'Error saving entry.',
              es: 'Error al guardar el movimiento.',
              fr: "Erreur lors de l'enregistrement.",
            })
      );
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
            {pick({ pt: 'Receitas', en: 'Revenues', es: 'Ingresos', fr: 'Revenus' })} ({revenues.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('expenses')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
              subTab === 'expenses' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {pick({ pt: 'Despesas', en: 'Expenses', es: 'Gastos', fr: 'Dépenses' })} ({expenses.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('cashflow')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
              subTab === 'cashflow' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {pick({ pt: 'Fluxo de Caixa', en: 'Cash Flow', es: 'Flujo de Caja', fr: 'Trésorerie' })} ({transactions.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openNewForm('revenue')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{pick({ pt: 'Nova Receita', en: 'New Revenue', es: 'Nuevo Ingreso', fr: 'Nouveau Revenu' })}</span>
          </button>
          <button
            type="button"
            onClick={() => openNewForm('expense')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{pick({ pt: 'Nova Despesa', en: 'New Expense', es: 'Nuevo Gasto', fr: 'Nouvelle Dépense' })}</span>
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
              {formType === 'revenue'
                ? pick({ pt: 'Registrar Nova Receita', en: 'Record New Revenue', es: 'Registrar Nuevo Ingreso', fr: 'Enregistrer un Revenu' })
                : pick({ pt: 'Registrar Nova Despesa', en: 'Record New Expense', es: 'Registrar Nuevo Gasto', fr: 'Enregistrer une Dépense' })}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              {pick({ pt: 'Cancelar', en: 'Cancel', es: 'Cancelar', fr: 'Annuler' })}
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {pick({ pt: 'Descrição *', en: 'Description *', es: 'Descripción *', fr: 'Description *' })}
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  formType === 'revenue'
                    ? pick({ pt: 'Ex: Consultoria mensal cliente X', en: 'e.g. Monthly consulting client X', es: 'Ej: Consultoría mensual cliente X', fr: 'Ex : Conseil mensuel client X' })
                    : pick({ pt: 'Ex: Aluguel comercial', en: 'e.g. Office rent', es: 'Ej: Alquiler comercial', fr: 'Ex : Loyer commercial' })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E40AF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {pick({ pt: 'Categoria *', en: 'Category *', es: 'Categoría *', fr: 'Catégorie *' })}
              </label>
              <input
                type="text"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={pick({ pt: 'Ex: Vendas, Serviços, Impostos', en: 'e.g. Sales, Services, Taxes', es: 'Ej: Ventas, Servicios, Impuestos', fr: 'Ex : Ventes, Services, Impôts' })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E40AF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {pick({ pt: 'Valor (R$) *', en: 'Amount (BRL) *', es: 'Valor (BRL) *', fr: 'Montant (BRL) *' })}
              </label>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {pick({ pt: 'Data *', en: 'Date *', es: 'Fecha *', fr: 'Date *' })}
              </label>
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
                {formType === 'revenue'
                  ? pick({ pt: 'Cliente', en: 'Client', es: 'Cliente', fr: 'Client' })
                  : pick({ pt: 'Fornecedor', en: 'Supplier', es: 'Proveedor', fr: 'Fournisseur' })}
              </label>
              <input
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder={pick({ pt: 'Opcional', en: 'Optional', es: 'Opcional', fr: 'Optionnel' })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E40AF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {pick({ pt: 'Forma de pagamento', en: 'Payment method', es: 'Método de pago', fr: 'Moyen de paiement' })}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#1E40AF]"
              >
                <option value="Pix">Pix</option>
                <option value="Cartão">{pick({ pt: 'Cartão de Crédito/Débito', en: 'Credit/Debit Card', es: 'Tarjeta Crédito/Débito', fr: 'Carte Bancaire' })}</option>
                <option value="Boleto">{pick({ pt: 'Boleto Bancário', en: 'Bank Slip', es: 'Boleto Bancario', fr: 'Virement / Boleto' })}</option>
                <option value="Transferência">{pick({ pt: 'Transferência Bancária', en: 'Bank Transfer', es: 'Transferencia Bancaria', fr: 'Virement Bancaire' })}</option>
                <option value="Dinheiro">{pick({ pt: 'Dinheiro', en: 'Cash', es: 'Efectivo', fr: 'Espèces' })}</option>
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
                {formType === 'revenue'
                  ? pick({ pt: 'Valor já recebido em conta', en: 'Already received', es: 'Monto ya recibido', fr: 'Montant déjà encaissé' })
                  : pick({ pt: 'Conta já paga', en: 'Already paid', es: 'Cuenta ya pagada', fr: 'Déjà payé' })}
              </span>
            </label>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 cursor-pointer"
            >
              {saving
                ? pick({ pt: 'Salvando...', en: 'Saving...', es: 'Guardando...', fr: 'Enregistrement...' })
                : pick({ pt: 'Salvar Lançamento', en: 'Save Entry', es: 'Guardar Movimiento', fr: 'Enregistrer' })}
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
            placeholder={pick({
              pt: 'Buscar por descrição, categoria ou nome...',
              en: 'Search by description, category, or name...',
              es: 'Buscar por descripción, categoría o nombre...',
              fr: 'Rechercher par description, catégorie ou nom...',
            })}
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
              {st === 'all'
                ? pick({ pt: 'Todos', en: 'All', es: 'Todos', fr: 'Tous' })
                : st === 'settled'
                ? pick({ pt: 'Liquidados', en: 'Settled', es: 'Liquidados', fr: 'Réglés' })
                : pick({ pt: 'Pendentes', en: 'Pending', es: 'Pendientes', fr: 'En attente' })}
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
                {pick({
                  pt: 'Nenhuma receita encontrada. Clique em Nova Receita para registrar.',
                  en: 'No revenues found. Click New Revenue to record one.',
                  es: 'No se encontraron ingresos. Haga clic en Nuevo Ingreso para registrar.',
                  fr: 'Aucun revenu trouvé. Cliquez sur Nouveau Revenu pour enregistrer.',
                })}
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                    <th className="py-3 px-5">{pick({ pt: 'Data', en: 'Date', es: 'Fecha', fr: 'Date' })}</th>
                    <th className="py-3 px-5">{pick({ pt: 'Descrição', en: 'Description', es: 'Descripción', fr: 'Description' })}</th>
                    <th className="py-3 px-5">{pick({ pt: 'Categoria', en: 'Category', es: 'Categoría', fr: 'Catégorie' })}</th>
                    <th className="py-3 px-5">{pick({ pt: 'Cliente', en: 'Client', es: 'Cliente', fr: 'Client' })}</th>
                    <th className="py-3 px-5">{pick({ pt: 'Situação', en: 'Status', es: 'Estado', fr: 'Statut' })}</th>
                    <th className="py-3 px-5 text-right">{pick({ pt: 'Valor', en: 'Amount', es: 'Valor', fr: 'Montant' })}</th>
                    <th className="py-3 px-5 text-right">{pick({ pt: 'Ações', en: 'Actions', es: 'Acciones', fr: 'Actions' })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredRevenues.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-5 font-mono tabular-nums text-xs text-slate-500">
                        {formatDateBR(r.date, lang)}
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
                          <span>
                            {r.status === 'received'
                              ? pick({ pt: 'Recebido', en: 'Received', es: 'Recibido', fr: 'Encaissé' })
                              : pick({ pt: 'Pendente', en: 'Pending', es: 'Pendiente', fr: 'En attente' })}
                          </span>
                        </button>
                      </td>
                      <td className="py-3 px-5 text-right font-mono tabular-nums font-semibold text-[#16A34A]">
                        {formatBRL(r.amount)}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          type="button"
                          aria-label={pick({ pt: 'Excluir receita', en: 'Delete revenue', es: 'Eliminar ingreso', fr: 'Supprimer le revenu' })}
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
                {pick({
                  pt: 'Nenhuma despesa encontrada. Clique em Nova Despesa para registrar.',
                  en: 'No expenses found. Click New Expense to record one.',
                  es: 'No se encontraron gastos. Haga clic en Nuevo Gasto para registrar.',
                  fr: 'Aucune dépense trouvée. Cliquez sur Nouvelle Dépense pour enregistrer.',
                })}
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                    <th className="py-3 px-5">{pick({ pt: 'Data', en: 'Date', es: 'Fecha', fr: 'Date' })}</th>
                    <th className="py-3 px-5">{pick({ pt: 'Descrição', en: 'Description', es: 'Descripción', fr: 'Description' })}</th>
                    <th className="py-3 px-5">{pick({ pt: 'Categoria', en: 'Category', es: 'Categoría', fr: 'Catégorie' })}</th>
                    <th className="py-3 px-5">{pick({ pt: 'Fornecedor', en: 'Supplier', es: 'Proveedor', fr: 'Fournisseur' })}</th>
                    <th className="py-3 px-5">{pick({ pt: 'Situação', en: 'Status', es: 'Estado', fr: 'Statut' })}</th>
                    <th className="py-3 px-5 text-right">{pick({ pt: 'Valor', en: 'Amount', es: 'Valor', fr: 'Montant' })}</th>
                    <th className="py-3 px-5 text-right">{pick({ pt: 'Ações', en: 'Actions', es: 'Acciones', fr: 'Actions' })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredExpenses.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-5 font-mono tabular-nums text-xs text-slate-500">
                        {formatDateBR(e.date, lang)}
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
                          <span>
                            {e.status === 'paid'
                              ? pick({ pt: 'Pago', en: 'Paid', es: 'Pagado', fr: 'Payé' })
                              : pick({ pt: 'Pendente', en: 'Pending', es: 'Pendiente', fr: 'En attente' })}
                          </span>
                        </button>
                      </td>
                      <td className="py-3 px-5 text-right font-mono tabular-nums font-semibold text-[#DC2626]">
                        {formatBRL(e.amount)}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          type="button"
                          aria-label={pick({ pt: 'Excluir despesa', en: 'Delete expense', es: 'Eliminar gasto', fr: 'Supprimer la dépense' })}
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
                {pick({
                  pt: 'Nenhuma movimentação no fluxo de caixa ainda.',
                  en: 'No cash flow entries yet.',
                  es: 'Aún no hay movimientos en el flujo de caja.',
                  fr: 'Aucun mouvement de trésorerie pour le moment.',
                })}
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                    <th className="py-3 px-5">{pick({ pt: 'Data', en: 'Date', es: 'Fecha', fr: 'Date' })}</th>
                    <th className="py-3 px-5">{pick({ pt: 'Tipo', en: 'Type', es: 'Tipo', fr: 'Type' })}</th>
                    <th className="py-3 px-5">{pick({ pt: 'Descrição', en: 'Description', es: 'Descripción', fr: 'Description' })}</th>
                    <th className="py-3 px-5">{pick({ pt: 'Categoria', en: 'Category', es: 'Categoría', fr: 'Catégorie' })}</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">{pick({ pt: 'Valor', en: 'Amount', es: 'Valor', fr: 'Montant' })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-5 font-mono tabular-nums text-xs text-slate-500">
                        {formatDateBR(t.date, lang)}
                      </td>
                      <td className="py-3 px-5 text-xs font-medium text-slate-700">
                        {t.type === 'income'
                          ? pick({ pt: 'Entrada', en: 'Inflow', es: 'Entrada', fr: 'Entrée' })
                          : pick({ pt: 'Saída', en: 'Outflow', es: 'Salida', fr: 'Sortie' })}
                      </td>
                      <td className="py-3 px-5 font-medium text-slate-900">{t.description}</td>
                      <td className="py-3 px-5 text-xs text-slate-600">{t.category}</td>
                      <td className="py-3 px-5 text-xs text-slate-600">
                        {t.status === 'settled'
                          ? pick({ pt: 'Liquidado', en: 'Settled', es: 'Liquidado', fr: 'Réglé' })
                          : pick({ pt: 'Pendente', en: 'Pending', es: 'Pendiente', fr: 'En attente' })}
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
