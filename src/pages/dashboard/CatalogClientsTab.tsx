import React, { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import {
  addCustomerClient,
  addProduct,
  addServiceItem,
  removeCustomerClient,
  removeProduct,
  removeServiceItem,
  type CustomerClient,
  type Product,
  type ServiceItem,
} from '../../services/firestoreService';
import { formatBRL } from '../../utils/format';

interface CatalogClientsTabProps {
  mode: 'catalog' | 'clients';
  companyId: string;
  userId: string;
  products: Product[];
  services: ServiceItem[];
  clients: CustomerClient[];
}

export function CatalogClientsTab({
  mode,
  companyId,
  userId,
  products,
  services,
  clients,
}: CatalogClientsTabProps) {
  const [catalogTab, setCatalogTab] = useState<'products' | 'services'>('products');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Product / Service form fields
  const [itemName, setItemName] = useState('');
  const [itemSku, setItemSku] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCost, setItemCost] = useState('');
  const [itemStock, setItemStock] = useState('10');
  const [itemUnit, setItemUnit] = useState('un');

  // Client form fields
  const [clientName, setClientName] = useState('');
  const [clientDoc, setClientDoc] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientCity, setClientCity] = useState('');

  const handleCreateProductOrService = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (catalogTab === 'products') {
        await addProduct(companyId, userId, {
          name: itemName,
          sku: itemSku,
          category: itemCategory || 'Geral',
          price: Number(itemPrice) || 0,
          cost: Number(itemCost) || 0,
          stock: Math.max(0, Math.round(Number(itemStock) || 0)),
          unit: itemUnit || 'un',
          active: true,
        });
      } else {
        await addServiceItem(companyId, userId, {
          name: itemName,
          category: itemCategory || 'Consultoria',
          price: Number(itemPrice) || 0,
          estimatedCost: Number(itemCost) || 0,
          billingUnit: itemUnit || 'Mensal',
          active: true,
        });
      }
      setItemName('');
      setItemSku('');
      setItemPrice('');
      setItemCost('');
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addCustomerClient(companyId, userId, {
        name: clientName,
        document: clientDoc,
        email: clientEmail,
        phone: clientPhone,
        city: clientCity,
        status: 'active',
      });
      setClientName('');
      setClientDoc('');
      setClientEmail('');
      setClientPhone('');
      setClientCity('');
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q)
    );
  }, [services, search]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q)
    );
  }, [clients, search]);

  if (mode === 'clients') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente por nome, e-mail ou cidade..."
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E40AF]"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] cursor-pointer self-start"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Cliente</span>
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreateClient}
            className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome / Razão Social *
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">CPF ou CNPJ</label>
              <input
                type="text"
                value={clientDoc}
                onChange={(e) => setClientDoc(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail</label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone</label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cidade / UF</label>
              <input
                type="text"
                value={clientCity}
                onChange={(e) => setClientCity(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg cursor-pointer"
              >
                {saving ? 'Salvando...' : 'Cadastrar Cliente'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-2 text-xs font-medium text-slate-600 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {filteredClients.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Nenhum cliente cadastrado ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                    <th className="py-3 px-5">Cliente</th>
                    <th className="py-3 px-5">Documento</th>
                    <th className="py-3 px-5">E-mail</th>
                    <th className="py-3 px-5">Telefone</th>
                    <th className="py-3 px-5">Cidade</th>
                    <th className="py-3 px-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredClients.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-5 font-semibold text-slate-900">{c.name}</td>
                      <td className="py-3 px-5 font-mono text-xs text-slate-600">
                        {c.document || '—'}
                      </td>
                      <td className="py-3 px-5 text-xs text-slate-600">{c.email || '—'}</td>
                      <td className="py-3 px-5 text-xs text-slate-600">{c.phone || '—'}</td>
                      <td className="py-3 px-5 text-xs text-slate-600">{c.city || '—'}</td>
                      <td className="py-3 px-5 text-right">
                        <button
                          type="button"
                          aria-label="Remover cliente"
                          onClick={() => removeCustomerClient(c.id)}
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
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setCatalogTab('products')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
              catalogTab === 'products' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Produtos ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setCatalogTab('services')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
              catalogTab === 'services' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Serviços ({services.length})
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] cursor-pointer self-start"
        >
          <Plus className="w-4 h-4" />
          <span>{catalogTab === 'products' ? 'Novo Produto' : 'Novo Serviço'}</span>
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreateProductOrService}
          className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nome *</label>
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          {catalogTab === 'products' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Código SKU</label>
              <input
                type="text"
                value={itemSku}
                onChange={(e) => setItemSku(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria</label>
            <input
              type="text"
              value={itemCategory}
              onChange={(e) => setItemCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Preço de Venda (R$) *
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {catalogTab === 'products' ? 'Custo Unitário (R$)' : 'Custo Estimado (R$)'}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={itemCost}
              onChange={(e) => setItemCost(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
            />
          </div>
          {catalogTab === 'products' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Estoque</label>
              <input
                type="number"
                min="0"
                value={itemStock}
                onChange={(e) => setItemStock(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unidade de Cobrança
              </label>
              <input
                type="text"
                value={itemUnit}
                onChange={(e) => setItemUnit(e.target.value)}
                placeholder="Ex: Hora, Projeto, Mensal"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          )}

          <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-2 text-xs font-medium text-slate-600 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg cursor-pointer"
            >
              {saving ? 'Salvando...' : 'Salvar Item'}
            </button>
          </div>
        </form>
      )}

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar itens..."
          className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E40AF]"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {catalogTab === 'products' ? (
          filteredProducts.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Nenhum produto cadastrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                    <th className="py-3 px-5">Produto</th>
                    <th className="py-3 px-5">SKU</th>
                    <th className="py-3 px-5 text-right">Preço</th>
                    <th className="py-3 px-5 text-right">Custo</th>
                    <th className="py-3 px-5 text-right">Margem</th>
                    <th className="py-3 px-5 text-right">Estoque</th>
                    <th className="py-3 px-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredProducts.map((p) => {
                    const margin = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-5 font-semibold text-slate-900">{p.name}</td>
                        <td className="py-3 px-5 font-mono text-xs text-slate-500">
                          {p.sku || '—'}
                        </td>
                        <td className="py-3 px-5 text-right font-mono tabular-nums font-semibold">
                          {formatBRL(p.price)}
                        </td>
                        <td className="py-3 px-5 text-right font-mono tabular-nums text-slate-600">
                          {formatBRL(p.cost)}
                        </td>
                        <td className="py-3 px-5 text-right font-mono tabular-nums text-[#16A34A]">
                          {margin.toFixed(1)}%
                        </td>
                        <td className="py-3 px-5 text-right font-mono tabular-nums">
                          {p.stock} {p.unit || 'un'}
                        </td>
                        <td className="py-3 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => removeProduct(p.id)}
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
          )
        ) : filteredServices.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Nenhum serviço cadastrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-5">Serviço</th>
                  <th className="py-3 px-5">Categoria</th>
                  <th className="py-3 px-5">Cobrança</th>
                  <th className="py-3 px-5 text-right">Preço</th>
                  <th className="py-3 px-5 text-right">Custo Est.</th>
                  <th className="py-3 px-5 text-right">Margem</th>
                  <th className="py-3 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredServices.map((s) => {
                  const margin = s.price > 0 ? ((s.price - s.estimatedCost) / s.price) * 100 : 0;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-5 font-semibold text-slate-900">{s.name}</td>
                      <td className="py-3 px-5 text-xs text-slate-600">{s.category || '—'}</td>
                      <td className="py-3 px-5 text-xs text-slate-600">{s.billingUnit || 'Unidade'}</td>
                      <td className="py-3 px-5 text-right font-mono tabular-nums font-semibold">
                        {formatBRL(s.price)}
                      </td>
                      <td className="py-3 px-5 text-right font-mono tabular-nums text-slate-600">
                        {formatBRL(s.estimatedCost)}
                      </td>
                      <td className="py-3 px-5 text-right font-mono tabular-nums text-[#16A34A]">
                        {margin.toFixed(1)}%
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => removeServiceItem(s.id)}
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
        )}
      </div>
    </div>
  );
}
