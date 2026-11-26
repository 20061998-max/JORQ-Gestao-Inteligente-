import { ArrowRight, Building2 } from 'lucide-react';
import type { PublicRoute } from '../components/PublicLayout';

interface LandingPageProps {
  onNavigate: (route: PublicRoute) => void;
  isAuthenticated: boolean;
  onEnterApp: () => void;
}

export function LandingPage({ onNavigate, isAuthenticated, onEnterApp }: LandingPageProps) {
  return (
    <div>
      {/* 1. Split-Column Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-12 pb-16 lg:pt-16 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-sm font-medium text-[#1E40AF] mb-3">
              Gestão Empresarial · Controle Financeiro · Inteligência Aplicada
            </p>
            <h1
              className="font-display font-bold tracking-tight text-[#0F172A] leading-[1.08] [text-wrap:balance]"
              style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)' }}
            >
              Clareza financeira e controle operacional para sua empresa decidir com segurança.
            </h1>
            <p className="mt-5 text-base text-slate-600 leading-relaxed max-w-xl">
              Centralize receitas, despesas, fluxo de caixa, clientes, produtos e previsões com
              inteligência artificial em um painel exclusivo, projetado para gestores que precisam
              de números confiáveis sem planilhas complexas.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => (isAuthenticated ? onEnterApp() : onNavigate('auth'))}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] transition-colors cursor-pointer"
              >
                <span>{isAuthenticated ? 'Abrir Meu Painel' : 'Criar Conta Empresarial'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('plans')}
                className="px-5 py-3 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Consultar Planos
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[340px] rounded-xl overflow-hidden border border-slate-200 bg-slate-900 relative">
              <img
                src="/src/assets/images/hero_jorq_workspace_1795679542071.jpg"
                alt="Ambiente executivo corporativo da plataforma JORQ Gestão Inteligente"
                referrerPolicy="no-referrer"
                className="w-full h-full lg:h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/15 to-transparent flex items-end p-6">
                <div className="text-white max-w-md">
                  <p className="text-xs font-medium text-slate-200">
                    Ambiente Isolado por Empresa · Auditoria Contínua
                  </p>
                  <p className="mt-1 text-base font-display font-semibold">
                    Indicadores explicados em linguagem simples para cada decisão de caixa.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4-column proof strip directly below hero split */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-8 border-t border-slate-200">
          <div>
            <p className="font-mono tabular-nums text-2xl font-semibold text-[#0F172A]">100%</p>
            <p className="mt-1 text-sm text-slate-600">
              Separação de dados e regras de acesso individuais por empresa cadastrada.
            </p>
          </div>
          <div>
            <p className="font-mono tabular-nums text-2xl font-semibold text-[#0F172A]">4 Ciclos</p>
            <p className="mt-1 text-sm text-slate-600">
              Mensal, Trimestral (3%), Semestral (5%) e Anual (8%) com cobrança recorrente.
            </p>
          </div>
          <div>
            <p className="font-mono tabular-nums text-2xl font-semibold text-[#0F172A]">PDF + CSV</p>
            <p className="mt-1 text-sm text-slate-600">
              Exportação instantânea de DRE simplificado e extrato completo do fluxo de caixa.
            </p>
          </div>
          <div>
            <p className="font-mono tabular-nums text-2xl font-semibold text-[#0F172A]">IA Real</p>
            <p className="mt-1 text-sm text-slate-600">
              Diagnóstico de margem e previsão de 90 dias gerados sobre seus lançamentos reais.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Asymmetric Bento Grid of Core Capabilities */}
      <section className="bg-white border-y border-slate-200 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-tight text-[#0F172A] [text-wrap:balance]">
              Uma estrutura completa para controlar receitas, custos e crescimento.
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Cada módulo foi desenhado para eliminar retrabalho e mostrar exatamente quanto a sua
              operação fatura, gasta e lucra.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#F8FAFC] border border-slate-200 rounded-xl p-8">
              <p className="text-sm font-semibold text-[#1E40AF]">01. Gestão Financeira e Fluxo de Caixa</p>
              <h3 className="mt-2 font-display text-2xl font-bold text-[#0F172A]">
                Acompanhe lucros, prejuízos e metas mensais em tempo real.
              </h3>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed max-w-2xl">
                Registre entradas e saídas em segundos, classifique categorias operacionais e visualize
                gráficos mensais comparando receita realizada contra a meta definida para sua empresa.
                Cada indicador traz explicação prática do que significa para o seu caixa.
              </p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-200">
                <div>
                  <p className="text-xs text-slate-500">Controle de Entradas</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Receitas e Recebimentos</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Controle de Saídas</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Despesas e Custos Fixos</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Visão Gerencial</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Margem e Ponto de Equilíbrio</p>
                </div>
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-8 flex flex-col justify-between">
              <div>
                <p className="text-sm font-semibold text-[#1E40AF]">02. Inteligência Artificial</p>
                <h3 className="mt-2 font-display text-xl font-bold text-[#0F172A]">
                  Previsões financeiras sobre seus dados reais.
                </h3>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                  Analise tendências dos próximos 90 dias, identifique despesas fora da curva e faça
                  perguntas diretas ao assistente financeiro integrado no servidor.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('resources')}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E40AF] hover:underline cursor-pointer"
              >
                <span>Ver todos os recursos</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-8">
              <p className="text-sm font-semibold text-[#1E40AF]">03. Catálogo e Clientes</p>
              <h3 className="mt-2 font-display text-xl font-bold text-[#0F172A]">
                Produtos, serviços e carteira comercial organizados.
              </h3>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                Cadastre preços de venda, custos unitários, estoque e sua base de clientes com
                histórico centralizado por empresa.
              </p>
            </div>

            <div className="lg:col-span-2 bg-[#F8FAFC] border border-slate-200 rounded-xl p-8 flex flex-col justify-between">
              <div>
                <p className="text-sm font-semibold text-[#1E40AF]">04. Assinaturas Recorrentes com Mercado Pago</p>
                <h3 className="mt-2 font-display text-xl font-bold text-[#0F172A]">
                  Contratação transparente, descontos progressivos e liberação verificada.
                </h3>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed max-w-2xl">
                  Escolha entre planos Mensal, Trimestral, Semestral ou Anual com validação criptográfica
                  de notificações no servidor Node.js e confirmação direta na API oficial do Mercado Pago
                  antes de liberar qualquer acesso.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-6 text-xs font-medium text-slate-500">
                <span>Mensal · 0%</span>
                <span aria-hidden="true">/</span>
                <span>Trimestral · 3% de desconto</span>
                <span aria-hidden="true">/</span>
                <span>Semestral · 5% de desconto</span>
                <span aria-hidden="true">/</span>
                <span>Anual · 8% de desconto</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Proof of Impact & Case Study */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-5 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
            <img
              src="/src/assets/images/jorq_boardroom_team_1795679542405.jpg"
              alt="Gestores analisando fluxo de caixa empresarial na plataforma JORQ"
              referrerPolicy="no-referrer"
              className="w-full h-full lg:h-full object-cover min-h-[300px]"
            />
          </div>
          <div className="lg:col-span-7 flex flex-col justify-center">
            <p className="text-sm font-medium text-[#1E40AF]">Resultado Comprovado em Operações Reais</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#0F172A] [text-wrap:balance]">
              Redução de 68% no tempo de fechamento financeiro mensal em empresas de serviço.
            </h2>
            <p className="mt-4 text-base text-slate-600 leading-relaxed">
              Ao substituir planilhas desconectadas por lançamentos padronizados e exportação direta
              de DRE em PDF, equipes administrativas ganham previsibilidade de caixa logo nas
              primeiras semanas de operação.
            </p>

            <div className="mt-8 p-6 bg-white border border-slate-200 rounded-xl flex items-start gap-4">
              <img
                src="/src/assets/images/avatar_client_exec_1795679542605.jpg"
                alt="Retrato de diretora financeira cliente da plataforma"
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-full object-cover shrink-0 border border-slate-200"
              />
              <div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  “Antes levávamos quatro dias para conciliar receitas e custos de projetos. Com o
                  JORQ, acompanhamos a margem líquida diariamente e fechamos o relatório da diretoria
                  em quinze minutos.”
                </p>
                <p className="mt-2 text-xs font-medium text-slate-500">
                  Camila Nogueira · Diretora Financeira, Grupo Horizonte Serviços · São Paulo, SP
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Final CTA Banner */}
      <section className="max-w-7xl mx-auto px-6 pb-8">
        <div className="bg-[#0F172A] text-white rounded-2xl p-10 lg:p-14 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-blue-300 mb-3">
              <Building2 className="w-4 h-4" />
              <span>Implantação imediata em nuvem</span>
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight [text-wrap:balance]">
              Organize o financeiro da sua empresa hoje mesmo.
            </h2>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed">
              Crie sua conta gratuita, cadastre sua empresa e comece a registrar receitas, despesas
              e metas com total isolamento e segurança.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={() => (isAuthenticated ? onEnterApp() : onNavigate('auth'))}
              className="px-6 py-3 text-sm font-semibold text-[#0F172A] bg-white rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {isAuthenticated ? 'Acessar Painel' : 'Começar Agora'}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('plans')}
              className="px-6 py-3 text-sm font-semibold text-white border border-slate-600 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Ver Planos
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
