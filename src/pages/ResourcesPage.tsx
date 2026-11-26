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

interface ResourcesPageProps {
  onNavigate: (route: PublicRoute) => void;
}

export function ResourcesPage({ onNavigate }: ResourcesPageProps) {
  const modules = [
    {
      icon: BarChart3,
      code: '01',
      title: 'Gestão Financeira e Fluxo de Caixa',
      summary:
        'Controle detalhado de receitas, despesas, contas pagas ou pendentes, metas mensais e gráficos evolutivos.',
      details: [
        'Cálculo automático de lucro líquido, prejuízo e margem operacional',
        'Explicações claras em cada cartão indicador para gestores não técnicos',
        'Extrato unificado de movimentações com filtros por data e categoria',
      ],
    },
    {
      icon: Package,
      code: '02',
      title: 'Catálogo de Produtos e Serviços',
      summary:
        'Cadastre itens vendidos com preço, custo unitário, estoque e margem calculada automaticamente.',
      details: [
        'Controle de SKU, unidade de medida e saldo em estoque',
        'Serviços recorrentes ou avulsos com custo estimado e rentabilidade',
        'Identificação rápida dos itens mais lucrativos da operação',
      ],
    },
    {
      icon: Users,
      code: '03',
      title: 'Gestão Comercial de Clientes',
      summary:
        'Base organizada de clientes da sua empresa com CNPJ/CPF, contatos, cidade e status de relacionamento.',
      details: [
        'Busca instantânea e filtro de clientes ativos ou inativos',
        'Anotações comerciais e histórico vinculado ao ambiente da empresa',
        'Dados isolados e protegidos contra acesso externo',
      ],
    },
    {
      icon: FileSpreadsheet,
      code: '04',
      title: 'Relatórios Executivos e Exportação',
      summary:
        'Gere DRE simplificado, salve snapshots históricos e exporte arquivos prontos para contabilidade.',
      details: [
        'Download direto em PDF formatado com resumo e tabela de lançamentos',
        'Exportação CSV compatível com Microsoft Excel (UTF-8 BOM)',
        'Histórico de relatórios salvos no banco de dados',
      ],
    },
    {
      icon: Brain,
      code: '05',
      title: 'Inteligência Artificial Financeira',
      summary:
        'Consultor virtual integrado no servidor analisando o desempenho real da sua empresa.',
      details: [
        'Diagnóstico financeiro de pontos fortes e gargalos de custos',
        'Projeção de 90 dias em cenários conservador, realista e otimista',
        'Perguntas abertas respondidas com base nos seus lançamentos reais',
      ],
    },
    {
      icon: CreditCard,
      code: '06',
      title: 'Assinaturas com Mercado Pago',
      summary:
        'Ciclos Mensal, Trimestral (-3%), Semestral (-5%) e Anual (-8%) com validação segura no backend.',
      details: [
        'Checkout oficial Mercado Pago via backend Node.js',
        'Validação criptográfica de webhooks e idempotência de eventos',
        'Liberação de acesso somente após confirmação real do pagamento',
      ],
    },
    {
      icon: Lock,
      code: '07',
      title: 'Arquitetura Multi-Empresa e Auditoria',
      summary:
        'Cada empresa opera em um perímetro isolado no Cloud Firestore com verificação de e-mail obrigatória.',
      details: [
        'Regras de segurança estritas impedindo leitura ou escrita entre empresas',
        'Papéis diferenciados entre cliente empresarial e proprietário administrador',
        'Trilha de auditoria imutável para alterações sensíveis',
      ],
    },
    {
      icon: Bell,
      code: '08',
      title: 'Central de Notificações e Manual',
      summary:
        'Alertas internos de cobrança, metas financeiras e guia didático completo dentro do painel.',
      details: [
        'Avisos categorizados por financeiro, assinatura, sistema e IA',
        'Manual passo a passo explicando cada indicador e rotina operacional',
        'Suporte direto com configurações personalizáveis pelo administrador',
      ],
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-[#1E40AF]">Recursos da Plataforma</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-[#0F172A] [text-wrap:balance]">
          Tudo o que sua empresa precisa para operar com previsibilidade financeira.
        </h1>
        <p className="mt-4 text-base text-slate-600 leading-relaxed">
          Conheça em detalhes os módulos integrados do JORQ Gestão Inteligente, desenvolvidos para
          oferecer controle completo sem complexidade técnica.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <div
              key={mod.code}
              className="bg-white border border-slate-200 rounded-xl p-7 flex flex-col justify-between"
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
          <h3 className="font-display text-xl font-bold text-[#0F172A]">
            Pronto para conhecer os planos disponíveis?
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Compare os ciclos Mensal, Trimestral, Semestral e Anual configurados na plataforma.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('plans')}
          className="px-6 py-3 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] transition-colors cursor-pointer"
        >
          Ver Planos e Valores
        </button>
      </div>
    </div>
  );
}
