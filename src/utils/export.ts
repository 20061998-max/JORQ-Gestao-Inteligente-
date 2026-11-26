import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatBRL, formatDateBR } from './format';
import type { LedgerTransaction } from '../types';

export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCell).join(';'), ...rows.map((r) => r.map(escapeCell).join(';'))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportFinancialReportPDF(params: {
  companyName: string;
  periodLabel: string;
  totalRevenue: number;
  totalExpense: number;
  netProfit: number;
  marginPercent: number;
  transactions: LedgerTransaction[];
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Executive header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('JORQ Gestão Inteligente', 14, 13);
  doc.setFontSize(10);
  doc.text(`Relatório Financeiro Executivo — ${params.companyName}`, 14, 20);
  doc.text(`Período: ${params.periodLabel}`, 140, 20);

  // Summary block
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text('Resumo de Desempenho (DRE Simplificado)', 14, 38);

  autoTable(doc, {
    startY: 42,
    head: [['Indicador', 'Valor', 'Interpretação']],
    body: [
      ['Receitas Totais', formatBRL(params.totalRevenue), 'Entradas registradas no período'],
      ['Despesas Totais', formatBRL(params.totalExpense), 'Saídas e custos operacionais'],
      [
        params.netProfit >= 0 ? 'Lucro Líquido' : 'Prejuízo Líquido',
        formatBRL(params.netProfit),
        params.netProfit >= 0 ? 'Resultado positivo' : 'Atenção: saídas superam entradas',
      ],
      ['Margem Líquida', `${params.marginPercent.toFixed(1)}%`, 'Percentual de sobra sobre a receita'],
    ],
    headStyles: { fillColor: [30, 64, 175] },
    styles: { fontSize: 9 },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 90;

  doc.setFontSize(11);
  doc.text('Movimentações do Período', 14, finalY + 12);

  autoTable(doc, {
    startY: finalY + 16,
    head: [['Data', 'Tipo', 'Descrição', 'Categoria', 'Status', 'Valor']],
    body: params.transactions.slice(0, 120).map((t) => [
      formatDateBR(t.date),
      t.type === 'income' ? 'Receita' : 'Despesa',
      t.description,
      t.category,
      t.status === 'settled' ? 'Liquidado' : 'Pendente',
      `${t.type === 'income' ? '+' : '-'} ${formatBRL(t.amount)}`,
    ]),
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 8 },
  });

  const safeName = params.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`relatorio-jorq-${safeName}.pdf`);
}
