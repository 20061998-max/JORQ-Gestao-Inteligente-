import type { SupportedLang } from '../i18n/translations';

interface LegendItem {
  label: string;
  color: string;
  detail?: string;
}

export const SEMANTIC_COLORS = {
  positive: '#16A34A',
  normal: '#EAB308',
  negative: '#DC2626',
  negativeDark: '#991B1B',
  neutralSlate: '#475569',
} as const;

const SEMANTIC_STATUS_LABELS: Record<SupportedLang, { positive: string; normal: string; negative: string }> = {
  pt: { positive: 'Positivo', normal: 'Normal', negative: 'Negativo' },
  en: { positive: 'Positive', normal: 'Normal', negative: 'Negative' },
  es: { positive: 'Positivo', normal: 'Normal', negative: 'Negativo' },
  fr: { positive: 'Positif', normal: 'Normal', negative: 'Négatif' },
};

export function getSemanticStatus(value: number, marginPercent?: number, lang: SupportedLang = 'pt') {
  const labels = SEMANTIC_STATUS_LABELS[lang] || SEMANTIC_STATUS_LABELS.pt;
  if (value < 0) {
    return {
      key: 'negative' as const,
      label: labels.negative,
      color: SEMANTIC_COLORS.negative,
      textClass: 'text-[#DC2626]',
    };
  }
  if (value === 0 || (typeof marginPercent === 'number' && marginPercent < 10)) {
    return {
      key: 'normal' as const,
      label: labels.normal,
      color: SEMANTIC_COLORS.normal,
      textClass: 'text-[#B45309]',
    };
  }
  return {
    key: 'positive' as const,
    label: labels.positive,
    color: SEMANTIC_COLORS.positive,
    textClass: 'text-[#16A34A]',
  };
}

export function SemanticChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-2 whitespace-nowrap shrink-0">
          <span
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          <span className="font-medium text-slate-700">{item.label}</span>
          {item.detail && <span className="text-slate-400">({item.detail})</span>}
        </span>
      ))}
    </div>
  );
}
