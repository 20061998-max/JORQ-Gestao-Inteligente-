import { BookOpen, HelpCircle, ShieldCheck, TrendingUp } from 'lucide-react';

export function HelpManualPage() {
  const indicators = [
    {
      term: 'Receita Total (Entradas)',
      explanation:
        'É a soma de todo o dinheiro que entrou ou está previsto para entrar com suas vendas de produtos e prestação de serviços no período.',
      tip: 'Registre tanto as vendas à vista quanto as parcelas a receber para enxergar o faturamento real.',
    },
    {
      term: 'Despesas Totais (Saídas)',
      explanation:
        'Inclui todos os custos e gastos necessários para manter a empresa funcionando: fornecedores, aluguel, salários, impostos e ferramentas.',
      tip: 'Categorize cada despesa corretamente para descobrir onde seu dinheiro está sendo mais consumido.',
    },
    {
      term: 'Lucro ou Prejuízo Líquido',
      explanation:
        'É o resultado final da subtração: Receitas menos Despesas. Quando positivo, houve lucro; quando negativo, houve prejuízo no período.',
      tip: 'Acompanhe semanalmente para corrigir excessos de gastos antes do fechamento do mês.',
    },
    {
      term: 'Margem de Lucro (%)',
      explanation:
        'Mostra quantos por cento de cada R$ 100 vendidos realmente sobram para a empresa após pagar todas as despesas.',
      tip: 'Exemplo: uma margem de 20% significa que a cada R$ 100 faturados, R$ 20 viram lucro líquido.',
    },
    {
      term: 'Fluxo de Caixa',
      explanation:
        'É o filme cronológico das entradas e saídas de dinheiro. Ajuda a evitar falta de saldo nos dias em que há muitos boletos para pagar.',
      tip: 'Consulte o extrato unificado na aba Gestão Financeira para conferir lançamentos liquidados e pendentes.',
    },
    {
      term: 'Previsão Financeira com IA',
      explanation:
        'Projeção automática gerada com base no histórico real da sua empresa para estimar os próximos 90 dias em três cenários.',
      tip: 'Quanto mais lançamentos você registrar, mais precisa será a análise da inteligência artificial.',
    },
  ];

  const steps = [
    {
      step: '01. Configure os dados e a meta da empresa',
      detail:
        'Em Configurações da Empresa, adicione o logotipo, telefone, endereço e defina sua meta mensal de faturamento. O painel calcula automaticamente o quanto falta para atingi-la.',
    },
    {
      step: '02. Cadastre produtos, serviços e clientes',
      detail:
        'Preencha seu catálogo com preço de venda e custo unitário para visualizar a margem de cada item, e mantenha sua carteira de clientes organizada.',
    },
    {
      step: '03. Lance receitas e despesas regularmente',
      detail:
        'Sempre que realizar uma venda ou pagar uma conta, registre em Gestão Financeira. Cada lançamento atualiza os gráficos mensais e o fluxo de caixa instantaneamente.',
    },
    {
      step: '04. Gere relatórios em PDF ou CSV e consulte a IA',
      detail:
        'Na área de Relatórios e Inteligência Artificial, acompanhe seu DRE simplificado, exporte planilhas para o contador ou peça recomendações práticas para aumentar o lucro.',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-medium text-[#1E40AF] mb-2">
          <BookOpen className="w-4 h-4" />
          <span>Ajuda e Manual de Utilização</span>
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[#0F172A]">
          Guia Prático do JORQ Gestão Inteligente
        </h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-2xl">
          Entenda de forma simples cada indicador financeiro do sistema e siga o roteiro recomendado
          para manter sua empresa organizada.
        </p>
      </div>

      {/* Dictionary of Indicators */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#1E40AF]" />
          <h2 className="font-display text-xl font-bold text-[#0F172A]">
            Entendendo cada indicador do painel
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {indicators.map((item) => (
            <div key={item.term} className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="font-display text-base font-bold text-[#0F172A]">{item.term}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.explanation}</p>
              <p className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                <strong className="text-slate-700">Na prática:</strong> {item.tip}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Step-by-step Workflow */}
      <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-[#1E40AF]" />
          <h2 className="font-display text-xl font-bold text-[#0F172A]">
            Rotina recomendada de uso
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {steps.map((s) => (
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
          <h2 className="font-display text-lg font-bold">
            Segurança de Dados e Assinaturas Mercado Pago
          </h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Todos os registros da sua empresa são protegidos por regras individuais de isolamento no
            Cloud Firestore. Assinaturas contratadas via Mercado Pago passam por conferência direta
            no servidor antes de confirmar a ativação do plano. Para ativar login por e-mail e senha
            no seu projeto Firebase, certifique-se de habilitar o provedor E-mail/Senha em
            Authentication &gt; Sign-in method no Console do Firebase.
          </p>
        </div>
      </section>
    </div>
  );
}
