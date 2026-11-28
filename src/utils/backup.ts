import type {
  Company,
  Coupon,
  CustomerClient,
  Expense,
  LedgerTransaction,
  PaymentRecord,
  Plan,
  Product,
  Revenue,
  SavedReport,
  ServiceItem,
  Subscription,
  SystemSettings,
} from '../types';
import type { SupportedLang } from '../i18n/translations';

export const BACKUP_FORMAT = 'jorq-company-backup' as const;
export const ADMIN_BACKUP_FORMAT = 'jorq-admin-backup' as const;
export const BACKUP_VERSION = 1 as const;
export const MAX_BACKUP_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_RECORDS_PER_COLLECTION = 5000;

const LANG_STORAGE_KEY = 'jorq_preferred_language';
const LOCAL_USERS_STORAGE_KEY = 'jorq_local_users_v1';

export interface BackupRevenueItem {
  description: string;
  category: string;
  amount: number;
  date: string;
  customerName?: string;
  status: 'received' | 'pending';
  paymentMethod?: string;
  notes?: string;
}

export interface BackupExpenseItem {
  description: string;
  category: string;
  amount: number;
  date: string;
  supplierName?: string;
  status: 'paid' | 'pending';
  paymentMethod?: string;
  notes?: string;
}

export interface BackupTransactionItem {
  type: 'income' | 'expense';
  sourceId?: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  status: 'settled' | 'pending';
}

export interface BackupProductItem {
  name: string;
  sku?: string;
  category?: string;
  price: number;
  cost: number;
  stock: number;
  unit?: string;
  active: boolean;
}

export interface BackupServiceItem {
  name: string;
  category?: string;
  price: number;
  estimatedCost: number;
  billingUnit?: string;
  active: boolean;
}

export interface BackupClientItem {
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  city?: string;
  status: 'active' | 'inactive';
  notes?: string;
}

export interface BackupReportItem {
  title: string;
  type: 'dre' | 'cashflow' | 'customers' | 'ai_forecast';
  periodStart?: string;
  periodEnd?: string;
  totalRevenue: number;
  totalExpense: number;
  netProfit: number;
}

export interface CompanyBackupPayload {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  sourceCompanyId?: string;
  company: {
    name: string;
    tradeName?: string;
    document?: string;
    phone?: string;
    address?: string;
    sector?: string;
    logoUrl?: string;
    monthlyGoal: number;
  };
  localPreferences: {
    language?: SupportedLang;
    accountName?: string;
    accountEmail?: string;
  };
  data: {
    revenues: BackupRevenueItem[];
    expenses: BackupExpenseItem[];
    transactions: BackupTransactionItem[];
    products: BackupProductItem[];
    services: BackupServiceItem[];
    clients: BackupClientItem[];
    savedReports: BackupReportItem[];
  };
}

export interface BackupCounts {
  revenues: number;
  expenses: number;
  transactions: number;
  products: number;
  services: number;
  clients: number;
  savedReports: number;
  total: number;
}

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function cleanStr(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function cleanOptionalStr(val: unknown, maxLen: number): string | undefined {
  const s = cleanStr(val, maxLen);
  return s.length > 0 ? s : undefined;
}

function cleanPositiveNum(val: unknown): number | null {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Number(n.toFixed(2));
}

function cleanNonNegNum(val: unknown, fallback = 0): number {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Number(n.toFixed(2));
}

function cleanFiniteNum(val: unknown, fallback = 0): number {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Number(n.toFixed(2));
}

function cleanNonNegInt(val: unknown): number {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.max(0, Math.round(n));
}

function cleanDateIso(val: unknown): string {
  const raw = cleanStr(val, 32);
  if (raw.length >= 8 && raw.length <= 32) {
    return raw;
  }
  return new Date().toISOString().slice(0, 10);
}

function cleanSafeHttpsUrl(val: unknown, maxLen = 1000): string | undefined {
  const s = cleanStr(val, maxLen);
  if (!s) return undefined;
  try {
    const parsed = new URL(s);
    if (parsed.protocol === 'https:') {
      return parsed.toString().slice(0, maxLen);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function cleanLang(val: unknown): SupportedLang | undefined {
  if (val === 'pt' || val === 'en' || val === 'es' || val === 'fr') {
    return val;
  }
  return undefined;
}

function readLocalPreferencesSnapshot(userId?: string): CompanyBackupPayload['localPreferences'] {
  const prefs: CompanyBackupPayload['localPreferences'] = {};
  if (typeof window === 'undefined') return prefs;

  try {
    const savedLang = cleanLang(window.localStorage.getItem(LANG_STORAGE_KEY));
    if (savedLang) prefs.language = savedLang;

    const rawUsers = window.localStorage.getItem(LOCAL_USERS_STORAGE_KEY);
    if (rawUsers) {
      const parsed = JSON.parse(rawUsers, (key, val) =>
        DANGEROUS_KEYS.has(key) ? undefined : val
      ) as Record<string, { name?: unknown; email?: unknown }> | null;
      if (parsed && typeof parsed === 'object') {
        const entry = (userId && parsed[userId]) || Object.values(parsed)[0];
        if (entry && typeof entry === 'object') {
          const name = cleanOptionalStr(entry.name, 120);
          const email = cleanOptionalStr(entry.email, 200);
          if (name) prefs.accountName = name;
          if (email) prefs.accountEmail = email;
        }
      }
    }
  } catch {
    // Ignore restricted localStorage environments
  }
  return prefs;
}

export function applyBackupLocalPreferences(
  prefs: CompanyBackupPayload['localPreferences'],
  userId?: string
): SupportedLang | undefined {
  if (typeof window === 'undefined') return undefined;

  let appliedLang: SupportedLang | undefined;
  try {
    const lang = cleanLang(prefs.language);
    if (lang) {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
      appliedLang = lang;
    }

    if (userId && (prefs.accountName || prefs.accountEmail)) {
      const rawUsers = window.localStorage.getItem(LOCAL_USERS_STORAGE_KEY);
      const parsed = rawUsers
        ? (JSON.parse(rawUsers, (key, val) =>
            DANGEROUS_KEYS.has(key) ? undefined : val
          ) as Record<string, Record<string, unknown>>)
        : {};
      if (parsed && typeof parsed === 'object' && parsed[userId]) {
        const current = parsed[userId];
        if (prefs.accountName && (!current.name || current.name === 'Gestor JORQ')) {
          current.name = cleanStr(prefs.accountName, 120);
        }
        window.localStorage.setItem(LOCAL_USERS_STORAGE_KEY, JSON.stringify(parsed));
      }
    }
  } catch {
    // Ignore storage quota errors
  }

  return appliedLang;
}

export function getBackupCounts(payload: CompanyBackupPayload): BackupCounts {
  const revenues = payload.data.revenues.length;
  const expenses = payload.data.expenses.length;
  const transactions = payload.data.transactions.length;
  const products = payload.data.products.length;
  const services = payload.data.services.length;
  const clients = payload.data.clients.length;
  const savedReports = payload.data.savedReports.length;
  return {
    revenues,
    expenses,
    transactions,
    products,
    services,
    clients,
    savedReports,
    total: revenues + expenses + transactions + products + services + clients + savedReports,
  };
}

export function buildCompanyBackupPayload(params: {
  company: Company;
  monthlyGoal: number;
  userId: string;
  revenues: Revenue[];
  expenses: Expense[];
  transactions: LedgerTransaction[];
  products: Product[];
  services: ServiceItem[];
  clients: CustomerClient[];
  savedReports: SavedReport[];
}): CompanyBackupPayload {
  const { company, monthlyGoal, userId } = params;

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    sourceCompanyId: cleanOptionalStr(company.id, 128),
    company: {
      name: cleanStr(company.name, 140) || 'Minha Empresa',
      ...(cleanOptionalStr(company.tradeName, 140)
        ? { tradeName: cleanOptionalStr(company.tradeName, 140) }
        : {}),
      ...(cleanOptionalStr(company.document, 32)
        ? { document: cleanOptionalStr(company.document, 32) }
        : {}),
      ...(cleanOptionalStr(company.phone, 32)
        ? { phone: cleanOptionalStr(company.phone, 32) }
        : {}),
      ...(cleanOptionalStr(company.address, 240)
        ? { address: cleanOptionalStr(company.address, 240) }
        : {}),
      ...(cleanOptionalStr(company.sector, 80)
        ? { sector: cleanOptionalStr(company.sector, 80) }
        : {}),
      ...(cleanSafeHttpsUrl(company.logoUrl, 1000)
        ? { logoUrl: cleanSafeHttpsUrl(company.logoUrl, 1000) }
        : {}),
      monthlyGoal: cleanNonNegNum(monthlyGoal, 0),
    },
    localPreferences: readLocalPreferencesSnapshot(userId),
    data: {
      revenues: params.revenues.slice(0, MAX_RECORDS_PER_COLLECTION).map((r) => ({
        description: cleanStr(r.description, 180),
        category: cleanStr(r.category, 80) || 'Geral',
        amount: cleanPositiveNum(r.amount) ?? 0.01,
        date: cleanDateIso(r.date),
        status: r.status === 'pending' ? 'pending' : 'received',
        ...(cleanOptionalStr(r.customerName, 140)
          ? { customerName: cleanOptionalStr(r.customerName, 140) }
          : {}),
        ...(cleanOptionalStr(r.paymentMethod, 60)
          ? { paymentMethod: cleanOptionalStr(r.paymentMethod, 60) }
          : {}),
        ...(cleanOptionalStr(r.notes, 500) ? { notes: cleanOptionalStr(r.notes, 500) } : {}),
      })),
      expenses: params.expenses.slice(0, MAX_RECORDS_PER_COLLECTION).map((e) => ({
        description: cleanStr(e.description, 180),
        category: cleanStr(e.category, 80) || 'Geral',
        amount: cleanPositiveNum(e.amount) ?? 0.01,
        date: cleanDateIso(e.date),
        status: e.status === 'pending' ? 'pending' : 'paid',
        ...(cleanOptionalStr(e.supplierName, 140)
          ? { supplierName: cleanOptionalStr(e.supplierName, 140) }
          : {}),
        ...(cleanOptionalStr(e.paymentMethod, 60)
          ? { paymentMethod: cleanOptionalStr(e.paymentMethod, 60) }
          : {}),
        ...(cleanOptionalStr(e.notes, 500) ? { notes: cleanOptionalStr(e.notes, 500) } : {}),
      })),
      transactions: params.transactions.slice(0, MAX_RECORDS_PER_COLLECTION).map((t) => ({
        type: t.type === 'expense' ? 'expense' : 'income',
        ...(cleanOptionalStr(t.sourceId, 128)
          ? { sourceId: cleanOptionalStr(t.sourceId, 128) }
          : {}),
        description: cleanStr(t.description, 180),
        category: cleanStr(t.category, 80) || 'Geral',
        amount: cleanPositiveNum(t.amount) ?? 0.01,
        date: cleanDateIso(t.date),
        status: t.status === 'pending' ? 'pending' : 'settled',
      })),
      products: params.products.slice(0, MAX_RECORDS_PER_COLLECTION).map((p) => ({
        name: cleanStr(p.name, 140),
        ...(cleanOptionalStr(p.sku, 40) ? { sku: cleanOptionalStr(p.sku, 40) } : {}),
        ...(cleanOptionalStr(p.category, 80)
          ? { category: cleanOptionalStr(p.category, 80) }
          : {}),
        price: cleanNonNegNum(p.price, 0),
        cost: cleanNonNegNum(p.cost, 0),
        stock: cleanNonNegInt(p.stock),
        ...(cleanOptionalStr(p.unit, 24) ? { unit: cleanOptionalStr(p.unit, 24) } : {}),
        active: Boolean(p.active),
      })),
      services: params.services.slice(0, MAX_RECORDS_PER_COLLECTION).map((s) => ({
        name: cleanStr(s.name, 140),
        ...(cleanOptionalStr(s.category, 80)
          ? { category: cleanOptionalStr(s.category, 80) }
          : {}),
        price: cleanNonNegNum(s.price, 0),
        estimatedCost: cleanNonNegNum(s.estimatedCost, 0),
        ...(cleanOptionalStr(s.billingUnit, 40)
          ? { billingUnit: cleanOptionalStr(s.billingUnit, 40) }
          : {}),
        active: Boolean(s.active),
      })),
      clients: params.clients.slice(0, MAX_RECORDS_PER_COLLECTION).map((c) => ({
        name: cleanStr(c.name, 140),
        ...(cleanOptionalStr(c.document, 32)
          ? { document: cleanOptionalStr(c.document, 32) }
          : {}),
        ...(cleanOptionalStr(c.email, 200) ? { email: cleanOptionalStr(c.email, 200) } : {}),
        ...(cleanOptionalStr(c.phone, 32) ? { phone: cleanOptionalStr(c.phone, 32) } : {}),
        ...(cleanOptionalStr(c.city, 100) ? { city: cleanOptionalStr(c.city, 100) } : {}),
        status: c.status === 'inactive' ? 'inactive' : 'active',
        ...(cleanOptionalStr(c.notes, 500) ? { notes: cleanOptionalStr(c.notes, 500) } : {}),
      })),
      savedReports: params.savedReports.slice(0, MAX_RECORDS_PER_COLLECTION).map((r) => ({
        title: cleanStr(r.title, 160),
        type:
          r.type === 'cashflow' || r.type === 'customers' || r.type === 'ai_forecast'
            ? r.type
            : 'dre',
        ...(cleanOptionalStr(r.periodStart, 32)
          ? { periodStart: cleanOptionalStr(r.periodStart, 32) }
          : {}),
        ...(cleanOptionalStr(r.periodEnd, 32)
          ? { periodEnd: cleanOptionalStr(r.periodEnd, 32) }
          : {}),
        totalRevenue: cleanFiniteNum(r.totalRevenue, 0),
        totalExpense: cleanFiniteNum(r.totalExpense, 0),
        netProfit: cleanFiniteNum(r.netProfit, 0),
      })),
    },
  };
}

export function downloadCompanyBackupJSON(payload: CompanyBackupPayload): string {
  const safeSlug =
    payload.company.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'empresa';
  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = `backup-jorq-${safeSlug}-${dateTag}.json`;

  const jsonContent = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return filename;
}

export function parseAndSanitizeCompanyBackup(rawJsonText: string): {
  payload: CompanyBackupPayload;
  counts: BackupCounts;
} {
  if (typeof rawJsonText !== 'string' || rawJsonText.trim().length === 0) {
    throw new Error('O arquivo de backup está vazio.');
  }
  if (rawJsonText.length > MAX_BACKUP_FILE_BYTES) {
    throw new Error('O arquivo excede o limite máximo de 5 MB.');
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(rawJsonText, (key, val) =>
      DANGEROUS_KEYS.has(key) ? undefined : val
    );
  } catch {
    throw new Error('Arquivo JSON inválido. Selecione um backup exportado pelo JORQ.');
  }

  if (!parsedRaw || typeof parsedRaw !== 'object' || Array.isArray(parsedRaw)) {
    throw new Error('Estrutura de backup inválida.');
  }

  const root = parsedRaw as Record<string, unknown>;
  if (root.format !== BACKUP_FORMAT) {
    throw new Error('Este arquivo não pertence ao formato de backup do JORQ.');
  }
  if (root.version !== BACKUP_VERSION) {
    throw new Error('Versão de backup não suportada.');
  }

  const rawCompany =
    root.company && typeof root.company === 'object' && !Array.isArray(root.company)
      ? (root.company as Record<string, unknown>)
      : {};
  const rawPrefs =
    root.localPreferences &&
    typeof root.localPreferences === 'object' &&
    !Array.isArray(root.localPreferences)
      ? (root.localPreferences as Record<string, unknown>)
      : {};
  const rawData =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : {};

  const asArr = (val: unknown): Record<string, unknown>[] =>
    Array.isArray(val)
      ? val
          .slice(0, MAX_RECORDS_PER_COLLECTION)
          .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object' && !Array.isArray(x)))
      : [];

  const revenues: BackupRevenueItem[] = [];
  for (const item of asArr(rawData.revenues)) {
    const description = cleanStr(item.description, 180);
    const amount = cleanPositiveNum(item.amount);
    if (description.length < 2 || amount === null) continue;
    const customerName = cleanOptionalStr(item.customerName, 140);
    const paymentMethod = cleanOptionalStr(item.paymentMethod, 60);
    const notes = cleanOptionalStr(item.notes, 500);
    revenues.push({
      description,
      category: cleanStr(item.category, 80) || 'Geral',
      amount,
      date: cleanDateIso(item.date),
      status: item.status === 'pending' ? 'pending' : 'received',
      ...(customerName ? { customerName } : {}),
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(notes ? { notes } : {}),
    });
  }

  const expenses: BackupExpenseItem[] = [];
  for (const item of asArr(rawData.expenses)) {
    const description = cleanStr(item.description, 180);
    const amount = cleanPositiveNum(item.amount);
    if (description.length < 2 || amount === null) continue;
    const supplierName = cleanOptionalStr(item.supplierName, 140);
    const paymentMethod = cleanOptionalStr(item.paymentMethod, 60);
    const notes = cleanOptionalStr(item.notes, 500);
    expenses.push({
      description,
      category: cleanStr(item.category, 80) || 'Geral',
      amount,
      date: cleanDateIso(item.date),
      status: item.status === 'pending' ? 'pending' : 'paid',
      ...(supplierName ? { supplierName } : {}),
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(notes ? { notes } : {}),
    });
  }

  const transactions: BackupTransactionItem[] = [];
  for (const item of asArr(rawData.transactions)) {
    const description = cleanStr(item.description, 180);
    const amount = cleanPositiveNum(item.amount);
    if (description.length < 2 || amount === null) continue;
    const sourceId = cleanOptionalStr(item.sourceId, 128);
    transactions.push({
      type: item.type === 'expense' ? 'expense' : 'income',
      ...(sourceId ? { sourceId } : {}),
      description,
      category: cleanStr(item.category, 80) || 'Geral',
      amount,
      date: cleanDateIso(item.date),
      status: item.status === 'pending' ? 'pending' : 'settled',
    });
  }

  const products: BackupProductItem[] = [];
  for (const item of asArr(rawData.products)) {
    const name = cleanStr(item.name, 140);
    if (name.length < 2) continue;
    const sku = cleanOptionalStr(item.sku, 40);
    const category = cleanOptionalStr(item.category, 80);
    const unit = cleanOptionalStr(item.unit, 24);
    products.push({
      name,
      ...(sku ? { sku } : {}),
      ...(category ? { category } : {}),
      price: cleanNonNegNum(item.price, 0),
      cost: cleanNonNegNum(item.cost, 0),
      stock: cleanNonNegInt(item.stock),
      ...(unit ? { unit } : {}),
      active: item.active !== false,
    });
  }

  const services: BackupServiceItem[] = [];
  for (const item of asArr(rawData.services)) {
    const name = cleanStr(item.name, 140);
    if (name.length < 2) continue;
    const category = cleanOptionalStr(item.category, 80);
    const billingUnit = cleanOptionalStr(item.billingUnit, 40);
    services.push({
      name,
      ...(category ? { category } : {}),
      price: cleanNonNegNum(item.price, 0),
      estimatedCost: cleanNonNegNum(item.estimatedCost, 0),
      ...(billingUnit ? { billingUnit } : {}),
      active: item.active !== false,
    });
  }

  const clients: BackupClientItem[] = [];
  for (const item of asArr(rawData.clients)) {
    const name = cleanStr(item.name, 140);
    if (name.length < 2) continue;
    const document = cleanOptionalStr(item.document, 32);
    const email = cleanOptionalStr(item.email, 200);
    const phone = cleanOptionalStr(item.phone, 32);
    const city = cleanOptionalStr(item.city, 100);
    const notes = cleanOptionalStr(item.notes, 500);
    clients.push({
      name,
      ...(document ? { document } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(city ? { city } : {}),
      status: item.status === 'inactive' ? 'inactive' : 'active',
      ...(notes ? { notes } : {}),
    });
  }

  const savedReports: BackupReportItem[] = [];
  for (const item of asArr(rawData.savedReports)) {
    const title = cleanStr(item.title, 160);
    if (title.length < 2) continue;
    const periodStart = cleanOptionalStr(item.periodStart, 32);
    const periodEnd = cleanOptionalStr(item.periodEnd, 32);
    savedReports.push({
      title,
      type:
        item.type === 'cashflow' || item.type === 'customers' || item.type === 'ai_forecast'
          ? item.type
          : 'dre',
      ...(periodStart ? { periodStart } : {}),
      ...(periodEnd ? { periodEnd } : {}),
      totalRevenue: cleanFiniteNum(item.totalRevenue, 0),
      totalExpense: cleanFiniteNum(item.totalExpense, 0),
      netProfit: cleanFiniteNum(item.netProfit, 0),
    });
  }

  const compName = cleanStr(rawCompany.name, 140);
  const tradeName = cleanOptionalStr(rawCompany.tradeName, 140);
  const compDocument = cleanOptionalStr(rawCompany.document, 32);
  const compPhone = cleanOptionalStr(rawCompany.phone, 32);
  const compAddress = cleanOptionalStr(rawCompany.address, 240);
  const compSector = cleanOptionalStr(rawCompany.sector, 80);
  const compLogoUrl = cleanSafeHttpsUrl(rawCompany.logoUrl, 1000);

  const payload: CompanyBackupPayload = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: cleanStr(root.exportedAt, 40) || new Date().toISOString(),
    ...(cleanOptionalStr(root.sourceCompanyId, 128)
      ? { sourceCompanyId: cleanOptionalStr(root.sourceCompanyId, 128) }
      : {}),
    company: {
      name: compName.length >= 2 ? compName : '',
      ...(tradeName ? { tradeName } : {}),
      ...(compDocument ? { document: compDocument } : {}),
      ...(compPhone ? { phone: compPhone } : {}),
      ...(compAddress ? { address: compAddress } : {}),
      ...(compSector ? { sector: compSector } : {}),
      ...(compLogoUrl ? { logoUrl: compLogoUrl } : {}),
      monthlyGoal: cleanNonNegNum(rawCompany.monthlyGoal, 0),
    },
    localPreferences: {
      ...(cleanLang(rawPrefs.language) ? { language: cleanLang(rawPrefs.language) } : {}),
      ...(cleanOptionalStr(rawPrefs.accountName, 120)
        ? { accountName: cleanOptionalStr(rawPrefs.accountName, 120) }
        : {}),
      ...(cleanOptionalStr(rawPrefs.accountEmail, 200)
        ? { accountEmail: cleanOptionalStr(rawPrefs.accountEmail, 200) }
        : {}),
    },
    data: {
      revenues,
      expenses,
      transactions,
      products,
      services,
      clients,
      savedReports,
    },
  };

  return {
    payload,
    counts: getBackupCounts(payload),
  };
}

export interface BackupAdminPlanItem {
  name: string;
  targetAudience: string;
  description?: string;
  monthlyPrice: number;
  discountMonthly: number;
  discountQuarterly: number;
  discountSemiannual: number;
  discountAnnual: number;
  maxUsers: number;
  maxTransactions: number;
  maxProducts?: number;
  aiQueriesLimit: number;
  features: string[];
  active: boolean;
  sortOrder: number;
}

export interface BackupAdminCouponItem {
  code: string;
  discountPercent: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
  expiresAt?: string;
}

export interface AdminPlatformBackupPayload {
  format: typeof ADMIN_BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  adminEmail?: string;
  systemSettings: {
    platformName: string;
    supportEmail: string;
    mpEnvironment: 'sandbox' | 'production';
    defaultCurrency: 'BRL';
    maintenanceMode: boolean;
  };
  localPreferences: {
    language?: SupportedLang;
  };
  config: {
    plans: BackupAdminPlanItem[];
    coupons: BackupAdminCouponItem[];
  };
  archive: {
    companiesCount: number;
    subscriptionsCount: number;
    paymentsCount: number;
    companies: Array<{ id: string; name: string; status: string; sector?: string }>;
    subscriptions: Array<{
      id: string;
      companyId: string;
      planName: string;
      billingCycle: string;
      totalAmount: number;
      status: string;
      nextBillingDate?: string;
    }>;
    payments: Array<{
      id: string;
      companyId: string;
      subscriptionId: string;
      amount: number;
      status: string;
      paymentMethod?: string;
      paidAt?: string;
    }>;
  };
}

export interface AdminBackupCounts {
  plans: number;
  coupons: number;
  companies: number;
  subscriptions: number;
  payments: number;
}

export function buildAdminPlatformBackupPayload(params: {
  adminEmail: string;
  systemSettings: SystemSettings | null;
  platformName: string;
  supportEmail: string;
  mpEnvironment: 'sandbox' | 'production';
  maintenanceMode: boolean;
  plans: Plan[];
  coupons: Coupon[];
  companies: Company[];
  subscriptions: Subscription[];
  payments: PaymentRecord[];
}): AdminPlatformBackupPayload {
  const {
    adminEmail,
    systemSettings,
    platformName,
    supportEmail,
    mpEnvironment,
    maintenanceMode,
    plans,
    coupons,
    companies,
    subscriptions,
    payments,
  } = params;

  const savedLang =
    typeof window !== 'undefined'
      ? cleanLang(window.localStorage.getItem(LANG_STORAGE_KEY))
      : undefined;

  return {
    format: ADMIN_BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    adminEmail: cleanOptionalStr(adminEmail, 200),
    systemSettings: {
      platformName: cleanStr(systemSettings?.platformName || platformName, 80) || 'JORQ Gestão Inteligente',
      supportEmail: cleanStr(systemSettings?.supportEmail || supportEmail, 200) || adminEmail,
      mpEnvironment:
        (systemSettings?.mpEnvironment || mpEnvironment) === 'production'
          ? 'production'
          : 'sandbox',
      defaultCurrency: 'BRL',
      maintenanceMode: Boolean(systemSettings?.maintenanceMode ?? maintenanceMode),
    },
    localPreferences: {
      ...(savedLang ? { language: savedLang } : {}),
    },
    config: {
      plans: plans.slice(0, 200).map((p, idx) => ({
        name: cleanStr(p.name, 80) || `Plano ${idx + 1}`,
        targetAudience: cleanStr(p.targetAudience, 120) || 'Empresas',
        ...(cleanOptionalStr(p.description, 400)
          ? { description: cleanOptionalStr(p.description, 400) }
          : {}),
        monthlyPrice: cleanPositiveNum(p.monthlyPrice) ?? 1,
        discountMonthly: Math.min(100, cleanNonNegNum(p.discountMonthly, 0)),
        discountQuarterly: Math.min(100, cleanNonNegNum(p.discountQuarterly, 0)),
        discountSemiannual: Math.min(100, cleanNonNegNum(p.discountSemiannual, 0)),
        discountAnnual: Math.min(100, cleanNonNegNum(p.discountAnnual, 0)),
        maxUsers: Math.max(1, cleanNonNegInt(p.maxUsers)),
        maxTransactions: Math.max(1, cleanNonNegInt(p.maxTransactions)),
        ...(p.maxProducts !== undefined
          ? { maxProducts: Math.max(1, cleanNonNegInt(p.maxProducts)) }
          : {}),
        aiQueriesLimit: cleanNonNegInt(p.aiQueriesLimit),
        features: Array.isArray(p.features)
          ? p.features
              .slice(0, 10)
              .map((f) => cleanStr(f, 120))
              .filter(Boolean)
          : [],
        active: Boolean(p.active),
        sortOrder: cleanNonNegInt(p.sortOrder ?? idx),
      })),
      coupons: coupons.slice(0, 500).map((c) => ({
        code: cleanStr(c.code, 40).toUpperCase(),
        discountPercent: Math.min(90, Math.max(1, cleanNonNegNum(c.discountPercent, 10))),
        maxUses: Math.max(1, cleanNonNegInt(c.maxUses)),
        usedCount: cleanNonNegInt(c.usedCount),
        active: Boolean(c.active),
        ...(cleanOptionalStr(c.expiresAt, 40)
          ? { expiresAt: cleanOptionalStr(c.expiresAt, 40) }
          : {}),
      })),
    },
    archive: {
      companiesCount: companies.length,
      subscriptionsCount: subscriptions.length,
      paymentsCount: payments.length,
      companies: companies.slice(0, MAX_RECORDS_PER_COLLECTION).map((c) => ({
        id: cleanStr(c.id, 128),
        name: cleanStr(c.name, 140),
        status: cleanStr(c.status, 32),
        ...(cleanOptionalStr(c.sector, 80) ? { sector: cleanOptionalStr(c.sector, 80) } : {}),
      })),
      subscriptions: subscriptions.slice(0, MAX_RECORDS_PER_COLLECTION).map((s) => ({
        id: cleanStr(s.id, 128),
        companyId: cleanStr(s.companyId, 128),
        planName: cleanStr(s.planName, 80),
        billingCycle: cleanStr(s.billingCycle, 24),
        totalAmount: cleanNonNegNum(s.totalAmount, 0),
        status: cleanStr(s.status, 32),
        ...(cleanOptionalStr(s.nextBillingDate, 40)
          ? { nextBillingDate: cleanOptionalStr(s.nextBillingDate, 40) }
          : {}),
      })),
      payments: payments.slice(0, MAX_RECORDS_PER_COLLECTION).map((p) => ({
        id: cleanStr(p.id, 128),
        companyId: cleanStr(p.companyId, 128),
        subscriptionId: cleanStr(p.subscriptionId, 128),
        amount: cleanNonNegNum(p.amount, 0),
        status: cleanStr(p.status, 32),
        ...(cleanOptionalStr(p.paymentMethod, 60)
          ? { paymentMethod: cleanOptionalStr(p.paymentMethod, 60) }
          : {}),
        ...(cleanOptionalStr(p.paidAt, 40) ? { paidAt: cleanOptionalStr(p.paidAt, 40) } : {}),
      })),
    },
  };
}

export function downloadAdminPlatformBackupJSON(payload: AdminPlatformBackupPayload): string {
  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = `backup-admin-jorq-${dateTag}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return filename;
}

export function parseAndSanitizeAdminPlatformBackup(rawJsonText: string): {
  payload: AdminPlatformBackupPayload;
  counts: AdminBackupCounts;
} {
  if (typeof rawJsonText !== 'string' || rawJsonText.trim().length === 0) {
    throw new Error('O arquivo de backup administrativo está vazio.');
  }
  if (rawJsonText.length > MAX_BACKUP_FILE_BYTES) {
    throw new Error('O arquivo excede o limite máximo de 5 MB.');
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(rawJsonText, (key, val) =>
      DANGEROUS_KEYS.has(key) ? undefined : val
    );
  } catch {
    throw new Error('Arquivo JSON inválido.');
  }

  if (!parsedRaw || typeof parsedRaw !== 'object' || Array.isArray(parsedRaw)) {
    throw new Error('Estrutura de backup administrativo inválida.');
  }

  const root = parsedRaw as Record<string, unknown>;
  if (root.format !== ADMIN_BACKUP_FORMAT) {
    throw new Error('Este arquivo não é um backup administrativo do JORQ.');
  }
  if (root.version !== BACKUP_VERSION) {
    throw new Error('Versão de backup administrativo não suportada.');
  }

  const rawSettings =
    root.systemSettings &&
    typeof root.systemSettings === 'object' &&
    !Array.isArray(root.systemSettings)
      ? (root.systemSettings as Record<string, unknown>)
      : {};
  const rawConfig =
    root.config && typeof root.config === 'object' && !Array.isArray(root.config)
      ? (root.config as Record<string, unknown>)
      : {};
  const rawPrefs =
    root.localPreferences &&
    typeof root.localPreferences === 'object' &&
    !Array.isArray(root.localPreferences)
      ? (root.localPreferences as Record<string, unknown>)
      : {};
  const rawArchive =
    root.archive && typeof root.archive === 'object' && !Array.isArray(root.archive)
      ? (root.archive as Record<string, unknown>)
      : {};

  const asArr = (val: unknown): Record<string, unknown>[] =>
    Array.isArray(val)
      ? val
          .slice(0, 500)
          .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object' && !Array.isArray(x)))
      : [];

  const plans: BackupAdminPlanItem[] = [];
  for (const item of asArr(rawConfig.plans)) {
    const name = cleanStr(item.name, 80);
    const targetAudience = cleanStr(item.targetAudience, 120);
    const monthlyPrice = cleanPositiveNum(item.monthlyPrice);
    if (name.length < 2 || targetAudience.length < 2 || monthlyPrice === null) continue;
    const description = cleanOptionalStr(item.description, 400);
    const maxProducts =
      item.maxProducts !== undefined ? Math.max(1, cleanNonNegInt(item.maxProducts)) : undefined;
    plans.push({
      name,
      targetAudience,
      ...(description ? { description } : {}),
      monthlyPrice,
      discountMonthly: Math.min(100, cleanNonNegNum(item.discountMonthly, 0)),
      discountQuarterly: Math.min(100, cleanNonNegNum(item.discountQuarterly, 0)),
      discountSemiannual: Math.min(100, cleanNonNegNum(item.discountSemiannual, 0)),
      discountAnnual: Math.min(100, cleanNonNegNum(item.discountAnnual, 0)),
      maxUsers: Math.max(1, cleanNonNegInt(item.maxUsers)),
      maxTransactions: Math.max(1, cleanNonNegInt(item.maxTransactions)),
      ...(maxProducts !== undefined ? { maxProducts } : {}),
      aiQueriesLimit: cleanNonNegInt(item.aiQueriesLimit),
      features: Array.isArray(item.features)
        ? item.features
            .slice(0, 10)
            .map((f) => cleanStr(f, 120))
            .filter(Boolean)
        : [],
      active: item.active !== false,
      sortOrder: cleanNonNegInt(item.sortOrder),
    });
  }

  const coupons: BackupAdminCouponItem[] = [];
  for (const item of asArr(rawConfig.coupons)) {
    const code = cleanStr(item.code, 40).toUpperCase();
    const discountPercent = cleanNonNegNum(item.discountPercent, 0);
    if (code.length < 3 || discountPercent <= 0 || discountPercent > 90) continue;
    const expiresAt = cleanOptionalStr(item.expiresAt, 40);
    coupons.push({
      code,
      discountPercent,
      maxUses: Math.max(1, cleanNonNegInt(item.maxUses)),
      usedCount: cleanNonNegInt(item.usedCount),
      active: item.active !== false,
      ...(expiresAt ? { expiresAt } : {}),
    });
  }

  const payload: AdminPlatformBackupPayload = {
    format: ADMIN_BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: cleanStr(root.exportedAt, 40) || new Date().toISOString(),
    ...(cleanOptionalStr(root.adminEmail, 200)
      ? { adminEmail: cleanOptionalStr(root.adminEmail, 200) }
      : {}),
    systemSettings: {
      platformName: cleanStr(rawSettings.platformName, 80) || 'JORQ Gestão Inteligente',
      supportEmail: cleanStr(rawSettings.supportEmail, 200) || '',
      mpEnvironment: rawSettings.mpEnvironment === 'production' ? 'production' : 'sandbox',
      defaultCurrency: 'BRL',
      maintenanceMode: Boolean(rawSettings.maintenanceMode),
    },
    localPreferences: {
      ...(cleanLang(rawPrefs.language) ? { language: cleanLang(rawPrefs.language) } : {}),
    },
    config: {
      plans,
      coupons,
    },
    archive: {
      companiesCount: cleanNonNegInt(rawArchive.companiesCount),
      subscriptionsCount: cleanNonNegInt(rawArchive.subscriptionsCount),
      paymentsCount: cleanNonNegInt(rawArchive.paymentsCount),
      companies: [],
      subscriptions: [],
      payments: [],
    },
  };

  return {
    payload,
    counts: {
      plans: plans.length,
      coupons: coupons.length,
      companies: payload.archive.companiesCount,
      subscriptions: payload.archive.subscriptionsCount,
      payments: payload.archive.paymentsCount,
    },
  };
}
