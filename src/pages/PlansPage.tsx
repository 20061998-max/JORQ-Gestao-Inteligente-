import { useEffect, useState } from 'react';
import { Check, Info } from 'lucide-react';
import { subscribePublicPlans, type Plan } from '../services/firestoreService';
import { calculatePlanPrice, formatBRL, getBillingCycles } from '../utils/format';
import { useLanguage } from '../contexts/LanguageContext';
import type { BillingCycle } from '../types';
import type { PublicRoute } from '../components/PublicLayout';

interface PlansPageProps {
  onNavigate: (route: PublicRoute) => void;
  isAuthenticated: boolean;
  onSelectPlanForCheckout: (plan: Plan, cycle: BillingCycle) => void;
}

export function PlansPage({
  onNavigate,
  isAuthenticated,
  onSelectPlanForCheckout,
}: PlansPageProps) {
  const { lang, t } = useLanguage();
  const p = t.plans;
  const cycles = getBillingCycles(lang);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');

  useEffect(() => {
    const unsub = subscribePublicPlans((items) => {
      setPlans(items.filter((item) => item.active));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <div className="max-w-3xl bg-slate-950/75 backdrop-blur-md border border-white/15 rounded-2xl p-8 text-white shadow-xl">
        <p className="text-sm font-medium text-blue-300">{p.eyebrow}</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
          {p.title}
        </h1>
        <p className="mt-4 text-base text-slate-300 leading-relaxed">{p.subtitle}</p>
      </div>

      {/* Interactive Billing Cycle Filter */}
      <div className="mt-8 inline-flex flex-wrap items-center gap-1 p-1.5 bg-slate-100 border border-slate-200 rounded-xl">
        {cycles.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCycle(item.id)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              cycle === item.id
                ? 'bg-white text-[#0F172A] shadow-sm'
                : 'text-slate-600 hover:text-[#0F172A]'
            }`}
          >
            {item.label}
            {item.defaultDiscount > 0 ? ` · ${item.defaultDiscount}% ${p.discountShort}` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-96 bg-white border border-slate-200 rounded-xl animate-pulse p-8" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="mt-10 bg-white border border-slate-200 rounded-xl p-10 max-w-2xl">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-[#1E40AF] shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-lg font-bold text-[#0F172A]">{p.emptyTitle}</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{p.emptyDesc}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('auth')}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] cursor-pointer"
                >
                  {isAuthenticated ? p.emptyAuthBtn : p.emptyGuestBtn}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const calc = calculatePlanPrice(plan, cycle);
            return (
              <div
                key={plan.id}
                className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-between"
              >
                <div>
                  <p className="text-xs font-medium text-[#1E40AF]">{plan.targetAudience}</p>
                  <h2 className="mt-1.5 font-display text-2xl font-bold text-[#0F172A]">
                    {plan.name}
                  </h2>
                  {plan.description && (
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">{plan.description}</p>
                  )}

                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono tabular-nums text-3xl font-bold text-[#0F172A]">
                        {formatBRL(calc.finalTotal)}
                      </span>
                      <span className="text-xs text-slate-500">
                        / {calc.months === 1 ? t.common.monthSingular : `${calc.months} ${t.common.monthsPlural}`}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                      {p.equivalentTo} {formatBRL(calc.monthlyEquivalent)}
                      {t.common.perMonth}
                      {calc.cycleDiscountPercent > 0
                        ? ` (${calc.cycleDiscountPercent}% ${p.discountApplied})`
                        : ` (${p.noDiscount})`}
                    </p>
                  </div>

                  <div className="mt-6 space-y-2.5 text-sm text-slate-700">
                    <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">{p.allowedUsers}</span>
                      <span className="font-mono tabular-nums font-semibold">{plan.maxUsers}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">{p.monthlyEntries}</span>
                      <span className="font-mono tabular-nums font-semibold">
                        {plan.maxTransactions}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">{p.aiQueriesMonth}</span>
                      <span className="font-mono tabular-nums font-semibold">
                        {plan.aiQueriesLimit}
                      </span>
                    </div>
                  </div>

                  {plan.features && plan.features.length > 0 && (
                    <ul className="mt-5 space-y-2">
                      {plan.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2 text-xs text-slate-600">
                          <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onSelectPlanForCheckout(plan, cycle)}
                  className="mt-8 w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] transition-colors cursor-pointer"
                >
                  {isAuthenticated ? p.ctaAuth : p.ctaGuest}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
