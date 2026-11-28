import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, OperationType, handleFirestoreError } from '../firebase';
import { addMonthsToDateIso } from '../utils/format';
import type {
  AppNotification,
  AuditLog,
  Company,
  CompanyMember,
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
  UserProfile,
} from '../types';

export function subscribeCompanyCollection<T>(
  collectionName: string,
  companyId: string,
  userId: string,
  onData: (items: T[]) => void
): Unsubscribe {
  const q = query(
    collection(db, collectionName),
    where('userId', '==', userId),
    where('companyId', '==', companyId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d): Record<string, unknown> & { id: string } => ({
          id: d.id,
          ...(d.data() as Record<string, unknown>),
        }))
        .sort((a, b) => {
          const ta = (a.createdAt as { seconds?: number } | undefined)?.seconds || 0;
          const tb = (b.createdAt as { seconds?: number } | undefined)?.seconds || 0;
          return tb - ta;
        }) as unknown as T[];
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, collectionName);
    }
  );
}

export function subscribeUserNotifications(
  userId: string,
  onData: (items: AppNotification[]) => void
): Unsubscribe {
  const q = query(collection(db, 'notifications'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, 'id'>) }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    }
  );
}

export function subscribePublicPlans(onData: (plans: Plan[]) => void): Unsubscribe {
  const q = query(collection(db, 'plans'), orderBy('sortOrder', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Plan, 'id'>) })));
    },
    () => {
      // Fallback without orderBy if index/field absent
      const fallbackQ = collection(db, 'plans');
      onSnapshot(
        fallbackQ,
        (s) => onData(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Plan, 'id'>) }))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'plans')
      );
    }
  );
}

export function subscribeAdminCollection<T>(
  collectionName: string,
  onData: (items: T[]) => void
): Unsubscribe {
  const q = collection(db, collectionName);
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as T[]);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, collectionName)
  );
}

export async function createAuditLog(payload: {
  actorUid: string;
  actorEmail?: string;
  companyId?: string;
  action: string;
  targetCollection: string;
  targetId?: string;
  details?: string;
}): Promise<void> {
  try {
    const clean: Record<string, unknown> = {
      actorUid: payload.actorUid,
      action: payload.action.slice(0, 100),
      targetCollection: payload.targetCollection.slice(0, 60),
      createdAt: serverTimestamp(),
    };
    if (payload.actorEmail) clean.actorEmail = payload.actorEmail.slice(0, 200);
    if (payload.companyId) clean.companyId = payload.companyId.slice(0, 128);
    if (payload.targetId) clean.targetId = payload.targetId.slice(0, 128);
    if (payload.details) clean.details = payload.details.slice(0, 600);
    await addDoc(collection(db, 'audit_logs'), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'audit_logs');
  }
}

export async function createNotification(payload: {
  userId: string;
  companyId?: string;
  title: string;
  message: string;
  category: AppNotification['category'];
}): Promise<void> {
  try {
    const clean: Record<string, unknown> = {
      userId: payload.userId,
      title: payload.title.slice(0, 140),
      message: payload.message.slice(0, 500),
      category: payload.category,
      read: false,
      createdAt: serverTimestamp(),
    };
    if (payload.companyId) clean.companyId = payload.companyId.slice(0, 128);
    await addDoc(collection(db, 'notifications'), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'notifications');
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `notifications/${id}`);
  }
}

// ==================== REVENUES & EXPENSES ====================
export async function addRevenue(
  companyId: string,
  userId: string,
  input: {
    description: string;
    category: string;
    amount: number;
    date: string;
    customerName?: string;
    status: 'received' | 'pending';
    paymentMethod?: string;
    notes?: string;
  }
): Promise<void> {
  const revRef = doc(collection(db, 'revenues'));
  const clean: Record<string, unknown> = {
    companyId,
    userId,
    description: input.description.trim().slice(0, 180),
    category: input.category.trim().slice(0, 80),
    amount: Number(input.amount),
    date: input.date.slice(0, 32),
    status: input.status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.customerName?.trim()) clean.customerName = input.customerName.trim().slice(0, 140);
  if (input.paymentMethod?.trim()) clean.paymentMethod = input.paymentMethod.trim().slice(0, 60);
  if (input.notes?.trim()) clean.notes = input.notes.trim().slice(0, 500);

  try {
    await setDoc(revRef, clean);
    await addDoc(collection(db, 'transactions'), {
      companyId,
      userId,
      type: 'income',
      sourceId: revRef.id,
      description: clean.description,
      category: clean.category,
      amount: clean.amount,
      date: clean.date,
      status: input.status === 'received' ? 'settled' : 'pending',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `revenues/${revRef.id}`);
  }
}

export async function updateRevenue(
  id: string,
  input: Partial<Pick<Revenue, 'description' | 'category' | 'amount' | 'date' | 'customerName' | 'status' | 'paymentMethod' | 'notes'>>
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (input.description !== undefined) payload.description = input.description.trim().slice(0, 180);
  if (input.category !== undefined) payload.category = input.category.trim().slice(0, 80);
  if (input.amount !== undefined) payload.amount = Number(input.amount);
  if (input.date !== undefined) payload.date = input.date.slice(0, 32);
  if (input.customerName !== undefined) payload.customerName = input.customerName.trim().slice(0, 140);
  if (input.status !== undefined) payload.status = input.status;
  if (input.paymentMethod !== undefined) payload.paymentMethod = input.paymentMethod.trim().slice(0, 60);
  if (input.notes !== undefined) payload.notes = input.notes.trim().slice(0, 500);
  try {
    await updateDoc(doc(db, 'revenues', id), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `revenues/${id}`);
  }
}

export async function removeRevenue(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'revenues', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `revenues/${id}`);
  }
}

export async function addExpense(
  companyId: string,
  userId: string,
  input: {
    description: string;
    category: string;
    amount: number;
    date: string;
    supplierName?: string;
    status: 'paid' | 'pending';
    paymentMethod?: string;
    notes?: string;
  }
): Promise<void> {
  const expRef = doc(collection(db, 'expenses'));
  const clean: Record<string, unknown> = {
    companyId,
    userId,
    description: input.description.trim().slice(0, 180),
    category: input.category.trim().slice(0, 80),
    amount: Number(input.amount),
    date: input.date.slice(0, 32),
    status: input.status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.supplierName?.trim()) clean.supplierName = input.supplierName.trim().slice(0, 140);
  if (input.paymentMethod?.trim()) clean.paymentMethod = input.paymentMethod.trim().slice(0, 60);
  if (input.notes?.trim()) clean.notes = input.notes.trim().slice(0, 500);

  try {
    await setDoc(expRef, clean);
    await addDoc(collection(db, 'transactions'), {
      companyId,
      userId,
      type: 'expense',
      sourceId: expRef.id,
      description: clean.description,
      category: clean.category,
      amount: clean.amount,
      date: clean.date,
      status: input.status === 'paid' ? 'settled' : 'pending',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `expenses/${expRef.id}`);
  }
}

export async function updateExpense(
  id: string,
  input: Partial<Pick<Expense, 'description' | 'category' | 'amount' | 'date' | 'supplierName' | 'status' | 'paymentMethod' | 'notes'>>
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (input.description !== undefined) payload.description = input.description.trim().slice(0, 180);
  if (input.category !== undefined) payload.category = input.category.trim().slice(0, 80);
  if (input.amount !== undefined) payload.amount = Number(input.amount);
  if (input.date !== undefined) payload.date = input.date.slice(0, 32);
  if (input.supplierName !== undefined) payload.supplierName = input.supplierName.trim().slice(0, 140);
  if (input.status !== undefined) payload.status = input.status;
  if (input.paymentMethod !== undefined) payload.paymentMethod = input.paymentMethod.trim().slice(0, 60);
  if (input.notes !== undefined) payload.notes = input.notes.trim().slice(0, 500);
  try {
    await updateDoc(doc(db, 'expenses', id), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `expenses/${id}`);
  }
}

export async function removeExpense(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'expenses', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `expenses/${id}`);
  }
}

// ==================== PRODUCTS, SERVICES & CLIENTS ====================
export async function addProduct(
  companyId: string,
  userId: string,
  input: Omit<Product, 'id' | 'companyId' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const clean: Record<string, unknown> = {
    companyId,
    userId,
    name: input.name.trim().slice(0, 140),
    price: Number(input.price),
    cost: Number(input.cost),
    stock: Math.max(0, Math.round(Number(input.stock))),
    active: Boolean(input.active),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.sku?.trim()) clean.sku = input.sku.trim().slice(0, 40);
  if (input.category?.trim()) clean.category = input.category.trim().slice(0, 80);
  if (input.unit?.trim()) clean.unit = input.unit.trim().slice(0, 24);
  try {
    await addDoc(collection(db, 'products'), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'products');
  }
}

export async function removeProduct(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'products', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `products/${id}`);
  }
}

export async function addServiceItem(
  companyId: string,
  userId: string,
  input: Omit<ServiceItem, 'id' | 'companyId' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const clean: Record<string, unknown> = {
    companyId,
    userId,
    name: input.name.trim().slice(0, 140),
    price: Number(input.price),
    estimatedCost: Number(input.estimatedCost),
    active: Boolean(input.active),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.category?.trim()) clean.category = input.category.trim().slice(0, 80);
  if (input.billingUnit?.trim()) clean.billingUnit = input.billingUnit.trim().slice(0, 40);
  try {
    await addDoc(collection(db, 'services'), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'services');
  }
}

export async function removeServiceItem(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'services', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `services/${id}`);
  }
}

export async function addCustomerClient(
  companyId: string,
  userId: string,
  input: Omit<CustomerClient, 'id' | 'companyId' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const clean: Record<string, unknown> = {
    companyId,
    userId,
    name: input.name.trim().slice(0, 140),
    status: input.status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.document?.trim()) clean.document = input.document.trim().slice(0, 32);
  if (input.email?.trim()) clean.email = input.email.trim().slice(0, 200);
  if (input.phone?.trim()) clean.phone = input.phone.trim().slice(0, 32);
  if (input.city?.trim()) clean.city = input.city.trim().slice(0, 100);
  if (input.notes?.trim()) clean.notes = input.notes.trim().slice(0, 500);
  try {
    await addDoc(collection(db, 'clients'), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'clients');
  }
}

export async function removeCustomerClient(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'clients', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `clients/${id}`);
  }
}

// ==================== REPORTS & COMPANY SETTINGS ====================
export async function saveReportSnapshot(
  companyId: string,
  userId: string,
  input: Omit<SavedReport, 'id' | 'companyId' | 'userId' | 'createdAt'>
): Promise<void> {
  const clean: Record<string, unknown> = {
    companyId,
    userId,
    title: input.title.trim().slice(0, 160),
    type: input.type,
    totalRevenue: Number(input.totalRevenue),
    totalExpense: Number(input.totalExpense),
    netProfit: Number(input.netProfit),
    createdAt: serverTimestamp(),
  };
  if (input.periodStart) clean.periodStart = input.periodStart.slice(0, 32);
  if (input.periodEnd) clean.periodEnd = input.periodEnd.slice(0, 32);
  try {
    await addDoc(collection(db, 'reports'), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'reports');
  }
}

export async function updateCompanySettings(
  companyId: string,
  input: Partial<Pick<Company, 'name' | 'tradeName' | 'document' | 'phone' | 'address' | 'sector' | 'logoUrl'>>
): Promise<void> {
  const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (input.name !== undefined) clean.name = input.name.trim().slice(0, 140);
  if (input.tradeName !== undefined) clean.tradeName = input.tradeName.trim().slice(0, 140);
  if (input.document !== undefined) clean.document = input.document.trim().slice(0, 32);
  if (input.phone !== undefined) clean.phone = input.phone.trim().slice(0, 32);
  if (input.address !== undefined) clean.address = input.address.trim().slice(0, 240);
  if (input.sector !== undefined) clean.sector = input.sector.trim().slice(0, 80);
  if (input.logoUrl !== undefined) clean.logoUrl = input.logoUrl.trim().slice(0, 1000);
  try {
    await updateDoc(doc(db, 'companies', companyId), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `companies/${companyId}`);
  }
}

export function subscribeCompanyGoal(
  companyId: string,
  onData: (monthlyGoal: number | null) => void
): Unsubscribe {
  const goalRef = doc(db, 'company_goals', companyId);
  return onSnapshot(
    goalRef,
    (snap) => {
      if (snap.exists()) {
        const val = Number((snap.data() as { monthlyGoal?: number }).monthlyGoal);
        onData(Number.isFinite(val) ? val : 0);
      } else {
        onData(null);
      }
    },
    (err) => {
      console.warn('Erro ao observar meta privada:', err);
    }
  );
}

export async function saveCompanyGoal(
  companyId: string,
  userId: string,
  monthlyGoal: number
): Promise<void> {
  const goalRef = doc(db, 'company_goals', companyId);
  const cleanGoal = Math.max(0, Number(monthlyGoal) || 0);
  try {
    const existing = await getDoc(goalRef);
    if (existing.exists()) {
      await updateDoc(goalRef, {
        monthlyGoal: cleanGoal,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(goalRef, {
        companyId,
        userId,
        monthlyGoal: cleanGoal,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `company_goals/${companyId}`);
  }
}

export async function uploadCompanyLogo(companyId: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64);
  const storageRef = ref(storage, `companies/${companyId}/logos/${Date.now()}_${safeName}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// ==================== SUBSCRIPTIONS ====================
export async function createPendingSubscriptionRecord(input: {
  companyId: string;
  userId: string;
  planId: string;
  planName: string;
  billingCycle: Subscription['billingCycle'];
  discountPercent: number;
  baseMonthlyPrice: number;
  totalAmount: number;
  couponCode?: string;
}): Promise<string> {
  const subRef = doc(collection(db, 'subscriptions'));
  const clean: Record<string, unknown> = {
    companyId: input.companyId,
    userId: input.userId,
    planId: input.planId,
    planName: input.planName.slice(0, 80),
    billingCycle: input.billingCycle,
    discountPercent: Number(input.discountPercent),
    baseMonthlyPrice: Number(input.baseMonthlyPrice),
    totalAmount: Number(input.totalAmount),
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.couponCode?.trim()) clean.couponCode = input.couponCode.trim().slice(0, 40);
  try {
    await setDoc(subRef, clean);
    return subRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `subscriptions/${subRef.id}`);
  }
}

export async function attachMpCheckoutToSubscription(
  subscriptionId: string,
  mpPreapprovalId: string,
  mpInitPoint: string,
  mpStatus: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'subscriptions', subscriptionId), {
      mpPreapprovalId: mpPreapprovalId.slice(0, 160),
      mpInitPoint: mpInitPoint.slice(0, 500),
      mpStatus: mpStatus.slice(0, 40),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `subscriptions/${subscriptionId}`);
  }
}

export async function createPendingPaymentRecord(input: {
  companyId: string;
  userId: string;
  subscriptionId: string;
  amount: number;
  mpPaymentId?: string;
  paymentMethod?: string;
}): Promise<string> {
  const payRef = doc(collection(db, 'payments'));
  const clean: Record<string, unknown> = {
    companyId: input.companyId,
    userId: input.userId,
    subscriptionId: input.subscriptionId,
    amount: Math.max(0, Number(input.amount) || 0),
    currency: 'BRL',
    status: 'pending',
    createdAt: serverTimestamp(),
  };
  if (input.mpPaymentId?.trim()) clean.mpPaymentId = input.mpPaymentId.trim().slice(0, 160);
  if (input.paymentMethod?.trim()) clean.paymentMethod = input.paymentMethod.trim().slice(0, 60);
  try {
    await setDoc(payRef, clean);
    return payRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `payments/${payRef.id}`);
  }
}

export async function syncConfirmedSubscriptionClient(input: {
  subscriptionId: string;
  companyId: string;
  userId: string;
  mpPreapprovalId?: string;
  mpStatus: string;
  nextBillingDate?: string | null;
  paymentDocId?: string;
  paidAt?: string;
}): Promise<void> {
  if (!input.subscriptionId) return;
  const subRef = doc(db, 'subscriptions', input.subscriptionId);
  try {
    const snap = await getDoc(subRef);
    if (!snap.exists()) return;
    const existing = snap.data() as Omit<Subscription, 'id'>;
    if (existing.status === 'suspended' || existing.status === 'cancelled') return;

    const normalizedMpStatus =
      input.mpStatus?.toLowerCase() === 'approved' ? 'approved' : 'authorized';

    if (!existing.mpPreapprovalId && input.mpPreapprovalId && existing.status === 'pending') {
      await updateDoc(subRef, {
        mpPreapprovalId: input.mpPreapprovalId.slice(0, 160),
        mpInitPoint: 'https://www.mercadopago.com.br',
        mpStatus: normalizedMpStatus,
        updatedAt: serverTimestamp(),
      });
    }

    const fallbackNext = addMonthsToDateIso(
      input.paidAt || new Date().toISOString(),
      existing.billingCycle || 'monthly'
    );
    const resolvedNextBilling = (input.nextBillingDate || existing.nextBillingDate || fallbackNext).slice(0, 40);

    if (
      existing.status !== 'authorized' ||
      existing.mpStatus !== normalizedMpStatus ||
      existing.nextBillingDate !== resolvedNextBilling
    ) {
      await updateDoc(subRef, {
        status: 'authorized',
        mpStatus: normalizedMpStatus,
        nextBillingDate: resolvedNextBilling,
        updatedAt: serverTimestamp(),
      });
    }

    const paidAtIso = (input.paidAt || new Date().toISOString()).slice(0, 40);
    if (input.paymentDocId) {
      try {
        const paySnap = await getDoc(doc(db, 'payments', input.paymentDocId));
        if (paySnap.exists() && paySnap.data().status === 'pending') {
          await updateDoc(doc(db, 'payments', input.paymentDocId), {
            status: 'approved',
            paidAt: paidAtIso,
          });
        }
      } catch {
        // ignore payment sync error
      }
    } else {
      try {
        const payQ = query(
          collection(db, 'payments'),
          where('userId', '==', input.userId),
          where('companyId', '==', input.companyId)
        );
        const paySnaps = await getDocs(payQ);
        for (const pDoc of paySnaps.docs) {
          const pData = pDoc.data() as Omit<PaymentRecord, 'id'>;
          if (pData.subscriptionId === input.subscriptionId && pData.status === 'pending') {
            await updateDoc(doc(db, 'payments', pDoc.id), {
              status: 'approved',
              paidAt: paidAtIso,
            });
          }
        }
      } catch {
        // ignore payment list sync error
      }
    }
  } catch (err) {
    console.warn('Erro ao sincronizar assinatura confirmada no Firestore:', err);
  }
}

export async function markSubscriptionOverdueClient(subscriptionId: string): Promise<void> {
  if (!subscriptionId) return;
  try {
    await updateDoc(doc(db, 'subscriptions', subscriptionId), {
      status: 'overdue',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Erro ao marcar assinatura vencida no Firestore:', err);
  }
}

export async function redeemCouponForSubscriptionClient(
  subscriptionId: string,
  couponCode?: string
): Promise<boolean> {
  const cleanCode = couponCode?.trim().toUpperCase();
  if (!subscriptionId || !cleanCode) return false;
  try {
    const subRef = doc(db, 'subscriptions', subscriptionId);
    const subSnap = await getDoc(subRef);
    if (!subSnap.exists()) return false;
    const subData = subSnap.data() as Omit<Subscription, 'id'>;
    if (subData.couponRedeemed === true || subData.status !== 'authorized') {
      return false;
    }

    const couponSnaps = await getDocs(
      query(collection(db, 'coupons'), where('active', '==', true))
    );
    const matchedDoc = couponSnaps.docs.find(
      (d) => (d.data() as Omit<Coupon, 'id'>).code?.trim().toUpperCase() === cleanCode
    );
    if (!matchedDoc) return false;

    const couponRef = doc(db, 'coupons', matchedDoc.id);
    const redeemed = await runTransaction(db, async (tx) => {
      const latestSub = await tx.get(subRef);
      if (!latestSub.exists()) return false;
      const latestSubData = latestSub.data() as Omit<Subscription, 'id'>;
      if (latestSubData.couponRedeemed === true || latestSubData.status !== 'authorized') {
        return false;
      }

      const latestCoupon = await tx.get(couponRef);
      if (!latestCoupon.exists()) return false;
      const cData = latestCoupon.data() as Omit<Coupon, 'id'>;
      if (!cData.active || Number(cData.usedCount || 0) >= Number(cData.maxUses || 0)) {
        return false;
      }

      tx.update(couponRef, {
        usedCount: Number(cData.usedCount || 0) + 1,
        updatedAt: serverTimestamp(),
      });
      tx.update(subRef, {
        couponRedeemed: true,
        updatedAt: serverTimestamp(),
      });
      return true;
    });

    return redeemed;
  } catch (err) {
    console.warn('Erro ao contabilizar uso do cupom:', err);
    return false;
  }
}

export async function markSubscriptionCancelledClient(subscriptionId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'subscriptions', subscriptionId), {
      status: 'cancelled',
      mpStatus: 'cancelled',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `subscriptions/${subscriptionId}`);
  }
}

export async function validateCouponCode(rawCode: string): Promise<{
  valid: boolean;
  coupon?: Coupon;
  reason?: string;
}> {
  const cleanCode = rawCode.trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, reason: 'Informe um código de cupom.' };
  }
  try {
    // Query with where('active', '==', true) so firestore.rules `list` condition passes without composite indexes
    const snap = await getDocs(query(collection(db, 'coupons'), where('active', '==', true)));
    const match = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Coupon, 'id'>) }))
      .find((c) => c.code?.trim().toUpperCase() === cleanCode);

    if (!match) {
      return { valid: false, reason: 'Cupom não encontrado ou inativo.' };
    }
    if (match.expiresAt) {
      const exp = new Date(`${match.expiresAt.slice(0, 10)}T23:59:59`);
      if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
        return { valid: false, reason: 'Este cupom já expirou.' };
      }
    }
    if (typeof match.maxUses === 'number' && typeof match.usedCount === 'number' && match.usedCount >= match.maxUses) {
      return { valid: false, reason: 'Este cupom atingiu o limite máximo de usos.' };
    }
    return { valid: true, coupon: match };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'coupons');
  }
}

// ==================== ADMIN OPERATIONS ====================
export async function adminSavePlan(
  planId: string | null,
  input: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const clean: Record<string, unknown> = {
    name: input.name.trim().slice(0, 80),
    targetAudience: input.targetAudience.trim().slice(0, 120),
    monthlyPrice: Number(input.monthlyPrice),
    discountMonthly: Number(input.discountMonthly),
    discountQuarterly: Number(input.discountQuarterly),
    discountSemiannual: Number(input.discountSemiannual),
    discountAnnual: Number(input.discountAnnual),
    maxUsers: Math.max(1, Math.round(Number(input.maxUsers))),
    maxTransactions: Math.max(1, Math.round(Number(input.maxTransactions))),
    aiQueriesLimit: Math.max(0, Math.round(Number(input.aiQueriesLimit))),
    active: Boolean(input.active),
    updatedAt: serverTimestamp(),
  };
  if (input.description?.trim()) clean.description = input.description.trim().slice(0, 400);
  if (typeof input.maxProducts === 'number') clean.maxProducts = Math.max(1, Math.round(input.maxProducts));
  if (Array.isArray(input.features)) {
    clean.features = input.features.map((f) => f.trim()).filter(Boolean).slice(0, 10);
  }
  if (typeof input.sortOrder === 'number') clean.sortOrder = Math.round(input.sortOrder);

  try {
    if (planId) {
      await updateDoc(doc(db, 'plans', planId), clean);
    } else {
      await addDoc(collection(db, 'plans'), {
        ...clean,
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, planId ? OperationType.UPDATE : OperationType.CREATE, 'plans');
  }
}

export async function adminDeletePlan(planId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'plans', planId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `plans/${planId}`);
  }
}

export async function adminSaveCoupon(
  input: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const clean: Record<string, unknown> = {
    code: input.code.trim().toUpperCase().slice(0, 40),
    discountPercent: Math.min(90, Math.max(1, Number(input.discountPercent))),
    maxUses: Math.max(1, Math.round(Number(input.maxUses))),
    usedCount: Math.max(0, Math.round(Number(input.usedCount || 0))),
    active: Boolean(input.active),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.expiresAt?.trim()) clean.expiresAt = input.expiresAt.trim().slice(0, 40);
  try {
    await addDoc(collection(db, 'coupons'), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'coupons');
  }
}

export async function adminToggleCoupon(couponId: string, active: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'coupons', couponId), { active, updatedAt: serverTimestamp() });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `coupons/${couponId}`);
  }
}

export async function adminDeleteCoupon(couponId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'coupons', couponId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `coupons/${couponId}`);
  }
}

export async function adminUpdateCompanyStatus(
  companyId: string,
  status: Company['status']
): Promise<void> {
  try {
    await updateDoc(doc(db, 'companies', companyId), { status, updatedAt: serverTimestamp() });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `companies/${companyId}`);
  }
}

export async function adminSetCompanyTrial(
  companyId: string,
  input: {
    active: boolean;
    expiresAt?: string;
    note?: string;
  }
): Promise<void> {
  const nowIso = new Date().toISOString().slice(0, 40);
  const payload: Record<string, unknown> = input.active
    ? {
        status: 'trial',
        trialExpiresAt: (input.expiresAt || '').slice(0, 40),
        trialGrantedAt: nowIso,
        trialNote: (input.note || '').trim().slice(0, 80),
        updatedAt: serverTimestamp(),
      }
    : {
        status: 'active',
        trialExpiresAt: '',
        trialGrantedAt: '',
        trialNote: '',
        updatedAt: serverTimestamp(),
      };
  try {
    await updateDoc(doc(db, 'companies', companyId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `companies/${companyId}`);
  }
}

export async function adminUpdateSubscriptionStatus(
  subscriptionId: string,
  status: Subscription['status'],
  nextBillingDate?: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    status,
    adminActivated: status === 'authorized',
    updatedAt: serverTimestamp(),
  };
  if (nextBillingDate?.trim()) {
    payload.nextBillingDate = nextBillingDate.trim().slice(0, 40);
  }
  try {
    await updateDoc(doc(db, 'subscriptions', subscriptionId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `subscriptions/${subscriptionId}`);
  }
}

export async function adminSendBillingNotification(input: {
  userId: string;
  companyId?: string;
  title: string;
  message: string;
}): Promise<void> {
  await createNotification({
    userId: input.userId,
    companyId: input.companyId,
    title: input.title,
    message: input.message,
    category: 'billing',
  });
}

export async function adminDeleteUserDoc(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
  }
}

export async function adminSaveSystemSettings(
  input: Omit<SystemSettings, 'id' | 'updatedAt'>
): Promise<void> {
  const clean = {
    platformName: input.platformName.trim().slice(0, 80),
    supportEmail: input.supportEmail.trim().slice(0, 200),
    mpEnvironment: input.mpEnvironment,
    defaultCurrency: 'BRL',
    maintenanceMode: Boolean(input.maintenanceMode),
    updatedBy: input.updatedBy || '',
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'system_settings', 'global'), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'system_settings/global');
  }
}

export type {
  AppNotification,
  AuditLog,
  Company,
  CompanyMember,
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
  UserProfile,
};
