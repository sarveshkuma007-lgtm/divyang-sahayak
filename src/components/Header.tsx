import React, { useState, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Ear, 
  Eye, 
  SlidersHorizontal, 
  AlertTriangle, 
  Globe, 
  Check, 
  Volume2, 
  Sparkles 
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
  const t = (key: string) => getTranslation(settings.uiLanguage, key);

  const languages: { code: SensorySettings['uiLanguage']; label: string; native: string }[] = [
    { code: 'hi', label: 'Hindi', native: 'हिंदी' },
    { code: 'en', label: 'English', native: 'English' },
    { code: 'es', label: 'Spanish', native: 'Español' },
    { code: 'bn', label: 'Bengali', native: 'বাংলা' },
    { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
    { code: 'mr', label: 'Marathi', native: 'मराठी' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b backdrop-blur-md transition-colors duration-200 border-slate-700/40 bg-slate-900/95 text-slate-100">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
        
        {/* Brand & Identity */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center shrink-0 text-cyan-400">
            <Eye className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                {t('appName')}
              </h1>
              <span className="text-xs text-cyan-400 font-mono hidden md:inline">
                · Drishti-Vani-Sparsh
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate hidden sm:block">
              {t('tagline')}
            </p>
          </div>
        </div>

        {/* Global Accessible Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">

          {/* Voice Command Button with Real-time Mic Activity */}
          <button
            onClick={() => {
              triggerHaptic(HAPTIC_PATTERNS.CLICK);
              onToggleListening();
            }}
            aria-label={isListening ? "Listening to voice commands. Click to stop." : "Activate hands-free voice command system"}
            className={`relative flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg border transition-all ${
              isListening
                ? 'bg-red-500/20 border-red-500 text-red-200 ring-2 ring-red-500/40 animate-pulse'
                : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800 hover:border-slate-600'
            }`}
          >
            {isListening ? (
              <>
                <Mic className="w-4 h-4 text-red-400 animate-bounce" />
                <span className="hidden xs:inline">{t('listening')}</span>
                <span className="inline-block w-2 h-2 rounded-full bg-red-400"></span>
              </>
            ) : (
              <>
                <MicOff className="w-4 h-4 text-cyan-400" />
                <span className="hidden xs:inline">{t('voiceNav')}</span>
              </>
            )}
          </button>

          {/* Bluetooth / Hearing Aid Sync Status Badge */}
          <button
            onClick={onOpenSettings}
            aria-label="Hearing aid status and bluetooth audio manager"
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:bg-slate-800 transition-colors"
            title={hearingAidConnected ? `Hearing Aid Synced (${hearingAidBattery}%)` : 'Hearing Aid Disconnected'}
          >
            <Ear className={`w-3.5 h-3.5 ${hearingAidConnected ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">
              {hearingAidConnected ? `${hearingAidBattery}%` : 'Sync Aid'}
            </span>
            <span className={`w-1.5 h-1.5 rounded-full ${hearingAidConnected ? 'bg-emerald-400' : 'bg-amber-500'}`} />
          </button>

          {/* Language Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors"
              aria-label="Change UI Language"
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span className="uppercase font-mono">{settings.uiLanguage}</span>
            </button>

            {langMenuOpen && (
              <div 
                className="absolute right-0 mt-2 w-48 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                role="menu"
              >
                <div className="px-3 py-1.5 border-b border-slate-700/70 text-[11px] font-semibold text-slate-400">
                  Select Language / भाषा चुनें
                </div>
                {languages.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      triggerHaptic(HAPTIC_PATTERNS.CLICK);
                      onSelectLanguage(l.code);
                      setLangMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                      settings.uiLanguage === l.code
                        ? 'bg-cyan-950/60 text-cyan-300 font-semibold'
                        : 'text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    <span>{l.native} ({l.label})</span>
                    {settings.uiLanguage === l.code && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sensory Accessibility Settings Modal Trigger */}
          <button
            onClick={() => {
              triggerHaptic(HAPTIC_PATTERNS.CLICK);
              onOpenSettings();
            }}
            aria-label="Open Accessibility Sensory Dashboard"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">{t('comfortMode')}</span>
          </button>

          {/* Emergency SOS Button (Instant Trigger) */}
          <button
            onClick={() => {
              triggerHaptic(HAPTIC_PATTERNS.EMERGENCY_SOS);
              onTriggerSOS();
            }}
            aria-label="Trigger Emergency SOS and send GPS beacon"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-900/30 border border-red-400/30 transition-transform active:scale-95"
          >
            <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
            <span className="tracking-wide">{t('emergencySOS')}</span>
          </button>

        </div>
      </div>

      {/* Auto-detected voice feedback notification banner */}
      {detectedLangText && (
        <div className="bg-cyan-950/70 border-t border-cyan-800/40 px-4 py-1 text-xs text-cyan-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>{detectedLangText}</span>
          </div>
          <span className="text-[10px] text-cyan-400/80 font-mono">Auto-detected speech</span>
        </div>
      )}
    </header>
  );
};
