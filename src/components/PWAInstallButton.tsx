import { useState } from 'react';
import { Download, Smartphone, Share, MoreVertical, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../contexts/LanguageContext';

interface PWAInstallButtonProps {
  compact?: boolean;
  fullWidth?: boolean;
}

export function PWAInstallButton({ compact = false, fullWidth = false }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, platform, install } = usePWAInstall();
  const { pick } = useLanguage();
  const [showGuide, setShowGuide] = useState(false);

  // Hide when already running as an installed standalone app
  if (isInstalled) {
    return null;
  }

  const label = compact
    ? pick({ pt: 'App', en: 'App', es: 'App', fr: 'App' })
    : pick({
        pt: 'Instalar App',
        en: 'Install App',
        es: 'Instalar App',
        fr: "Installer l'App",
      });

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowGuide(true);
      }
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title={pick({
          pt: 'Criar atalho / Instalar App no celular ou computador',
          en: 'Add shortcut / Install App on phone or desktop',
          es: 'Crear acceso directo / Instalar App en móvil o PC',
          fr: "Créer un raccourci / Installer l'app sur mobile ou PC",
        })}
        className={`inline-flex items-center justify-center gap-1.5 font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer rounded-lg border ${
          compact
            ? 'px-2.5 py-1.5 text-xs border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            : 'px-3.5 py-2 text-xs border-[#1E40AF]/30 bg-blue-50 text-[#1E40AF] hover:bg-blue-100'
        } ${fullWidth ? 'w-full py-2.5 text-sm' : ''}`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label={pick({
            pt: 'Instalar JORQ como App Atalho',
            en: 'Install JORQ App Shortcut',
            es: 'Instalar Acceso Directo JORQ',
            fr: 'Installer le raccourci JORQ',
          })}
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl text-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#0F172A] text-white flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-[#0F172A]">
                    {pick({
                      pt: 'Adicionar Atalho / Instalar App JORQ',
                      en: 'Add JORQ Shortcut / Install App',
                      es: 'Agregar Acceso Directo / Instalar App JORQ',
                      fr: "Ajouter le raccourci / Installer l'App JORQ",
                    })}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {pick({
                      pt: 'Compatível com Android, iPhone, Xiaomi, Samsung e Computador',
                      en: 'Works on Android, iPhone, Xiaomi, Samsung & Desktop',
                      es: 'Compatible con Android, iPhone, Xiaomi, Samsung y PC',
                      fr: 'Compatible Android, iPhone, Xiaomi, Samsung & PC',
                    })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                aria-label={pick({ pt: 'Fechar', en: 'Close', es: 'Cerrar', fr: 'Fermer' })}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3 text-xs leading-relaxed">
              {/* iPhone / iPad iOS Safari */}
              <div
                className={`p-3.5 rounded-xl border ${
                  platform === 'ios'
                    ? 'border-[#1E40AF] bg-blue-50/70'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Share className="w-3.5 h-3.5 text-[#1E40AF]" />
                  <span>iPhone / iPad (Safari)</span>
                </p>
                <p className="mt-1 text-slate-600">
                  {pick({
                    pt: '1. Toque no ícone Compartilhar (quadrado com seta) na barra do Safari. 2. Role e toque em "Adicionar à Tela de Início".',
                    en: '1. Tap the Share icon in the Safari toolbar. 2. Scroll down and tap "Add to Home Screen".',
                    es: '1. Toque el botón Compartir en Safari. 2. Deslice y toque "Agregar a la pantalla de inicio".',
                    fr: "1. Touchez Partager dans Safari. 2. Faites défiler et touchez « Sur l'écran d'accueil ».",
                  })}
                </p>
              </div>

              {/* Xiaomi / Redmi / POCO (MIUI / HyperOS) */}
              <div
                className={`p-3.5 rounded-xl border ${
                  platform === 'xiaomi'
                    ? 'border-[#1E40AF] bg-blue-50/70'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <MoreVertical className="w-3.5 h-3.5 text-[#1E40AF]" />
                  <span>Xiaomi / Redmi / POCO (MIUI · Mi Browser ou Chrome)</span>
                </p>
                <p className="mt-1 text-slate-600">
                  {pick({
                    pt: 'No Chrome ou Navegador Mi, toque no menu (⋮ ou ≡), escolha "Adicionar à tela inicial" / "Instalar app" e permita criar atalho nas configurações da MIUI se solicitado.',
                    en: 'In Chrome or Mi Browser, open the menu (⋮ or ≡), tap "Add to Home screen" / "Install app", and allow home-screen shortcut permission in MIUI if prompted.',
                    es: 'En Chrome o Mi Browser, toque el menú (⋮ o ≡), elija "Agregar a la pantalla principal" / "Instalar aplicación" y permita crear accesos en MIUI.',
                    fr: "Dans Chrome ou Mi Browser, ouvrez le menu (⋮ ou ≡), touchez « Ajouter à l'écran d'accueil » et autorisez les raccourcis MIUI si demandé.",
                  })}
                </p>
              </div>

              {/* Android (Samsung, Motorola, Pixel, etc.) */}
              <div
                className={`p-3.5 rounded-xl border ${
                  platform === 'android'
                    ? 'border-[#1E40AF] bg-blue-50/70'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <MoreVertical className="w-3.5 h-3.5 text-[#1E40AF]" />
                  <span>Android (Samsung, Motorola, Chrome, Edge)</span>
                </p>
                <p className="mt-1 text-slate-600">
                  {pick({
                    pt: 'Toque no menu (⋮) no canto superior direito do navegador e selecione "Instalar aplicativo" ou "Adicionar à tela inicial".',
                    en: 'Tap the browser menu (⋮) at the top right and choose "Install app" or "Add to Home screen".',
                    es: 'Toque el menú (⋮) en la esquina superior derecha y seleccione "Instalar aplicación" o "Agregar a la pantalla principal".',
                    fr: "Touchez le menu (⋮) en haut à droite et choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil ».",
                  })}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full py-2.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              {pick({ pt: 'Entendi', en: 'Got it', es: 'Entendido', fr: 'Compris' })}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
