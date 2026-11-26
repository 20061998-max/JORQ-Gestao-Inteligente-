import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { JorqLogo } from './JorqLogo';

export type PublicRoute = 'home' | 'resources' | 'plans' | 'manual' | 'auth';

interface PublicLayoutProps {
  currentRoute: PublicRoute;
  onNavigate: (route: PublicRoute) => void;
  isAuthenticated: boolean;
  onEnterApp: () => void;
  children: React.ReactNode;
}

export function PublicLayout({
  currentRoute,
  onNavigate,
  isAuthenticated,
  onEnterApp,
  children,
}: PublicLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: PublicRoute; label: string }[] = [
    { id: 'home', label: 'Início' },
    { id: 'resources', label: 'Recursos' },
    { id: 'plans', label: 'Planos' },
    { id: 'manual', label: 'Manual' },
  ];

  const handleNav = (id: PublicRoute) => {
    onNavigate(id);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Strict 3-zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand wordmark + rubrica signature */}
          <button
            type="button"
            onClick={() => handleNav('home')}
            className="text-left focus-visible:outline-2 focus-visible:outline-[#1E40AF] rounded-md cursor-pointer whitespace-nowrap shrink-0"
          >
            <JorqLogo showSignature />
          </button>

          {/* Zone 2: 4 single-line navigation links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
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

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => (isAuthenticated ? onEnterApp() : handleNav('auth'))}
              className="hidden sm:inline-flex items-center justify-center px-5 py-2 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isAuthenticated ? 'Acessar Painel' : 'Entrar ou Criar Conta'}
            </button>
            <button
              type="button"
              aria-label="Abrir menu"
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
            <button
              type="button"
              onClick={() => (isAuthenticated ? onEnterApp() : handleNav('auth'))}
              className="w-full mt-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg"
            >
              {isAuthenticated ? 'Acessar Painel' : 'Entrar ou Criar Conta'}
            </button>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-white border-t border-slate-200 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2 space-y-3">
            <JorqLogo showFullTitle />
            <p className="text-sm text-slate-600 max-w-md leading-relaxed">
              Plataforma corporativa de controle financeiro, fluxo de caixa, catálogo comercial e
              análise gerencial com inteligência artificial para empresas brasileiras.
            </p>
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">Plataforma</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <button type="button" onClick={() => handleNav('home')} className="hover:text-slate-900 cursor-pointer">
                  Página Inicial
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleNav('resources')} className="hover:text-slate-900 cursor-pointer">
                  Recursos do Sistema
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleNav('plans')} className="hover:text-slate-900 cursor-pointer">
                  Planos e Assinaturas
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleNav('manual')} className="hover:text-slate-900 cursor-pointer">
                  Manual de Utilização
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">Segurança e Dados</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>Isolamento lógico por empresa</li>
              <li>Pagamentos via Mercado Pago</li>
              <li>Exportação PDF e CSV</li>
              <li>Auditoria contínua</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-200 py-5 px-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <span>JORQ Gestão Inteligente — Todos os direitos reservados.</span>
            <span>Infraestrutura em nuvem com criptografia e verificação em dois níveis.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
