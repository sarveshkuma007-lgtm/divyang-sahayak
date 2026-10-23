import React from 'react';
import { 
  X, 
  Sun, 
  Contrast, 
  Type, 
  BookOpen, 
  Vibrate, 
  Volume2, 
  Ear, 
  ShieldCheck, 
  Palette,
  Check
} from 'lucide-react';
import { SensorySettings, SensoryTheme } from '../types';
import { getTranslation } from '../services/localization';
import { triggerHaptic, HAPTIC_PATTERNS } from '../services/haptics';

interface SensoryControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SensorySettings;
  onUpdateSettings: (newSettings: Partial<SensorySettings>) => void;
  hearingAidConnected: boolean;
  hearingAidBattery: number;
  onToggleHearingAidSync: () => void;
}

export const SensoryControlsModal: React.FC<SensoryControlsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  hearingAidConnected,
  hearingAidBattery,
  onToggleHearingAidSync,
}) => {
  if (!isOpen) return null;

  const t = (key: string) => getTranslation(settings.uiLanguage, key);

  const themeOptions: { id: SensoryTheme; name: string; desc: string; sampleBg: string; sampleFg: string }[] = [
    {
      id: 'eye-comfort',
      name: 'Soft Eye-Comfort (Deaf & Sensory Friendly)',
      desc: 'Gentle, anti-glare slate palette designed to prevent sensory fatigue.',
      sampleBg: 'bg-slate-900',
      sampleFg: 'text-slate-100',
    },
    {
      id: 'calm-forest',
      name: 'Calm Sage / Forest',
      desc: 'Natural earthy tones that lower eye strain during long navigation.',
      sampleBg: 'bg-emerald-950',
      sampleFg: 'text-emerald-100',
    },
    {
      id: 'warm-amber',
      name: 'Warm Amber Sepia',
      desc: 'Warm paper feel for low light environments and evening usage.',
      sampleBg: 'bg-amber-950',
      sampleFg: 'text-amber-100',
    },
    {
      id: 'high-contrast-dark',
      name: 'High-Contrast OLED Dark',
      desc: 'Pitch black background with 100% WCAG AAA luminous yellow & white text.',
      sampleBg: 'bg-black',
      sampleFg: 'text-yellow-400',
    },
    {
      id: 'high-contrast-light',
      name: 'High-Contrast Daylight',
      desc: 'Maximized clarity for outdoor direct sunlight navigation.',
      sampleBg: 'bg-white',
      sampleFg: 'text-black',
    },
    {
      id: 'monochrome',
      name: 'Monochrome Grayscale',
      desc: 'Zero chromatic interference for photophobia and color sensitivity.',
      sampleBg: 'bg-neutral-900',
      sampleFg: 'text-neutral-200',
    },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sensory-modal-title"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl p-4 sm:p-6 space-y-6">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-cyan-400" />
            <h2 id="sensory-modal-title" className="text-lg font-bold">
              Accessibility & Sensory Control Center
            </h2>
          </div>
          <button
            onClick={() => {
              triggerHaptic(HAPTIC_PATTERNS.CLICK);
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close accessibility settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Non-Irritating Eye Comfort & Themes */}
        <div className="space-y-3">
          <label className="text-sm font-semibold flex items-center gap-2 text-slate-200">
            <Palette className="w-4 h-4 text-cyan-400" />
            Sensory-Safe Color Palettes (Deaf & Neurodivergent Comfort)
          </label>
          <p className="text-xs text-slate-400">
            Calibrated color palettes that avoid harsh blue light spikes and flicker to prevent sensory overwhelm.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {themeOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  triggerHaptic(HAPTIC_PATTERNS.CLICK);
                  onUpdateSettings({ theme: opt.id });
                }}
                className={`p-3 rounded-xl border text-left flex items-start justify-between transition-all ${
                  settings.theme === opt.id
                    ? 'border-cyan-400 bg-cyan-950/30 ring-1 ring-cyan-400'
                    : 'border-slate-800 bg-slate-800/50 hover:border-slate-700'
                }`}
              >
                <div className="space-y-1 pr-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-3.5 h-3.5 rounded-full border border-slate-600 ${opt.sampleBg}`} />
                    <span className="text-xs font-semibold text-slate-200">{opt.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">{opt.desc}</p>
                </div>
                {settings.theme === opt.id && (
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Adaptive Brightness & Contrast Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-800">
          {/* Brightness */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-300">
              <span className="flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-amber-400" />
                Screen Brightness
              </span>
              <span className="font-mono text-cyan-300">{settings.brightness}%</span>
            </div>
            <input
              type="range"
              min="70"
              max="130"
              value={settings.brightness}
              onChange={(e) => onUpdateSettings({ brightness: parseInt(e.target.value, 10) })}
              className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-700 rounded-lg"
              aria-label="Adjust screen brightness"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Dim (70%)</span>
              <span>Default (100%)</span>
              <span>Ultra-Bright (130%)</span>
            </div>
          </div>

          {/* Contrast */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-300">
              <span className="flex items-center gap-1.5">
                <Contrast className="w-4 h-4 text-cyan-400" />
                Adaptive Contrast
              </span>
              <span className="font-mono text-cyan-300">{settings.contrast}%</span>
            </div>
            <input
              type="range"
              min="80"
              max="150"
              value={settings.contrast}
              onChange={(e) => onUpdateSettings({ contrast: parseInt(e.target.value, 10) })}
              className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-700 rounded-lg"
              aria-label="Adjust display contrast"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Gentle (80%)</span>
              <span>Standard (100%)</span>
              <span>High (150%)</span>
            </div>
          </div>
        </div>

        {/* Section 3: Typography Scale & Bionic Reading Mode */}
        <div className="space-y-3 p-4 rounded-xl bg-slate-800/40 border border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1.5 text-slate-200">
                <Type className="w-4 h-4 text-cyan-400" />
                Text Typography Size
              </h3>
              <p className="text-xs text-slate-400">Scales UI text for low-vision readability.</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
              {(['standard', 'large', 'extra-large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    triggerHaptic(HAPTIC_PATTERNS.CLICK);
                    onUpdateSettings({ fontSize: size });
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                    settings.fontSize === size
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {size.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-700/60">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-slate-200">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                Bionic Reading Mode
              </span>
              <p className="text-[11px] text-slate-400">
                Bolds the initial letters of each word to guide the eye and reduce reading strain.
              </p>
            </div>
            <button
              onClick={() => {
                triggerHaptic(HAPTIC_PATTERNS.CLICK);
                onUpdateSettings({ bionicReading: !settings.bionicReading });
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.bionicReading ? 'bg-cyan-500' : 'bg-slate-700'
              }`}
              role="switch"
              aria-checked={settings.bionicReading}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.bionicReading ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Section 4: Tactile Haptics & Sound Radar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Haptic Toggles */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-slate-200">
                <Vibrate className="w-4 h-4 text-cyan-400" />
                Tactile Haptics (Vibrations)
              </span>
              <p className="text-[11px] text-slate-400">Directional pulses on turns & obstacles</p>
            </div>
            <button
              onClick={() => {
                triggerHaptic(HAPTIC_PATTERNS.CLICK);
                onUpdateSettings({ hapticFeedback: !settings.hapticFeedback });
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.hapticFeedback ? 'bg-cyan-500' : 'bg-slate-700'
              }`}
              role="switch"
              aria-checked={settings.hapticFeedback}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.hapticFeedback ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Sound Radar Toggles */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-slate-200">
                <Volume2 className="w-4 h-4 text-amber-400" />
                Acoustic Radar Beacon
              </span>
              <p className="text-[11px] text-slate-400">Audio pitch increases with obstacle proximity</p>
            </div>
            <button
              onClick={() => {
                triggerHaptic(HAPTIC_PATTERNS.CLICK);
                onUpdateSettings({ soundRadar: !settings.soundRadar });
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.soundRadar ? 'bg-cyan-500' : 'bg-slate-700'
              }`}
              role="switch"
              aria-checked={settings.soundRadar}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.soundRadar ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Section 5: Automated Hearing Aid & Bluetooth Peripheral Synchronization */}
        <div className="p-4 rounded-xl bg-slate-800/60 border border-cyan-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ear className="w-5 h-5 text-cyan-400" />
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white">
                  Automated Hearing Aid & Bluetooth Audio Sync
                </h4>
                <p className="text-[11px] text-slate-300">
                  Auto-routes high-clarity speech to cochlear implants and BLE hearing aids.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                triggerHaptic(HAPTIC_PATTERNS.SUCCESS);
                onToggleHearingAidSync();
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                hearingAidConnected
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white border-transparent'
              }`}
            >
              {hearingAidConnected ? `Synced (${hearingAidBattery}%)` : 'Sync Hearing Aid'}
            </button>
          </div>

          {hearingAidConnected && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-700 text-xs">
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Battery Level</span>
                <span className="font-mono text-emerald-400 font-bold">{hearingAidBattery}%</span>
              </div>
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Audio Profile</span>
                <span className="text-cyan-300 font-semibold">Speech+</span>
              </div>
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Telecoil Mode</span>
                <span className="text-slate-300 font-semibold">Active</span>
              </div>
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Noise Filter</span>
                <span className="text-emerald-400 font-semibold">-18 dB</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={() => {
              triggerHaptic(HAPTIC_PATTERNS.CLICK);
              onClose();
            }}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors"
          >
            {t('saveSettings')}
          </button>
        </div>

      </div>
    </div>
  );
};
