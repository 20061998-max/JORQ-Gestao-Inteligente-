import type { BillingCycle, Plan } from '../types';

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const clean = dateStr.slice(0, 10);
  const [y, m, d] = clean.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

export const BILLING_CYCLES: {
  id: BillingCycle;
  label: string;
  months: number;
  defaultDiscount: number;
}[] = [
  { id: 'monthly', label: 'Mensal', months: 1, defaultDiscount: 0 },
  { id: 'quarterly', label: 'Trimestral', months: 3, defaultDiscount: 3 },
  { id: 'semiannual', label: 'Semestral', months: 6, defaultDiscount: 5 },
  { id: 'annual', label: 'Anual', months: 12, defaultDiscount: 8 },
];

export function calculatePlanPrice(
  plan: Plan,
  cycle: BillingCycle,
  couponDiscountPercent = 0
): {
  months: number;
  grossTotal: number;
  cycleDiscountPercent: number;
  afterCycleTotal: number;
  finalTotal: number;
  monthlyEquivalent: number;
} {
  const cycleMeta = BILLING_CYCLES.find((c) => c.id === cycle) || BILLING_CYCLES[0];
  const discountMap: Record<BillingCycle, number> = {
    monthly: plan.discountMonthly ?? 0,
    quarterly: plan.discountQuarterly ?? 3,
    semiannual: plan.discountSemiannual ?? 5,
    annual: plan.discountAnnual ?? 8,
  };

  const months = cycleMeta.months;
  const cycleDiscountPercent = discountMap[cycle];
  const grossTotal = Number((plan.monthlyPrice * months).toFixed(2));
  const afterCycleTotal = Number((grossTotal * (1 - cycleDiscountPercent / 100)).toFixed(2));
  const couponFactor = 1 - Math.max(0, Math.min(90, couponDiscountPercent)) / 100;
  const finalTotal = Number((afterCycleTotal * couponFactor).toFixed(2));
  const monthlyEquivalent = Number((finalTotal / months).toFixed(2));

  return {
    months,
    grossTotal,
    cycleDiscountPercent,
    afterCycleTotal,
    finalTotal,
    monthlyEquivalent,
  };
}

export function translateSubscriptionStatus(status: string): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
} {
  switch (status) {
    case 'authorized':
    case 'active':
      return { label: 'Ativa', tone: 'success' };
    case 'pending':
      return { label: 'Aguardando pagamento', tone: 'warning' };
    case 'overdue':
      return { label: 'Inadimplente', tone: 'danger' };
    case 'suspended':
      return { label: 'Suspensa', tone: 'danger' };
    case 'cancelled':
      return { label: 'Cancelada', tone: 'neutral' };
    case 'paused':
      return { label: 'Pausada', tone: 'warning' };
    default:
      return { label: status || 'Pendente', tone: 'neutral' };
  }
}
