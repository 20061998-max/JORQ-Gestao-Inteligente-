import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useLanguage } from '../contexts/LanguageContext';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const { pick } = useLanguage();

  if (isOnline) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg"
      role="status"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>
        {pick({
          pt: 'Modo Offline — Dados em cache em uso',
          en: 'Offline Mode — Using cached data',
          es: 'Modo Sin Conexión — Usando datos en caché',
          fr: 'Mode Hors Ligne — Données en cache utilisées',
        })}
      </span>
    </div>
  );
}
