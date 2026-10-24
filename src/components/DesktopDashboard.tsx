import React from 'react';
import {
  Activity,
  Banknote,
  Bluetooth,
  Camera,
  FileText,
  Grid2X2,
  Hand,
  Map,
  MessageCircle,
  Mic,
  MicOff,
  Navigation,
  Phone,
  Settings,
  ShieldAlert,
  Sparkles,
  Volume2,
  Sun,
  Moon,
} from 'lucide-react';

export type DashboardTab =
  | 'navigation'
  | 'immersive-vr'
  | 'currency'
  | 'document'
  | 'sign-lang'
  | 'video-call'
  | 'bluetooth'
  | 'ai-search';

type Props = {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  isListening: boolean;
  onToggleListening: () => void;
  voiceFeedback?: string;
  assistantBusy?: boolean;
  onOpenSettings: () => void;
  onTriggerSOS: () => void;
  readingMode: boolean;
  onToggleReadingMode: () => void;
  children: React.ReactNode;
};

const features = [
  { id: 'navigation', title: 'Navigation', description: 'Voice & haptic guidance', icon: Navigation, color: 'cyan' },
  { id: 'sign-lang', title: 'Sign Language', description: 'ISL detection & translation', icon: Hand, color: 'violet' },
  { id: 'video-call', title: 'Messages & Calls', description: 'Accessible communication', icon: Phone, color: 'blue' },
  { id: 'document', title: 'Document Reader', description: 'Scan & read documents', icon: FileText, color: 'amber' },
  { id: 'currency', title: 'Currency Detector', description: 'Identify Indian currency', icon: Banknote, color: 'emerald' },
  { id: 'settings', title: 'Accessibility', description: 'Theme, audio & language', icon: Settings, color: 'sky' },
  { id: 'sos', title: 'Emergency SOS', description: 'Get help quickly', icon: ShieldAlert, color: 'red' },
  { id: 'immersive-vr', title: 'More Features', description: 'Explore assistive tools', icon: Grid2X2, color: 'slate' },
] as const;

const bottomItems = [
  { id: 'navigation', label: 'Camera / Map', icon: Camera },
  { id: 'ai-search', label: 'AI Assistant', icon: MessageCircle },
  { id: 'sign-lang', label: 'Sign Language', icon: Hand },
  { id: 'document', label: 'Documents', icon: FileText },
  { id: 'currency', label: 'Currency', icon: Banknote },
  { id: 'video-call', label: 'Calls', icon: Phone },
  { id: 'bluetooth', label: 'Devices', icon: Bluetooth },
  { id: 'immersive-vr', label: 'More', icon: Grid2X2 },
] as const;

const palette: Record<string, string> = {
  cyan: 'border-teal-400/40 bg-teal-400/10 text-teal-200',
  violet: 'border-violet-400/40 bg-violet-400/10 text-violet-200',
  blue: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
  amber: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  emerald: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  sky: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200',
  red: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
  slate: 'border-slate-500/50 bg-slate-800/60 text-slate-200',
};

export default function DesktopDashboard({
  activeTab,
  onSelectTab,
  isListening,
  onToggleListening,
  voiceFeedback,
  assistantBusy,
  onOpenSettings,
  onTriggerSOS,
  readingMode,
  onToggleReadingMode,
  children,
}: Props) {
  function activate(id: string) {
    if (id === 'settings') onOpenSettings();
    else if (id === 'sos') onTriggerSOS();
    else onSelectTab(id as DashboardTab);
  }

  return (
    <div className="premium-app min-h-screen font-sans transition-colors duration-300">
      <header className="premium-header sticky top-0 z-40 border-b px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="brand-mark flex h-10 w-10 items-center justify-center rounded-2xl">
              <Activity size={23} />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold tracking-wide">ACCESSIBILITY WORKSPACE</p>
              <p className="text-xs opacity-70">Drishti · Vani · Sparsh</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleReadingMode}
              aria-label={readingMode ? 'Switch to dark colour theme' : 'Switch to warm reading mode'}
              aria-pressed={readingMode}
              title={readingMode ? 'Switch to dark theme' : 'Warm reading mode'}
              className="theme-toggle flex h-11 w-11 items-center justify-center rounded-full border transition hover:scale-105"
            >
              {readingMode ? <Moon size={20} /> : <Sun size={21} />}
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Accessibility settings"
              className="icon-button flex h-11 w-11 items-center justify-center rounded-xl border transition"
            >
              <Settings size={20} />
            </button>
            <button
              type="button"
              onClick={onTriggerSOS}
              className="sos-button flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition hover:brightness-110"
            >
              <ShieldAlert size={17} /> <span className="hidden sm:inline">SOS</span>
            </button>
          </div>
        </div>

        <div className="mx-auto mt-3 flex max-w-[1800px] flex-wrap gap-2">
          {[
            '“Open navigation”',
            '“Open sign language”',
            '“Read document”',
            '“Detect currency”',
            '“Open calls”',
          ].map((command) => (
            <span key={command} className="command-chip rounded-full border px-3 py-1.5 text-xs">
              {command}
            </span>
          ))}
        </div>
      </header>

      <main className="mx-auto grid max-w-[1800px] grid-cols-1 items-start gap-5 p-3 pb-28 sm:p-5 sm:pb-28 xl:grid-cols-[260px_minmax(0,1fr)_290px]">
        <aside className="quick-panel rounded-3xl border p-3 sm:p-4">
          <div className="mb-4 flex items-center gap-2 px-1">
            <Grid2X2 className="accent-icon" size={19} />
            <h2 className="text-base font-bold">Quick access</h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {features.map((feature) => {
              const Icon = feature.icon;
              const selected = feature.id === activeTab;
              return (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() => activate(feature.id)}
                  className={`feature-tile flex min-h-28 flex-col items-center justify-center rounded-2xl border p-3 text-center transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${palette[feature.color]} ${selected ? 'feature-selected' : ''}`}
                  aria-current={selected ? 'page' : undefined}
                >
                  <Icon size={25} className="mb-2" />
                  <span className="text-xs font-bold sm:text-sm">{feature.title}</span>
                  <span className="mt-1 text-[11px] leading-snug opacity-75">{feature.description}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="workspace-panel min-w-0 rounded-3xl border p-3 sm:p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="accent-icon text-[10px] font-bold uppercase tracking-[0.24em]">Your assistive space</p>
              <h1 className="mt-1 text-xl font-bold sm:text-2xl">
                {bottomItems.find((item) => item.id === activeTab)?.label ?? 'Assistive tools'}
              </h1>
            </div>
            <span className="status-pill rounded-full border px-3 py-1.5 text-xs font-semibold">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Ready to assist
            </span>
          </div>

          <section className={`voice-command-center mb-5 rounded-3xl border p-4 sm:p-5 ${isListening ? 'voice-active' : ''}`}>
            <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
              <button
                type="button"
                onClick={onToggleListening}
                aria-pressed={isListening}
                className={`voice-orb flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full transition duration-200 hover:scale-105 ${isListening ? 'voice-orb-active' : ''}`}
              >
                {isListening ? <MicOff size={27} /> : <Mic size={27} />}
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold">
                  {isListening ? 'I’m listening' : 'What would you like to do?'}
                </h2>
                <p className="mt-1 text-sm opacity-75">
                  {assistantBusy
                    ? 'Understanding your request…'
                    : isListening
                      ? 'Speak naturally — try “open sign language” or ask a question.'
                      : 'Tap the microphone and tell me which feature you need.'}
                </p>
                {voiceFeedback && (
                  <p aria-live="polite" className="voice-feedback mt-2 break-words rounded-xl border px-3 py-2 text-sm">
                    {assistantBusy && <Sparkles size={15} className="mr-1 inline animate-pulse" />}
                    {voiceFeedback}
                  </p>
                )}
              </div>
              <button type="button" onClick={onOpenSettings} className="icon-button rounded-xl border px-3 py-2 text-sm">
                Accessibility settings
              </button>
            </div>
          </section>

          <div className="dashboard-module min-w-0">{children}</div>
        </section>

        <aside className="right-rail space-y-4">
          <section className="assistant-card rounded-3xl border p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="assistant-icon flex h-11 w-11 items-center justify-center rounded-2xl">
                <Sparkles size={22} />
              </div>
              <div>
                <h2 className="font-bold">Voice assistant</h2>
                <p className="text-xs opacity-70">Speak to control your workspace</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['Open navigation', 'Maps & guidance'],
                ['Open sign language', 'ISL communication'],
                ['Read document', 'Document reader'],
                ['Detect currency', 'Currency detector'],
                ['Open calls', 'Messages & calls'],
                ['Emergency help', 'SOS support'],
              ].map(([phrase, destination]) => (
                <div key={phrase} className="command-row flex items-center justify-between gap-2 rounded-xl border px-3 py-2">
                  <span>“{phrase}”</span>
                  <span className="accent-icon text-right text-[11px]">{destination}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="assistant-card rounded-3xl border p-4">
            <div className="mb-3 flex items-center gap-2">
              <MessageCircle className="accent-icon" size={19} />
              <h2 className="font-bold">Assistant activity</h2>
            </div>
            <div aria-live="polite" className="transcript-box min-h-24 break-words rounded-2xl border p-3 text-sm">
              {assistantBusy ? (
                <span className="accent-icon"><Sparkles size={15} className="mr-1 inline animate-pulse" /> Understanding your request…</span>
              ) : voiceFeedback || (isListening ? 'Listening for your command…' : 'Your voice requests will appear here.')}
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={onToggleListening} className="primary-button flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold">
                {isListening ? <MicOff size={17} /> : <Mic size={17} />}
                {isListening ? 'Stop listening' : 'Start listening'}
              </button>
              <button type="button" onClick={() => window.speechSynthesis?.cancel()} className="icon-button rounded-xl border px-3" aria-label="Stop spoken response">
                <Volume2 size={18} />
              </button>
            </div>
          </section>

          <section className="assistant-card rounded-3xl border p-4">
            <div className="flex items-center gap-3">
              <Map className="accent-icon" size={22} />
              <div>
                <h2 className="font-bold">Navigation & devices</h2>
                <p className="text-xs opacity-70">Maps and assistive hardware</p>
              </div>
            </div>
            <button type="button" onClick={() => onSelectTab('navigation')} className="secondary-button mt-3 w-full rounded-xl border px-3 py-3 text-sm">
              Open navigation
            </button>
            <button type="button" onClick={() => onSelectTab('bluetooth')} className="secondary-button mt-2 w-full rounded-xl border px-3 py-3 text-sm">
              Manage connected devices
            </button>
          </section>
        </aside>
      </main>

      <nav className="bottom-nav fixed inset-x-0 bottom-0 z-50 border-t px-2 py-2 backdrop-blur-xl" aria-label="Main navigation">
        <div className="mx-auto flex max-w-[1500px] gap-1 overflow-x-auto">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const selected = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={selected ? 'page' : undefined}
                className={`bottom-nav-item flex min-w-20 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold transition sm:min-w-24 sm:text-xs ${selected ? 'bottom-nav-active' : ''}`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
