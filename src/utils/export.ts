import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatBRL, formatDateBR, formatDateTimeBR } from './format';
import type { Company, Expense, LedgerTransaction, Revenue } from '../types';

export type StatementPeriodKind = 'weekly' | 'monthly';
export type WeeklyPreset = 'current_week' | 'last_7_days' | 'previous_week';

export interface StatementEntry {
  date: string;
  type: 'income' | 'expense';
  description: string;
  category: string;
  counterparty?: string;
  paymentMethod?: string;
  status: 'settled' | 'pending';
  amount: number;
}

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

/**
 * Desenha o logotipo oficial do JORQ em vetor de alta definição no PDF
 * (compatível com o ícone do site em public/icon.svg e JorqLogo.tsx).
 */
export function drawJorqPdfLogo(
  doc: jsPDF,
  x: number,
  y: number,
  options?: { size?: number; darkHeader?: boolean; showSubtitle?: boolean }
): void {
  const size = options?.size ?? 11;
  const darkHeader = options?.darkHeader ?? true;
  const showSubtitle = options?.showSubtitle ?? true;
  const s = size / 36;

  // Fundo do emblema
  doc.setFillColor(darkHeader ? 30 : 15, darkHeader ? 64 : 23, darkHeader ? 175 : 42);
  doc.roundedRect(x, y, size, size, 8 * s, 8 * s, 'F');

  // Borda sutil azul
  doc.setDrawColor(96, 165, 250);
  doc.setLineWidth(0.35);
  doc.roundedRect(x + 0.5 * s, y + 0.5 * s, size - 1 * s, size - 1 * s, 7.5 * s, 7.5 * s, 'S');

  // 3 barras verticais brancas
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(Math.max(0.55, 2.4 * s));
  doc.line(x + 10.5 * s, y + 25 * s, x + 10.5 * s, y + 21 * s);
  doc.line(x + 16.5 * s, y + 25 * s, x + 16.5 * s, y + 16.5 * s);
  doc.line(x + 22.5 * s, y + 25 * s, x + 22.5 * s, y + 12.5 * s);

  // Linha de tendência azul claro
  doc.setDrawColor(147, 197, 253);
  doc.setLineWidth(Math.max(0.5, 2.1 * s));
  doc.line(x + 10 * s, y + 17 * s, x + 16.5 * s, y + 12.5 * s);
  doc.line(x + 16.5 * s, y + 12.5 * s, x + 22.5 * s, y + 15 * s);
  doc.line(x + 22.5 * s, y + 15 * s, x + 27.5 * s, y + 9.5 * s);

  // Ponto de destaque
  doc.setFillColor(96, 165, 250);
  doc.circle(x + 27.5 * s, y + 9.5 * s, Math.max(0.6, 2.2 * s), 'F');

  // Wordmark ao lado do emblema
  const textX = x + size + 3.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(showSubtitle ? 15 : 11);
  doc.setTextColor(darkHeader ? 255 : 15, darkHeader ? 255 : 23, darkHeader ? 255 : 42);
  doc.text('JORQ', textX, y + (showSubtitle ? size * 0.48 : size * 0.68));

  if (showSubtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(darkHeader ? 147 : 71, darkHeader ? 197 : 85, darkHeader ? 253 : 105);
    doc.text('Gestão Inteligente', textX, y + size * 0.88);
  }
}

function drawContinuationTopBanner(
  doc: jsPDF,
  title: string,
  companyName: string,
  periodLabel: string
): void {
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 16, 'F');
  drawJorqPdfLogo(doc, 14, 3.5, { size: 9, darkHeader: true, showSubtitle: false });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`${title} — ${companyName}`, 52, 9.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(147, 197, 253);
  doc.text(periodLabel, 196, 9.5, { align: 'right' });
}

function drawPdfPageFooter(doc: jsPDF, pageNumber: number, totalPages: number): void {
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(14, 285, 196, 285);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('JORQ Gestão Inteligente · Documento financeiro gerado eletronicamente', 14, 290);
  doc.text(`Página ${pageNumber} de ${totalPages}`, 196, 290, { align: 'right' });
}

function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWeekDateRange(
  preset: WeeklyPreset,
  referenceDateIso?: string
): { startDate: string; endDate: string; label: string } {
  const base = referenceDateIso
    ? new Date(`${referenceDateIso.slice(0, 10)}T12:00:00`)
    : new Date();
  const safeBase = Number.isNaN(base.getTime()) ? new Date() : base;

  if (preset === 'last_7_days') {
    const end = new Date(safeBase);
    const start = new Date(safeBase);
    start.setDate(start.getDate() - 6);
    const startIso = toLocalIsoDate(start);
    const endIso = toLocalIsoDate(end);
    return {
      startDate: startIso,
      endDate: endIso,
      label: `Últimos 7 dias (${formatDateBR(startIso)} a ${formatDateBR(endIso)})`,
    };
  }

  // Segunda-feira a Domingo
  const day = safeBase.getDay(); // 0=Dom..6=Sab
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(safeBase);
  monday.setDate(monday.getDate() + diffToMonday + (preset === 'previous_week' ? -7 : 0));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startIso = toLocalIsoDate(monday);
  const endIso = toLocalIsoDate(sunday);
  const prefix = preset === 'previous_week' ? 'Semana Anterior' : 'Semana Atual';
  return {
    startDate: startIso,
    endDate: endIso,
    label: `${prefix} (${formatDateBR(startIso)} a ${formatDateBR(endIso)})`,
  };
}

export function getMonthDateRange(monthIso?: string): {
  monthKey: string;
  startDate: string;
  endDate: string;
  label: string;
} {
  const now = new Date();
  const validMatch = monthIso?.match(/^(\d{4})-(\d{2})$/);
  const year = validMatch ? Number(validMatch[1]) : now.getFullYear();
  const monthIndex = validMatch ? Number(validMatch[2]) - 1 : now.getMonth();

  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;

  const rawMonthName = start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const monthName = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);

  return {
    monthKey,
    startDate: toLocalIsoDate(start),
    endDate: toLocalIsoDate(end),
    label: `${monthName} (${formatDateBR(toLocalIsoDate(start))} a ${formatDateBR(toLocalIsoDate(end))})`,
  };
}

export function buildStatementEntries(params: {
  startDate: string;
  endDate: string;
  revenues: Revenue[];
  expenses: Expense[];
  transactions: LedgerTransaction[];
}): StatementEntry[] {
  const { startDate, endDate, revenues, expenses, transactions } = params;
  const revById = new Map(revenues.map((r) => [r.id, r]));
  const expById = new Map(expenses.map((e) => [e.id, e]));

  const entries: StatementEntry[] = [];
  const representedSourceIds = new Set<string>();

  for (const tx of transactions) {
    const dateKey = (tx.date || '').slice(0, 10);
    if (dateKey < startDate || dateKey > endDate) continue;

    if (tx.sourceId) representedSourceIds.add(tx.sourceId);
    const linkedRev = tx.sourceId ? revById.get(tx.sourceId) : undefined;
    const linkedExp = tx.sourceId ? expById.get(tx.sourceId) : undefined;

    entries.push({
      date: dateKey,
      type: tx.type,
      description: tx.description,
      category: tx.category || 'Geral',
      counterparty:
        tx.type === 'income' ? linkedRev?.customerName : linkedExp?.supplierName,
      paymentMethod:
        tx.type === 'income' ? linkedRev?.paymentMethod : linkedExp?.paymentMethod,
      status: tx.status,
      amount: Number(tx.amount) || 0,
    });
  }

  for (const rev of revenues) {
    if (representedSourceIds.has(rev.id)) continue;
    const dateKey = (rev.date || '').slice(0, 10);
    if (dateKey < startDate || dateKey > endDate) continue;
    entries.push({
      date: dateKey,
      type: 'income',
      description: rev.description,
      category: rev.category || 'Geral',
      counterparty: rev.customerName,
      paymentMethod: rev.paymentMethod,
      status: rev.status === 'received' ? 'settled' : 'pending',
      amount: Number(rev.amount) || 0,
    });
  }

  for (const exp of expenses) {
    if (representedSourceIds.has(exp.id)) continue;
    const dateKey = (exp.date || '').slice(0, 10);
    if (dateKey < startDate || dateKey > endDate) continue;
    entries.push({
      date: dateKey,
      type: 'expense',
      description: exp.description,
      category: exp.category || 'Geral',
      counterparty: exp.supplierName,
      paymentMethod: exp.paymentMethod,
      status: exp.status === 'paid' ? 'settled' : 'pending',
      amount: Number(exp.amount) || 0,
    });
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

export function exportPeriodStatementPDF(params: {
  periodKind: StatementPeriodKind;
  periodLabel: string;
  startDate: string;
  endDate: string;
  company: Pick<Company, 'name' | 'tradeName' | 'document' | 'phone' | 'sector' | 'address'>;
  monthlyGoal?: number;
  revenues: Revenue[];
  expenses: Expense[];
  transactions: LedgerTransaction[];
}): string {
  const { periodKind, periodLabel, startDate, endDate, company, monthlyGoal } = params;
  const entries = buildStatementEntries({
    startDate,
    endDate,
    revenues: params.revenues,
    expenses: params.expenses,
    transactions: params.transactions,
  });

  const incomeEntries = entries.filter((e) => e.type === 'income');
  const expenseEntries = entries.filter((e) => e.type === 'expense');
  const totalRevenue = incomeEntries.reduce((s, e) => s + e.amount, 0);
  const totalExpense = expenseEntries.reduce((s, e) => s + e.amount, 0);
  const netResult = totalRevenue - totalExpense;
  const marginPercent = totalRevenue > 0 ? (netResult / totalRevenue) * 100 : 0;
  const pendingAmount = entries
    .filter((e) => e.status === 'pending')
    .reduce((s, e) => s + e.amount, 0);

  const docTitle = periodKind === 'weekly' ? 'EXTRATO FINANCEIRO SEMANAL' : 'EXTRATO FINANCEIRO MENSAL';
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // 1. Cabeçalho principal com logotipo oficial do site no topo
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 32, 'F');
  drawJorqPdfLogo(doc, 14, 9.5, { size: 12, darkHeader: true, showSubtitle: true });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(docTitle, 196, 12.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(147, 197, 253);
  doc.text(periodLabel, 196, 18.5, { align: 'right' });

  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Emitido em ${formatDateTimeBR(new Date().toISOString())}`, 196, 24.5, {
    align: 'right',
  });

  // 2. Cartão de identificação da empresa
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 36, 182, 18, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(company.name, 18, 42.5);

  const companyMetaLeft = [
    company.tradeName ? `Fantasia: ${company.tradeName}` : '',
    company.sector ? `Segmento: ${company.sector}` : '',
    company.document ? `CNPJ/CPF: ${company.document}` : '',
  ]
    .filter(Boolean)
    .join('  ·  ');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(companyMetaLeft || 'Gestão Financeira Empresarial', 18, 48.5);

  const companyMetaRight = [
    company.phone ? `Tel: ${company.phone}` : '',
    `${entries.length} lançamento(s)`,
  ]
    .filter(Boolean)
    .join('  ·  ');
  doc.text(companyMetaRight, 192, 48.5, { align: 'right' });

  // 3. 4 Blocos KPI Executivos
  const cardY = 58;
  const cardW = 43.25;
  const cardH = 19;
  const gap = 3;

  const fourthCardTitle =
    periodKind === 'monthly' && typeof monthlyGoal === 'number' && monthlyGoal > 0
      ? 'Meta do Mês'
      : 'Valores Pendentes';
  const fourthCardValue =
    periodKind === 'monthly' && typeof monthlyGoal === 'number' && monthlyGoal > 0
      ? `${((totalRevenue / monthlyGoal) * 100).toFixed(0)}% atingida`
      : formatBRL(pendingAmount);
  const fourthCardSub =
    periodKind === 'monthly' && typeof monthlyGoal === 'number' && monthlyGoal > 0
      ? `Alvo: ${formatBRL(monthlyGoal)}`
      : `${entries.filter((e) => e.status === 'pending').length} em aberto`;

  const kpiCards = [
    {
      title: 'Receitas no Período',
      value: formatBRL(totalRevenue),
      sub: `${incomeEntries.length} entrada(s)`,
      accent: [22, 163, 74] as [number, number, number],
    },
    {
      title: 'Despesas no Período',
      value: formatBRL(totalExpense),
      sub: `${expenseEntries.length} saída(s)`,
      accent: [220, 38, 38] as [number, number, number],
    },
    {
      title: netResult >= 0 ? 'Saldo Líquido' : 'Saldo Negativo',
      value: formatBRL(netResult),
      sub: `Margem: ${marginPercent.toFixed(1)}%`,
      accent: (netResult >= 0 ? [30, 64, 175] : [220, 38, 38]) as [number, number, number],
    },
    {
      title: fourthCardTitle,
      value: fourthCardValue,
      sub: fourthCardSub,
      accent: [15, 23, 42] as [number, number, number],
    },
  ];

  kpiCards.forEach((card, idx) => {
    const cx = 14 + idx * (cardW + gap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cx, cardY, cardW, cardH, 2, 2, 'FD');

    // Barra superior de destaque
    doc.setFillColor(...card.accent);
    doc.rect(cx, cardY, cardW, 1.4, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.title, cx + 3, cardY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...card.accent);
    doc.text(card.value, cx + 3, cardY + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(card.sub, cx + 3, cardY + 16.5);
  });

  // 4. Resumo por Categoria
  const categoryMap = new Map<string, { income: number; expense: number }>();
  for (const e of entries) {
    const curr = categoryMap.get(e.category) || { income: 0, expense: 0 };
    if (e.type === 'income') curr.income += e.amount;
    else curr.expense += e.amount;
    categoryMap.set(e.category, curr);
  }
  const categoryRows = Array.from(categoryMap.entries())
    .sort((a, b) => b[1].income + b[1].expense - (a[1].income + a[1].expense))
    .slice(0, 12)
    .map(([cat, vals]) => {
      const net = vals.income - vals.expense;
      return [
        cat,
        formatBRL(vals.income),
        formatBRL(vals.expense),
        `${net >= 0 ? '+' : '-'} ${formatBRL(Math.abs(net))}`,
      ];
    });

  let nextSectionY = 84;
  if (categoryRows.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Resumo por Categoria', 14, nextSectionY);

    autoTable(doc, {
      startY: nextSectionY + 3,
      margin: { top: 21, left: 14, right: 14, bottom: 20 },
      head: [['Categoria', 'Entradas', 'Saídas', 'Resultado']],
      body: categoryRows,
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2.2 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold' },
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          drawContinuationTopBanner(doc, docTitle, company.name, periodLabel);
        }
      },
    });
    nextSectionY =
      ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 110) + 9;
  }

  // 5. Extrato Cronológico Detalhado com Saldo Acumulado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Extrato Detalhado de Movimentações', 14, nextSectionY);

  let runningBalance = 0;
  const statementBody =
    entries.length > 0
      ? entries.map((e) => {
          runningBalance += e.type === 'income' ? e.amount : -e.amount;
          const detailParts = [e.description];
          if (e.counterparty) detailParts.push(`(${e.counterparty})`);
          if (e.paymentMethod) detailParts.push(`[${e.paymentMethod}]`);
          return [
            formatDateBR(e.date),
            e.type === 'income' ? 'Entrada' : 'Saída',
            detailParts.join(' '),
            e.category,
            e.status === 'settled' ? 'Confirmado' : 'Pendente',
            `${e.type === 'income' ? '+' : '-'} ${formatBRL(e.amount)}`,
            `${runningBalance >= 0 ? '' : '- '}${formatBRL(Math.abs(runningBalance))}`,
          ];
        })
      : [['—', '—', 'Nenhuma movimentação registrada neste período.', '—', '—', 'R$ 0,00', 'R$ 0,00']];

  autoTable(doc, {
    startY: nextSectionY + 3,
    margin: { top: 21, left: 14, right: 14, bottom: 20 },
    head: [['Data', 'Tipo', 'Descrição / Detalhes', 'Categoria', 'Status', 'Valor', 'Saldo']],
    body: statementBody,
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.5 },
    styles: { fontSize: 7.5, cellPadding: 2.2, overflow: 'linebreak' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 19 },
      1: { cellWidth: 15 },
      2: { cellWidth: 55 },
      3: { cellWidth: 24 },
      4: { cellWidth: 20 },
      5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && entries.length > 0) {
        const entry = entries[data.row.index];
        if (data.column.index === 1 || data.column.index === 5) {
          data.cell.styles.textColor = entry?.type === 'income' ? [22, 163, 74] : [220, 38, 38];
        }
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawContinuationTopBanner(doc, docTitle, company.name, periodLabel);
      }
    },
  });

  // Numeração e rodapé oficial em todas as páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPdfPageFooter(doc, i, totalPages);
  }

  const safeCompany =
    company.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'empresa';
  const kindSlug = periodKind === 'weekly' ? 'extrato-semanal' : 'extrato-mensal';
  const filename = `${kindSlug}-jorq-${safeCompany}-${startDate}.pdf`;
  doc.save(filename);
  return filename;
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
  const docTitle = 'RELATÓRIO FINANCEIRO EXECUTIVO';

  // Cabeçalho executivo com logotipo oficial do site no topo
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 30, 'F');
  drawJorqPdfLogo(doc, 14, 8.5, { size: 12, darkHeader: true, showSubtitle: true });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text(docTitle, 196, 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(147, 197, 253);
  doc.text(`${params.companyName}  ·  Período: ${params.periodLabel}`, 196, 19, { align: 'right' });

  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Emitido em ${formatDateTimeBR(new Date().toISOString())}`, 196, 24.5, {
    align: 'right',
  });

  // Resumo DRE
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Resumo de Desempenho (DRE Simplificado)', 14, 40);

  autoTable(doc, {
    startY: 44,
    margin: { top: 21, left: 14, right: 14, bottom: 20 },
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
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawContinuationTopBanner(doc, docTitle, params.companyName, params.periodLabel);
      }
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 92;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Movimentações do Período', 14, finalY + 12);

  autoTable(doc, {
    startY: finalY + 16,
    margin: { top: 21, left: 14, right: 14, bottom: 20 },
    head: [['Data', 'Tipo', 'Descrição', 'Categoria', 'Status', 'Valor']],
    body: params.transactions.slice(0, 200).map((t) => [
      formatDateBR(t.date),
      t.type === 'income' ? 'Receita' : 'Despesa',
      t.description,
      t.category,
      t.status === 'settled' ? 'Liquidado' : 'Pendente',
      `${t.type === 'income' ? '+' : '-'} ${formatBRL(t.amount)}`,
    ]),
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 8 },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawContinuationTopBanner(doc, docTitle, params.companyName, params.periodLabel);
      }
    },
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPdfPageFooter(doc, i, totalPages);
  }

  const safeName = params.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`relatorio-jorq-${safeName}.pdf`);
}

export interface AdminStatementPaymentRow {
  clientName: string;
  companyName: string;
  planName: string;
  billingCycle: string;
  couponCode?: string;
  paymentMethod: string;
  mpResourceId: string;
  status: 'approved' | 'pending' | 'suspended' | 'other';
  statusLabel: string;
  amount: number;
  dateIso: string;
}

export function exportAdminBillingStatementPDF(params: {
  periodKind: StatementPeriodKind;
  periodLabel: string;
  startDate: string;
  endDate: string;
  platformName: string;
  adminEmail: string;
  mrr: number;
  activeSubscriptionsCount: number;
  rows: AdminStatementPaymentRow[];
}): string {
  const {
    periodKind,
    periodLabel,
    startDate,
    endDate,
    platformName,
    adminEmail,
    mrr,
    activeSubscriptionsCount,
    rows,
  } = params;

  const filtered = rows
    .filter((r) => {
      const d = (r.dateIso || '').slice(0, 10);
      if (!d) return false;
      return d >= startDate && d <= endDate;
    })
    .sort((a, b) => a.dateIso.localeCompare(b.dateIso));

  const approvedRows = filtered.filter((r) => r.status === 'approved');
  const pendingRows = filtered.filter((r) => r.status === 'pending');
  const totalApproved = approvedRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalPending = pendingRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const docTitle =
    periodKind === 'weekly'
      ? 'EXTRATO ADMIN SEMANAL (PAGAMENTOS)'
      : 'EXTRATO ADMIN MENSAL (PAGAMENTOS)';
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // 1. Cabeçalho executivo com logotipo oficial do site no topo
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 32, 'F');
  drawJorqPdfLogo(doc, 14, 9.5, { size: 12, darkHeader: true, showSubtitle: true });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text(docTitle, 196, 12.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(147, 197, 253);
  doc.text(periodLabel, 196, 18.5, { align: 'right' });

  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Emitido em ${formatDateTimeBR(new Date().toISOString())}`, 196, 24.5, {
    align: 'right',
  });

  // 2. Identificação da Plataforma
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 36, 182, 16, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(platformName || 'JORQ Gestão Inteligente', 18, 42.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Painel Administrativo · Responsável: ${adminEmail}`, 18, 48);
  doc.text(`${filtered.length} registro(s) no período`, 192, 48, { align: 'right' });

  // 3. 4 Blocos KPI Executivos
  const cardY = 56;
  const cardW = 43.25;
  const cardH = 19;
  const gap = 3;

  const kpiCards = [
    {
      title: 'Recebido (Aprovados)',
      value: formatBRL(totalApproved),
      sub: `${approvedRows.length} pagamento(s)`,
      accent: [22, 163, 74] as [number, number, number],
    },
    {
      title: 'Em Aberto (Pendentes)',
      value: formatBRL(totalPending),
      sub: `${pendingRows.length} aguardando`,
      accent: [217, 119, 6] as [number, number, number],
    },
    {
      title: 'MRR Atual',
      value: formatBRL(mrr),
      sub: `${activeSubscriptionsCount} assinatura(s) ativa(s)`,
      accent: [30, 64, 175] as [number, number, number],
    },
    {
      title: 'Ticket Médio',
      value: formatBRL(approvedRows.length > 0 ? totalApproved / approvedRows.length : 0),
      sub: 'Por pagamento confirmado',
      accent: [15, 23, 42] as [number, number, number],
    },
  ];

  kpiCards.forEach((card, idx) => {
    const cx = 14 + idx * (cardW + gap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cx, cardY, cardW, cardH, 2, 2, 'FD');

    doc.setFillColor(...card.accent);
    doc.rect(cx, cardY, cardW, 1.4, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.title, cx + 3, cardY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...card.accent);
    doc.text(card.value, cx + 3, cardY + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(card.sub, cx + 3, cardY + 16.5);
  });

  // 4. Resumo por Plano
  const planMap = new Map<string, { count: number; total: number }>();
  for (const r of approvedRows) {
    const curr = planMap.get(r.planName) || { count: 0, total: 0 };
    curr.count += 1;
    curr.total += Number(r.amount) || 0;
    planMap.set(r.planName, curr);
  }

  let nextY = 82;
  if (planMap.size > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Resumo por Plano (Confirmados)', 14, nextY);

    autoTable(doc, {
      startY: nextY + 3,
      margin: { top: 21, left: 14, right: 14, bottom: 20 },
      head: [['Plano', 'Pagamentos Confirmados', 'Total Recebido']],
      body: Array.from(planMap.entries()).map(([planName, stats]) => [
        planName,
        String(stats.count),
        formatBRL(stats.total),
      ]),
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2.2 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right', fontStyle: 'bold' },
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          drawContinuationTopBanner(doc, docTitle, platformName || 'JORQ', periodLabel);
        }
      },
    });
    nextY =
      ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 105) + 9;
  }

  // 5. Tabela Detalhada de Pagamentos
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Detalhamento de Pagamentos do Período', 14, nextY);

  const body =
    filtered.length > 0
      ? filtered.map((r) => [
          r.dateIso ? formatDateBR(r.dateIso) : '—',
          `${r.clientName}\n${r.companyName}`,
          `${r.planName}${r.couponCode ? ` (${r.couponCode})` : ''}`,
          `${r.paymentMethod}\n${r.mpResourceId}`,
          r.statusLabel,
          formatBRL(r.amount),
        ])
      : [['—', 'Nenhum pagamento encontrado neste período.', '—', '—', '—', 'R$ 0,00']];

  autoTable(doc, {
    startY: nextY + 3,
    margin: { top: 21, left: 14, right: 14, bottom: 20 },
    head: [['Data', 'Cliente / Empresa', 'Plano / Cupom', 'Meio / ID MP', 'Status', 'Valor']],
    body,
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.5 },
    styles: { fontSize: 7.5, cellPadding: 2.2, overflow: 'linebreak' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 42 },
      2: { cellWidth: 32 },
      3: { cellWidth: 34 },
      4: { cellWidth: 32 },
      5: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && filtered.length > 0 && data.column.index === 4) {
        const row = filtered[data.row.index];
        data.cell.styles.textColor =
          row?.status === 'approved'
            ? [22, 163, 74]
            : row?.status === 'pending'
              ? [180, 83, 9]
              : [220, 38, 38];
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawContinuationTopBanner(doc, docTitle, platformName || 'JORQ', periodLabel);
      }
    },
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPdfPageFooter(doc, i, totalPages);
  }

  const kindSlug = periodKind === 'weekly' ? 'extrato-admin-semanal' : 'extrato-admin-mensal';
  const filename = `${kindSlug}-jorq-${startDate}.pdf`;
  doc.save(filename);
  return filename;
}
