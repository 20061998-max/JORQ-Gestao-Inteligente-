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
import { useLanguage } from '../../contexts/LanguageContext';

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
  const { pick } = useLanguage();
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
          category: itemCategory || pick({ pt: 'Geral', en: 'General', es: 'General', fr: 'Général' }),
          price: Number(itemPrice) || 0,
          cost: Number(itemCost) || 0,
          stock: Math.max(0, Math.round(Number(itemStock) || 0)),
          unit: itemUnit || 'un',
          active: true,
        });
      } else {
        await addServiceItem(companyId, userId, {
          name: itemName,
          category: itemCategory || pick({ pt: 'Consultoria', en: 'Consulting', es: 'Consultoría', fr: 'Conseil' }),
          price: Number(itemPrice) || 0,
          estimatedCost: Number(itemCost) || 0,
          billingUnit: itemUnit || pick({ pt: 'Mensal', en: 'Monthly', es: 'Mensual', fr: 'Mensuel' }),
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
              placeholder={pick({
                pt: 'Buscar cliente por nome, e-mail ou cidade...',
                en: 'Search client by name, email, or city...',
                es: 'Buscar cliente por nombre, correo o ciudad...',
                fr: 'Rechercher un client par nom, e-mail ou ville...',
              })}
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E40AF]"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] cursor-pointer self-start"
          >
            <Plus className="w-4 h-4" />
            <span>{pick({ pt: 'Novo Cliente', en: 'New Client', es: 'Nuevo Cliente', fr: 'Nouveau Client' })}</span>
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreateClient}
            className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {pick({ pt: 'Nome / Razão Social *', en: 'Name / Company *', es: 'Nombre / Razón Social *', fr: 'Nom / Raison Sociale *' })}
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {pick({ pt: 'CPF ou CNPJ', en: 'Tax ID / Document', es: 'ID Fiscal / Documento', fr: 'N° Fiscal / SIRET' })}
              </label>
              <input
                type="text"
                value={clientDoc}
                onChange={(e) => setClientDoc(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {pick({ pt: 'E-mail', en: 'Email', es: 'Correo', fr: 'E-mail' })}
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {pick({ pt: 'Telefone', en: 'Phone', es: 'Teléfono', fr: 'Téléphone' })}
              </label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {pick({ pt: 'Cidade / UF', en: 'City / State', es: 'Ciudad / Estado', fr: 'Ville / Région' })}
              </label>
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
                {saving
                  ? pick({ pt: 'Salvando...', en: 'Saving...', es: 'Guardando...', fr: 'Enregistrement...' })
                  : pick({ pt: 'Cadastrar Cliente', en: 'Save Client', es: 'Registrar Cliente', fr: 'Ajouter Client' })}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-2 text-xs font-medium text-slate-600 cursor-pointer"
              >
                {pick({ pt: 'Cancelar', en: 'Cancel', es: 'Cancelar', fr: 'Annuler' })}
              </button>
            </div>
          </form>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {filteredClients.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              {pick({
                pt: 'Nenhum cliente cadastrado ainda.',
                en: 'No clients registered yet.',
                es: 'Aún no hay clientes registrados.',
                fr: 'Aucun client enregistré pour le moment.',
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                    <th className="py-3 px-5">{pick({ pt: 'Cliente', en: 'Client', es: 'Cliente', fr: 'Client' })}</th>
                    <th className="py-3 px-5">{pick({ pt: 'Documento', en: 'Tax ID', es: 'Documento', fr: 'Identifiant' })}</th>
                    <th className="py-3 px-5">{pick({ pt: 'E-mail', en: 'Email', es: 'Correo', fr: 'E-mail' })}</th>
                    <th className="py-3 px-5">{pick({ pt: 'Telefone', en: 'Phone', es: 'Teléfono', fr: 'Téléphone' })}</th>
                    <th className="py-3 px-5">{pick({ pt: 'Cidade', en: 'City', es: 'Ciudad', fr: 'Ville' })}</th>
                    <th className="py-3 px-5 text-right">{pick({ pt: 'Ações', en: 'Actions', es: 'Acciones', fr: 'Actions' })}</th>
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
                          aria-label={pick({ pt: 'Remover cliente', en: 'Remove client', es: 'Eliminar cliente', fr: 'Supprimer client' })}
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
            {pick({ pt: 'Produtos', en: 'Products', es: 'Productos', fr: 'Produits' })} ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setCatalogTab('services')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
              catalogTab === 'services' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {pick({ pt: 'Serviços', en: 'Services', es: 'Servicios', fr: 'Services' })} ({services.length})
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] cursor-pointer self-start"
        >
          <Plus className="w-4 h-4" />
          <span>
            {catalogTab === 'products'
              ? pick({ pt: 'Novo Produto', en: 'New Product', es: 'Nuevo Producto', fr: 'Nouveau Produit' })
              : pick({ pt: 'Novo Serviço', en: 'New Service', es: 'Nuevo Servicio', fr: 'Nouveau Service' })}
          </span>
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreateProductOrService}
          className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {pick({ pt: 'Nome *', en: 'Name *', es: 'Nombre *', fr: 'Nom *' })}
            </label>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {pick({ pt: 'Código SKU', en: 'SKU Code', es: 'Código SKU', fr: 'Code SKU' })}
              </label>
              <input
                type="text"
                value={itemSku}
                onChange={(e) => setItemSku(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {pick({ pt: 'Categoria', en: 'Category', es: 'Categoría', fr: 'Catégorie' })}
            </label>
            <input
              type="text"
              value={itemCategory}
              onChange={(e) => setItemCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {pick({ pt: 'Preço de Venda (R$) *', en: 'Selling Price (BRL) *', es: 'Precio de Venta (BRL) *', fr: 'Prix de Vente (BRL) *' })}
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
              {catalogTab === 'products'
                ? pick({ pt: 'Custo Unitário (R$)', en: 'Unit Cost (BRL)', es: 'Costo Unitario (BRL)', fr: 'Coût Unitaire (BRL)' })
                : pick({ pt: 'Custo Estimado (R$)', en: 'Estimated Cost (BRL)', es: 'Costo Estimado (BRL)', fr: 'Coût Estimé (BRL)' })}
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {pick({ pt: 'Estoque', en: 'Stock', es: 'Inventario', fr: 'Stock' })}
              </label>
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
                {pick({ pt: 'Unidade de Cobrança', en: 'Billing Unit', es: 'Unidad de Cobro', fr: 'Unité de Facturation' })}
              </label>
              <input
                type="text"
                value={itemUnit}
                onChange={(e) => setItemUnit(e.target.value)}
                placeholder={pick({ pt: 'Ex: Hora, Projeto, Mensal', en: 'e.g. Hour, Project, Monthly', es: 'Ej: Hora, Proyecto, Mensual', fr: 'Ex : Heure, Projet, Mensuel' })}
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
              {pick({ pt: 'Cancelar', en: 'Cancel', es: 'Cancelar', fr: 'Annuler' })}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg cursor-pointer"
            >
              {saving
                ? pick({ pt: 'Salvando...', en: 'Saving...', es: 'Guardando...', fr: 'Enregistrement...' })
                : pick({ pt: 'Salvar Item', en: 'Save Item', es: 'Guardar Elemento', fr: 'Enregistrer' })}
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
          placeholder={pick({
            pt: 'Filtrar itens...',
            en: 'Filter items...',
            es: 'Filtrar elementos...',
            fr: 'Filtrer les éléments...',
          })}
          className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E40AF]"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {catalogTab === 'products' ? (
          filteredProducts.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              {pick({
                pt: 'Nenhum produto cadastrado.',
                en: 'No products registered.',
                es: 'No hay productos registrados.',
                fr: 'Aucun produit enregistré.',
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                    <th className="py-3 px-5">{pick({ pt: 'Produto', en: 'Product', es: 'Producto', fr: 'Produit' })}</th>
                    <th className="py-3 px-5">SKU</th>
                    <th className="py-3 px-5 text-right">{pick({ pt: 'Preço', en: 'Price', es: 'Precio', fr: 'Prix' })}</th>
                    <th className="py-3 px-5 text-right">{pick({ pt: 'Custo', en: 'Cost', es: 'Costo', fr: 'Coût' })}</th>
                    <th className="py-3 px-5 text-right">{pick({ pt: 'Margem', en: 'Margin', es: 'Margen', fr: 'Marge' })}</th>
                    <th className="py-3 px-5 text-right">{pick({ pt: 'Estoque', en: 'Stock', es: 'Stock', fr: 'Stock' })}</th>
                    <th className="py-3 px-5 text-right">{pick({ pt: 'Ações', en: 'Actions', es: 'Acciones', fr: 'Actions' })}</th>
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
            {pick({
              pt: 'Nenhum serviço cadastrado.',
              en: 'No services registered.',
              es: 'No hay servicios registrados.',
              fr: 'Aucun service enregistré.',
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-5">{pick({ pt: 'Serviço', en: 'Service', es: 'Servicio', fr: 'Service' })}</th>
                  <th className="py-3 px-5">{pick({ pt: 'Categoria', en: 'Category', es: 'Categoría', fr: 'Catégorie' })}</th>
                  <th className="py-3 px-5">{pick({ pt: 'Cobrança', en: 'Billing', es: 'Cobro', fr: 'Facturation' })}</th>
                  <th className="py-3 px-5 text-right">{pick({ pt: 'Preço', en: 'Price', es: 'Precio', fr: 'Prix' })}</th>
                  <th className="py-3 px-5 text-right">{pick({ pt: 'Custo Est.', en: 'Est. Cost', es: 'Costo Est.', fr: 'Coût Est.' })}</th>
                  <th className="py-3 px-5 text-right">{pick({ pt: 'Margem', en: 'Margin', es: 'Margen', fr: 'Marge' })}</th>
                  <th className="py-3 px-5 text-right">{pick({ pt: 'Ações', en: 'Actions', es: 'Acciones', fr: 'Actions' })}</th>
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
