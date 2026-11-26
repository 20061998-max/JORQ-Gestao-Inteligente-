import { BookOpen, HelpCircle, ShieldCheck, TrendingUp } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export function HelpManualPage() {
  const { t } = useLanguage();
  const m = t.manual;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
      <div className="bg-slate-950/75 backdrop-blur-md border border-white/15 rounded-2xl p-8 text-white shadow-xl">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-blue-300 mb-2">
          <BookOpen className="w-4 h-4" />
          <span>{m.eyebrow}</span>
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">
          {m.title}
        </h1>
        <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-2xl">{m.subtitle}</p>
      </div>

      {/* Dictionary of Indicators */}
      <section className="space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/95 border border-slate-200 shadow-sm">
          <TrendingUp className="w-5 h-5 text-[#1E40AF]" />
          <h2 className="font-display text-lg font-bold text-[#0F172A]">{m.indicatorsTitle}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {m.indicators.map((item) => (
            <div key={item.term} className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-6 shadow-md">
              <h3 className="font-display text-base font-bold text-[#0F172A]">{item.term}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.explanation}</p>
              <p className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                <strong className="text-slate-700">{m.inPractice}</strong> {item.tip}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Step-by-step Workflow */}
      <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-[#1E40AF]" />
          <h2 className="font-display text-xl font-bold text-[#0F172A]">{m.stepsTitle}</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {m.steps.map((s) => (
            <div key={s.step} className="py-4 first:pt-0 last:pb-0">
              <h3 className="font-display text-sm font-bold text-[#0F172A]">{s.step}</h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">{s.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Security & Subscription note */}
      <section className="bg-slate-900 text-white rounded-xl p-8 flex items-start gap-4">
        <ShieldCheck className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-display text-lg font-bold">{m.securityTitle}</h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">{m.securityDesc}</p>
        </div>
      </section>
    </div>
  );
}
