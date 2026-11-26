import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Erro inesperado na aplicação.',
    };
  }

  render() {
    if (this.state.hasError) {
      let friendly = 'Ocorreu uma falha ao processar os dados. Tente recarregar a página.';
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) {
          friendly = `Operação bloqueada (${parsed.operationType || 'leitura'}): ${parsed.error}`;
        }
      } catch {
        if (this.state.message) {
          friendly = this.state.message;
        }
      }

      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8">
            <h1 className="font-display text-xl font-bold text-slate-900">
              Não foi possível concluir a ação
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 px-4 py-2 text-sm font-medium text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] transition-colors cursor-pointer"
            >
              Recarregar painel
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
