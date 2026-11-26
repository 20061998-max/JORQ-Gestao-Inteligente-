import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  SUPPORTED_LANGS,
  TRANSLATIONS,
  type SupportedLang,
  type TranslationSchema,
} from '../i18n/translations';

const STORAGE_KEY = 'jorq_preferred_language';

function normalizeLangTag(tag?: string | null): SupportedLang | null {
  if (!tag) return null;
  const primary = tag.toLowerCase().trim().split(/[-_]/)[0];
  if (primary === 'pt' || primary === 'en' || primary === 'es' || primary === 'fr') {
    return primary;
  }
  return null;
}

export function detectBrowserLanguage(): SupportedLang {
  if (typeof navigator === 'undefined') return 'pt';
  const candidates = Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language];

  for (const cand of candidates) {
    const match = normalizeLangTag(cand);
    if (match) return match;
  }
  return 'pt';
}

interface LanguageContextValue {
  lang: SupportedLang;
  isManualOverride: boolean;
  setLang: (next: SupportedLang | 'auto') => void;
  t: TranslationSchema;
  intlLocale: string;
  pick: <T>(map: Record<SupportedLang, T>) => T;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [manualLang, setManualLang] = useState<SupportedLang | null>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      return normalizeLangTag(saved);
    } catch {
      return null;
    }
  });

  const [browserLang, setBrowserLang] = useState<SupportedLang>(() => detectBrowserLanguage());

  useEffect(() => {
    const handleLanguageChange = () => {
      setBrowserLang(detectBrowserLanguage());
    };
    window.addEventListener('languagechange', handleLanguageChange);
    return () => window.removeEventListener('languagechange', handleLanguageChange);
  }, []);

  const lang: SupportedLang = manualLang || browserLang;
  const t = TRANSLATIONS[lang];
  const meta = SUPPORTED_LANGS.find((item) => item.code === lang) || SUPPORTED_LANGS[0];

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = meta.htmlLang;
    document.title = t.meta.title;
    const descTag = document.querySelector('meta[name="description"]');
    if (descTag) descTag.setAttribute('content', t.meta.description);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', t.meta.title);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', t.meta.description);
  }, [meta.htmlLang, t.meta.title, t.meta.description]);

  const setLang = useCallback((next: SupportedLang | 'auto') => {
    if (next === 'auto') {
      setManualLang(null);
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore storage restrictions
      }
      setBrowserLang(detectBrowserLanguage());
      return;
    }
    setManualLang(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage restrictions
    }
  }, []);

  const pick = useCallback(<T,>(map: Record<SupportedLang, T>): T => map[lang], [lang]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      isManualOverride: Boolean(manualLang),
      setLang,
      t,
      intlLocale: meta.intl,
      pick,
    }),
    [lang, manualLang, setLang, t, meta.intl, pick]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
