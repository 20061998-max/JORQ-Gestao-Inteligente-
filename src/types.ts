import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'client' | 'admin';
export type BillingCycle = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  companyId?: string;
  status: 'active' | 'suspended';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Company {
  id: string;
  ownerId: string;
  name: string;
  tradeName?: string;
  document?: string;
  phone?: string;
  address?: string;
  sector?: string;
  logoUrl?: string;
  monthlyGoal?: number;
  status: 'active' | 'suspended' | 'trial';
  trialExpiresAt?: string;
  trialGrantedAt?: string;
  trialNote?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CompanyMember {
  id: string;
  companyId: string;
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'manager' | 'viewer';
  status: 'active' | 'invited' | 'suspended';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Plan {
  id: string;
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
  features?: string[];
  active: boolean;
  sortOrder?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Coupon {
  id: string;
  code: string;
  discountPercent: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
  expiresAt?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Subscription {
  id: string;
  companyId: string;
  userId: string;
  planId: string;
  planName: string;
  billingCycle: BillingCycle;
  discountPercent: number;
  baseMonthlyPrice: number;
  totalAmount: number;
  couponCode?: string;
  couponRedeemed?: boolean;
  adminActivated?: boolean;
  status: 'pending' | 'authorized' | 'paused' | 'cancelled' | 'overdue' | 'suspended';
  mpPreapprovalId?: string;
  mpInitPoint?: string;
  mpStatus?: string;
  nextBillingDate?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PaymentRecord {
  id: string;
  companyId: string;
  userId: string;
  subscriptionId: string;
  amount: number;
  currency: 'BRL';
  status: 'approved' | 'pending' | 'rejected' | 'cancelled' | 'refunded';
  mpPaymentId?: string;
  paymentMethod?: string;
  paidAt?: string;
  createdAt?: Timestamp;
}

export interface Revenue {
  id: string;
  companyId: string;
  userId: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  customerName?: string;
  status: 'received' | 'pending';
  paymentMethod?: string;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Expense {
  id: string;
  companyId: string;
  userId: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  supplierName?: string;
  status: 'paid' | 'pending';
  paymentMethod?: string;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface LedgerTransaction {
  id: string;
  companyId: string;
  userId: string;
  type: 'income' | 'expense';
  sourceId?: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  status: 'settled' | 'pending';
  createdAt?: Timestamp;
}

export interface Product {
  id: string;
  companyId: string;
  userId: string;
  name: string;
  sku?: string;
  category?: string;
  price: number;
  cost: number;
  stock: number;
  unit?: string;
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ServiceItem {
  id: string;
  companyId: string;
  userId: string;
  name: string;
  category?: string;
  price: number;
  estimatedCost: number;
  billingUnit?: string;
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CustomerClient {
  id: string;
  companyId: string;
  userId: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  city?: string;
  status: 'active' | 'inactive';
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface SavedReport {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  type: 'dre' | 'cashflow' | 'customers' | 'ai_forecast';
  periodStart?: string;
  periodEnd?: string;
  totalRevenue: number;
  totalExpense: number;
  netProfit: number;
  createdAt?: Timestamp;
}

export interface AppNotification {
  id: string;
  companyId?: string;
  userId: string;
  title: string;
  message: string;
  category: 'billing' | 'finance' | 'system' | 'ai';
  read: boolean;
  createdAt?: Timestamp;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail?: string;
  companyId?: string;
  action: string;
  targetCollection: string;
  targetId?: string;
  details?: string;
  createdAt?: Timestamp;
}

export interface SystemSettings {
  id: string;
  platformName: string;
  supportEmail: string;
  mpEnvironment: 'sandbox' | 'production';
  defaultCurrency: 'BRL';
  maintenanceMode: boolean;
  updatedBy?: string;
  updatedAt?: Timestamp;
}
