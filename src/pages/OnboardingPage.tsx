import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { JorqLogo } from '../components/JorqLogo';

export function OnboardingPage({ onBackToAdmin }: { onBackToAdmin?: () => void }) {
  const { createCompany, userProfile, isAdmin, logout } = useAuth();
  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [document, setDocument] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [sector, setSector] = useState('Serviços');
  const [monthlyGoal, setMonthlyGoal] = useState('15000');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Informe o nome da sua empresa.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await createCompany({
        name,
        tradeName,
        document,
        phone,
        address,
        sector,
        monthlyGoal: Number(monthlyGoal) || 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar ambiente da empresa.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white border border-slate-200 rounded-xl p-8 lg:p-10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <JorqLogo showFullTitle />
          <div className="flex items-center gap-4">
            {isAdmin && onBackToAdmin && (
              <button
                type="button"
                onClick={onBackToAdmin}
                className="text-xs font-semibold text-[#1E40AF] hover:underline cursor-pointer"
              >
                Voltar ao Painel Admin
              </button>
            )}
            <button
              type="button"
              onClick={() => logout()}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Sair
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <Building2 className="w-5 h-5 text-[#1E40AF]" />
          <h1 className="font-display text-2xl font-bold text-[#0F172A]">
            Configure o ambiente da sua empresa
          </h1>
        </div>
        <p className="text-sm text-slate-600 mb-6">
          Olá, <strong>{userProfile?.name || 'Gestor'}</strong>. Preencha os dados comerciais iniciais
          para isolar o banco de dados exclusivo da sua organização.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Razão Social ou Nome da Empresa *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Alfa Soluções Empresariais Ltda"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E40AF]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Fantasia</label>
            <input
              type="text"
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
              placeholder="Ex: Alfa Consultoria"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E40AF]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">CNPJ ou CPF</label>
            <input
              type="text"
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              placeholder="00.000.000/0001-00"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E40AF]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E40AF]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Segmento</label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E40AF] bg-white"
            >
              <option value="Serviços">Serviços</option>
              <option value="Comércio">Comércio e Varejo</option>
              <option value="Indústria">Indústria</option>
              <option value="Tecnologia">Tecnologia e SaaS</option>
              <option value="Saúde">Saúde e Clínicas</option>
              <option value="Construção">Engenharia e Construção</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Endereço comercial
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, número, bairro, cidade e estado"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E40AF]"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Meta Mensal de Receita (R$)
            </label>
            <input
              type="number"
              min={0}
              step="100"
              value={monthlyGoal}
              onChange={(e) => setMonthlyGoal(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E40AF] font-mono tabular-nums"
            />
          </div>

          <div className="sm:col-span-2 pt-2">
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 px-6 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {busy ? 'Criando ambiente exclusivo...' : 'Concluir Cadastro da Empresa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
