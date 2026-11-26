import { Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { SUPPORTED_LANGS, type SupportedLang } from '../i18n/translations';

interface LanguageSelectorProps {
  compact?: boolean;
  dark?: boolean;
}

export function LanguageSelector({ compact = false, dark = false }: LanguageSelectorProps) {
  const { lang, isManualOverride, setLang, t } = useLanguage();

  return (
    <label
      className={`inline-flex items-center gap-1.5 rounded-lg border transition-colors shrink-0 ${
        compact ? 'px-2 py-1.5 text-xs' : 'px-2.5 py-1.5 text-xs'
      } ${
        dark
          ? 'bg-slate-800 border-slate-700 text-slate-200 hover:border-slate-500'
          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
      }`}
      title={t.common.languageLabel}
    >
      <Globe className={`w-3.5 h-3.5 shrink-0 ${dark ? 'text-slate-400' : 'text-slate-500'}`} />
      <select
        aria-label={t.common.languageLabel}
        value={isManualOverride ? lang : 'auto'}
        onChange={(e) => setLang(e.target.value as SupportedLang | 'auto')}
        className={`bg-transparent font-medium focus:outline-none cursor-pointer ${
          dark ? 'text-slate-100' : 'text-slate-800'
        }`}
      >
        <option value="auto" className="text-slate-900 bg-white">
          {compact
            ? `Auto (${SUPPORTED_LANGS.find((l) => l.code === lang)?.short || 'PT'})`
            : `${t.common.autoBrowser} — ${SUPPORTED_LANGS.find((l) => l.code === lang)?.short || 'PT'}`}
        </option>
        {SUPPORTED_LANGS.map((item) => (
          <option key={item.code} value={item.code} className="text-slate-900 bg-white">
            {compact ? item.short : item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
