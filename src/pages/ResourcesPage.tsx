import {
  BarChart3,
  Brain,
  CreditCard,
  FileSpreadsheet,
  Lock,
  Package,
  Users,
  Bell,
} from 'lucide-react';
import type { PublicRoute } from '../components/PublicLayout';
import { useLanguage } from '../contexts/LanguageContext';

interface ResourcesPageProps {
  onNavigate: (route: PublicRoute) => void;
}

const MODULE_ICONS = [BarChart3, Package, Users, FileSpreadsheet, Brain, CreditCard, Lock, Bell];

export function ResourcesPage({ onNavigate }: ResourcesPageProps) {
  const { t } = useLanguage();
  const r = t.resources;

  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <div className="max-w-3xl bg-slate-950/75 backdrop-blur-md border border-white/15 rounded-2xl p-8 text-white shadow-xl">
        <p className="text-sm font-medium text-blue-300">{r.eyebrow}</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
          {r.title}
        </h1>
        <p className="mt-4 text-base text-slate-300 leading-relaxed">{r.subtitle}</p>
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
        {r.modules.map((mod, idx) => {
          const Icon = MODULE_ICONS[idx] || BarChart3;
          return (
            <div
              key={mod.code}
              className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-7 flex flex-col justify-between shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-medium text-slate-400">{mod.code}</span>
                  <Icon className="w-5 h-5 text-[#1E40AF]" />
                </div>
                <h2 className="mt-3 font-display text-xl font-bold text-[#0F172A]">{mod.title}</h2>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{mod.summary}</p>
                <ul className="mt-5 space-y-2 pt-4 border-t border-slate-100">
                  {mod.details.map((detail) => (
                    <li key={detail} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className="text-[#1E40AF] font-bold">·</span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-6 bg-white border border-slate-200 rounded-xl p-8">
        <div>
          <h3 className="font-display text-xl font-bold text-[#0F172A]">{r.ctaTitle}</h3>
          <p className="mt-1 text-sm text-slate-600">{r.ctaDesc}</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('plans')}
          className="px-6 py-3 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] transition-colors cursor-pointer"
        >
          {r.ctaBtn}
        </button>
      </div>
    </div>
  );
}
