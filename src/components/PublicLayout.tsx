import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { JorqLogo, JorqSignatureSvg } from './JorqLogo';
import { LanguageSelector } from './LanguageSelector';
import { PWAInstallButton } from './PWAInstallButton';
import { useLanguage } from '../contexts/LanguageContext';

export type PublicRoute = 'home' | 'resources' | 'plans' | 'manual' | 'auth';

interface PublicLayoutProps {
  currentRoute: PublicRoute;
  onNavigate: (route: PublicRoute) => void;
  isAuthenticated: boolean;
  onEnterApp: () => void;
  isAdmin?: boolean;
  onEnterClientMode?: () => void;
  children: React.ReactNode;
}

export function PublicLayout({
  currentRoute,
  onNavigate,
  isAuthenticated,
  onEnterApp,
  isAdmin = false,
  onEnterClientMode,
  children,
}: PublicLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useLanguage();

  const navItems: { id: PublicRoute; label: string }[] = [
    { id: 'home', label: t.nav.home },
    { id: 'resources', label: t.nav.resources },
    { id: 'plans', label: t.nav.plans },
    { id: 'manual', label: t.nav.manual },
  ];

  const handleNav = (id: PublicRoute) => {
    onNavigate(id);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col text-[#0F172A]">
      {/* Strict 3-zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/92 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-6">
          {/* Zone 1: Brand wordmark + rubrica signature */}
          <button
            type="button"
            onClick={() => handleNav('home')}
            className="text-left focus-visible:outline-2 focus-visible:outline-[#1E40AF] rounded-md cursor-pointer whitespace-nowrap shrink-0"
          >
            <JorqLogo showSignature />
          </button>

          {/* Zone 2: 4 single-line navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  currentRoute === item.id
                    ? 'border-[#1E40AF] text-[#0F172A] font-semibold'
                    : 'border-transparent hover:text-[#0F172A] hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Language selector + PWA App shortcut + primary action */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <LanguageSelector compact />
            <PWAInstallButton compact />
            {isAuthenticated && isAdmin && onEnterClientMode && (
              <button
                type="button"
                onClick={onEnterClientMode}
                className="hidden sm:inline-flex items-center justify-center px-3.5 py-2 text-xs sm:text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t.adminNav.clientModeFree}
              </button>
            )}
            <button
              type="button"
              onClick={() => (isAuthenticated ? onEnterApp() : handleNav('auth'))}
              className="hidden sm:inline-flex items-center justify-center px-4 sm:px-5 py-2 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isAuthenticated ? t.nav.accessPanel : t.nav.loginOrSignup}
            </button>
            <button
              type="button"
              aria-label={t.common.openMenu}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-200 px-6 py-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`block w-full text-left py-2.5 text-sm font-medium ${
                  currentRoute === item.id ? 'text-[#1E40AF] font-semibold' : 'text-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
            <div className="pt-2 pb-1 flex flex-col gap-2">
              <LanguageSelector />
              <PWAInstallButton fullWidth />
            </div>
            {isAuthenticated && isAdmin && onEnterClientMode && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onEnterClientMode();
                }}
                className="w-full mt-2 px-4 py-2.5 text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg"
              >
                {t.adminNav.clientModeFree}
              </button>
            )}
            <button
              type="button"
              onClick={() => (isAuthenticated ? onEnterApp() : handleNav('auth'))}
              className="w-full mt-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg"
            >
              {isAuthenticated ? t.nav.accessPanel : t.nav.loginOrSignup}
            </button>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-[#060D1C]/88 backdrop-blur-md text-slate-200 border-t border-white/15 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2 space-y-3">
            <JorqLogo dark showFullTitle />
            <p className="text-sm text-slate-300 max-w-md leading-relaxed">
              {t.footer.description}
            </p>
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-white mb-3">
              {t.footer.platformTitle}
            </h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>
                <button type="button" onClick={() => handleNav('home')} className="hover:text-white cursor-pointer">
                  {t.footer.homeLink}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleNav('resources')} className="hover:text-white cursor-pointer">
                  {t.footer.resourcesLink}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleNav('plans')} className="hover:text-white cursor-pointer">
                  {t.footer.plansLink}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleNav('manual')} className="hover:text-white cursor-pointer">
                  {t.footer.manualLink}
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-white mb-3">
              {t.footer.securityTitle}
            </h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>{t.footer.sec1}</li>
              <li>{t.footer.sec2}</li>
              <li>{t.footer.sec3}</li>
              <li>{t.footer.sec4}</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-5 px-6 pb-14 sm:pb-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <span>{t.footer.copyright}</span>
            <div className="flex items-center gap-4">
              <span>{t.footer.cloudNote}</span>
              <span className="hidden sm:inline-flex items-center pl-3 border-l border-white/15">
                <JorqSignatureSvg dark />
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
