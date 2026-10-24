import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Ear,
  Eye,
  SlidersHorizontal,
  AlertTriangle,
  Globe,
  Check,
  Sparkles,
  ChevronDown,
} from 'lucide-react';

import { SensorySettings } from '../types';
import { getTranslation } from '../services/localization';
import { triggerHaptic, HAPTIC_PATTERNS } from '../services/haptics';

interface HeaderProps {
  settings: SensorySettings;
  onOpenSettings: () => void;
  onTriggerSOS: () => void;
  isListening: boolean;
  onToggleListening: () => void;
  detectedLangText?: string;
  onSelectLanguage: (lang: SensorySettings['uiLanguage']) => void;
  hearingAidConnected: boolean;
  hearingAidBattery: number;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  onOpenSettings,
  onTriggerSOS,
  isListening,
  onToggleListening,
  detectedLangText,
  onSelectLanguage,
  hearingAidConnected,
  hearingAidBattery,
}) => {
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);

  const t = (key: string) => getTranslation(settings.uiLanguage, key);

  const languages: {
    code: SensorySettings['uiLanguage'];
    label: string;
    native: string;
  }[] = [
    { code: 'hi', label: 'Hindi', native: 'हिंदी' },
    { code: 'en', label: 'English', native: 'English' },
    { code: 'es', label: 'Spanish', native: 'Español' },
    { code: 'bn', label: 'Bengali', native: 'বাংলা' },
    { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
    { code: 'mr', label: 'Marathi', native: 'मराठी' },
  ];

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        languageMenuRef.current &&
        !languageMenuRef.current.contains(event.target as Node)
      ) {
        setLangMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLangMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-700/40 bg-slate-900/95 text-slate-100 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6">
        {/* Brand */}
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-600/20 text-cyan-300">
            <Eye className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-bold tracking-tight text-white sm:text-lg">
                {t('appName')}
              </h1>

              <span className="hidden font-mono text-xs text-cyan-300 lg:inline">
                · Drishti-Vani-Sparsh
              </span>
            </div>

            <p className="hidden truncate text-xs text-slate-300 sm:block">
              {t('tagline')}
            </p>
          </div>
        </div>

        {/* Accessible controls */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Voice commands */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(HAPTIC_PATTERNS.CLICK);
              onToggleListening();
            }}
            aria-label={
              isListening
                ? 'Listening to voice commands. Click to stop.'
                : 'Activate voice commands'
            }
            aria-pressed={isListening}
            className={`relative flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
              isListening
                ? 'border-red-400 bg-red-950 text-white'
                : 'border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700'
            }`}
          >
            {isListening ? (
              <>
                <Mic className="h-4 w-4 text-red-300" aria-hidden="true" />
                <span className="hidden sm:inline">{t('listening')}</span>
                <span className="h-2 w-2 rounded-full bg-red-300" />
              </>
            ) : (
              <>
                <MicOff className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                <span className="hidden sm:inline">{t('voiceNav')}</span>
              </>
            )}
          </button>

          {/* Hearing aid status */}
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={
              hearingAidConnected
                ? `Hearing aid connected, battery ${hearingAidBattery} percent`
                : 'Hearing aid disconnected. Open accessibility settings'
            }
            title={
              hearingAidConnected
                ? `Hearing Aid Connected (${hearingAidBattery}%)`
                : 'Hearing Aid Disconnected'
            }
            className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs text-slate-100 transition-colors hover:bg-slate-700 sm:px-2.5"
          >
            <Ear
              className={`h-4 w-4 ${
                hearingAidConnected ? 'text-emerald-300' : 'text-amber-300'
              }`}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">
              {hearingAidConnected ? `${hearingAidBattery}%` : 'Sync Aid'}
            </span>
            <span
              className={`h-2 w-2 rounded-full ${
                hearingAidConnected ? 'bg-emerald-300' : 'bg-amber-300'
              }`}
              aria-hidden="true"
            />
          </button>

          {/* Language dropdown */}
          <div className="relative" ref={languageMenuRef}>
            <button
              type="button"
              onClick={() => setLangMenuOpen((open) => !open)}
              aria-label="Change interface language"
              aria-haspopup="menu"
              aria-expanded={langMenuOpen}
              className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-2 text-xs font-semibold text-slate-100 transition-colors hover:bg-slate-700"
            >
              <Globe className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              <span className="font-mono uppercase">{settings.uiLanguage}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
                  langMenuOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {langMenuOpen && (
              <div
                className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-600 bg-slate-800 py-1 shadow-xl"
                role="menu"
                aria-label="Available languages"
              >
                <div className="border-b border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200">
                  Select Language / भाषा चुनें
                </div>

                {languages.map((language) => {
                  const selected = settings.uiLanguage === language.code;

                  return (
                    <button
                      key={language.code}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      onClick={() => {
                        triggerHaptic(HAPTIC_PATTERNS.CLICK);
                        onSelectLanguage(language.code);
                        setLangMenuOpen(false);
                      }}
                      className={`flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${
                        selected
                          ? 'bg-cyan-950 text-cyan-100'
                          : 'text-slate-100 hover:bg-slate-700'
                      }`}
                    >
                      <span>
                        {language.native}{' '}
                        <span className="text-slate-300">
                          ({language.label})
                        </span>
                      </span>

                      {selected && (
                        <Check
                          className="h-4 w-4 shrink-0 text-cyan-300"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Accessibility settings */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(HAPTIC_PATTERNS.CLICK);
              onOpenSettings();
            }}
            aria-label="Open accessibility and sensory settings"
            className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-2 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-700"
          >
            <SlidersHorizontal
              className="h-4 w-4 text-amber-300"
              aria-hidden="true"
            />
            <span className="hidden lg:inline">{t('comfortMode')}</span>
          </button>

          {/* Emergency SOS */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(HAPTIC_PATTERNS.EMERGENCY_SOS);
              onTriggerSOS();
            }}
            aria-label="Trigger emergency SOS"
            className="flex items-center gap-1.5 rounded-lg border border-red-400/50 bg-red-700 px-2.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-600 active:scale-95 sm:px-3"
          >
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('emergencySOS')}</span>
            <span className="sm:hidden">SOS</span>
          </button>
        </div>
      </div>

      {/* Voice recognition feedback */}
      {detectedLangText && (
        <div
          className="flex items-center justify-between gap-3 border-t border-cyan-800/50 bg-cyan-950 px-4 py-2 text-xs text-cyan-100"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <Sparkles
              className="h-4 w-4 shrink-0 text-cyan-300"
              aria-hidden="true"
            />
            <span>{detectedLangText}</span>
          </div>

          <span className="hidden shrink-0 font-mono text-cyan-200 sm:inline">
            Auto-detected speech
          </span>
        </div>
      )}
    </header>
  );
};