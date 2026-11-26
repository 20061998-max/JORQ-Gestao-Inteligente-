import { ArrowRight, Building2 } from 'lucide-react';
import type { PublicRoute } from '../components/PublicLayout';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { useLanguage } from '../contexts/LanguageContext';

interface LandingPageProps {
  onNavigate: (route: PublicRoute) => void;
  isAuthenticated: boolean;
  onEnterApp: () => void;
}

export function LandingPage({ onNavigate, isAuthenticated, onEnterApp }: LandingPageProps) {
  const { t } = useLanguage();
  const l = t.landing;

  return (
    <div>
      {/* 1. Executive Hero Section showcasing the JORQ visual background */}
      <section className="relative overflow-hidden bg-gradient-to-r from-[#060D1E]/90 via-[#060D1E]/72 to-[#060D1E]/25 text-white border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-16 lg:pt-16 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-sm font-medium text-blue-300 mb-3">{l.eyebrow}</p>
              <h1
                className="font-display font-bold tracking-tight text-white leading-[1.08] [text-wrap:balance]"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)' }}
              >
                {l.heroTitle}
              </h1>
              <p className="mt-5 text-base text-slate-200 leading-relaxed max-w-xl">
                {l.heroSubtitle}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => (isAuthenticated ? onEnterApp() : onNavigate('auth'))}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1D4ED8] transition-colors cursor-pointer"
                >
                  <span>{isAuthenticated ? l.ctaPrimaryAuth : l.ctaPrimaryGuest}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('plans')}
                  className="px-5 py-3 text-sm font-semibold text-white bg-white/10 backdrop-blur-sm border border-white/25 rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
                >
                  {l.ctaSecondary}
                </button>
                <PWAInstallButton />
              </div>
            </div>

            <div className="lg:col-span-6 flex items-end justify-end">
              <div className="w-full min-h-[280px] lg:min-h-[340px] rounded-xl overflow-hidden border border-white/20 bg-slate-950/20 backdrop-blur-[1px] relative flex items-end p-6 shadow-2xl">
                <img
                  src="/assets/aistudio/image_2b59ebc8_faaaa2a5.jpg"
                  alt={l.heroImgAlt}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover object-right opacity-95"
                />
                <div className="relative z-10 w-full rounded-lg bg-slate-950/75 backdrop-blur-md border border-white/15 p-5">
                  <p className="text-xs font-medium text-blue-300">{l.heroBadgeTop}</p>
                  <p className="mt-1 text-base font-display font-semibold text-white">
                    {l.heroBadgeBottom}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4-column proof strip directly below hero split */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-6 rounded-xl bg-slate-950/65 backdrop-blur-md border border-white/15">
            <div>
              <p className="font-mono tabular-nums text-2xl font-semibold text-white">{l.proof1Title}</p>
              <p className="mt-1 text-sm text-slate-300">{l.proof1Desc}</p>
            </div>
            <div>
              <p className="font-mono tabular-nums text-2xl font-semibold text-white">{l.proof2Title}</p>
              <p className="mt-1 text-sm text-slate-300">{l.proof2Desc}</p>
            </div>
            <div>
              <p className="font-mono tabular-nums text-2xl font-semibold text-white">{l.proof3Title}</p>
              <p className="mt-1 text-sm text-slate-300">{l.proof3Desc}</p>
            </div>
            <div>
              <p className="font-mono tabular-nums text-2xl font-semibold text-white">{l.proof4Title}</p>
              <p className="mt-1 text-sm text-slate-300">{l.proof4Desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Asymmetric Bento Grid of Core Capabilities */}
      <section className="bg-white/94 backdrop-blur-md border-y border-slate-200 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-tight text-[#0F172A] [text-wrap:balance]">
              {l.bentoHeading}
            </h2>
            <p className="mt-3 text-base text-slate-600">{l.bentoSubheading}</p>
          </div>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#F8FAFC] border border-slate-200 rounded-xl p-8">
              <p className="text-sm font-semibold text-[#1E40AF]">{l.cap1Tag}</p>
              <h3 className="mt-2 font-display text-2xl font-bold text-[#0F172A]">{l.cap1Title}</h3>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed max-w-2xl">{l.cap1Desc}</p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-200">
                <div>
                  <p className="text-xs text-slate-500">{l.cap1Col1Label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{l.cap1Col1Val}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{l.cap1Col2Label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{l.cap1Col2Val}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{l.cap1Col3Label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{l.cap1Col3Val}</p>
                </div>
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-8 flex flex-col justify-between">
              <div>
                <p className="text-sm font-semibold text-[#1E40AF]">{l.cap2Tag}</p>
                <h3 className="mt-2 font-display text-xl font-bold text-[#0F172A]">{l.cap2Title}</h3>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">{l.cap2Desc}</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('resources')}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E40AF] hover:underline cursor-pointer"
              >
                <span>{l.cap2Link}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-8">
              <p className="text-sm font-semibold text-[#1E40AF]">{l.cap3Tag}</p>
              <h3 className="mt-2 font-display text-xl font-bold text-[#0F172A]">{l.cap3Title}</h3>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">{l.cap3Desc}</p>
            </div>

            <div className="lg:col-span-2 bg-[#F8FAFC] border border-slate-200 rounded-xl p-8 flex flex-col justify-between">
              <div>
                <p className="text-sm font-semibold text-[#1E40AF]">{l.cap4Tag}</p>
                <h3 className="mt-2 font-display text-xl font-bold text-[#0F172A]">{l.cap4Title}</h3>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed max-w-2xl">{l.cap4Desc}</p>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4 sm:gap-6 text-xs font-medium text-slate-500">
                {l.cap4Cycles.map((cycleLabel, idx) => (
                  <span key={cycleLabel} className="inline-flex items-center gap-4">
                    <span>{cycleLabel}</span>
                    {idx < l.cap4Cycles.length - 1 && <span aria-hidden="true">/</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Proof of Impact & Case Study */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="bg-white/94 backdrop-blur-md border border-slate-200 rounded-2xl p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch shadow-xl">
          <div className="lg:col-span-5 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
            <img
              src="/src/assets/images/jorq_boardroom_team_1795679542405.jpg"
              alt={l.caseImgAlt}
              referrerPolicy="no-referrer"
              className="w-full h-full lg:h-full object-cover min-h-[300px]"
            />
          </div>
          <div className="lg:col-span-7 flex flex-col justify-center">
            <p className="text-sm font-medium text-[#1E40AF]">{l.caseEyebrow}</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#0F172A] [text-wrap:balance]">
              {l.caseTitle}
            </h2>
            <p className="mt-4 text-base text-slate-600 leading-relaxed">{l.caseDesc}</p>

            <div className="mt-8 p-6 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-4">
              <img
                src="/src/assets/images/avatar_client_exec_1795679542605.jpg"
                alt={l.testimonialAvatarAlt}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-full object-cover shrink-0 border border-slate-200"
              />
              <div>
                <p className="text-sm text-slate-700 leading-relaxed">{l.testimonialQuote}</p>
                <p className="mt-2 text-xs font-medium text-slate-500">{l.testimonialAuthor}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Final CTA Banner */}
      <section className="max-w-7xl mx-auto px-6 pb-8">
        <div className="bg-slate-950/85 backdrop-blur-md border border-white/15 text-white rounded-2xl p-10 lg:p-14 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 shadow-2xl">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-blue-300 mb-3">
              <Building2 className="w-4 h-4" />
              <span>{l.bottomEyebrow}</span>
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight [text-wrap:balance]">
              {l.bottomTitle}
            </h2>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed">{l.bottomDesc}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={() => (isAuthenticated ? onEnterApp() : onNavigate('auth'))}
              className="px-6 py-3 text-sm font-semibold text-[#0F172A] bg-white rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {isAuthenticated ? l.bottomPrimaryAuth : l.bottomPrimaryGuest}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('plans')}
              className="px-6 py-3 text-sm font-semibold text-white border border-slate-600 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {l.bottomSecondary}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
