
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
  children: React.ReactNode;
};

const features = [
  {
    id: 'navigation',
    title: 'Navigation',
    description: 'Voice & haptic guidance',
    icon: Navigation,
    color: 'cyan',
  },
  {
    id: 'sign-lang',
    title: 'Sign Language',
    description: 'ISL detection & translation',
    icon: Hand,
    color: 'violet',
  },
  {
    id: 'video-call',
    title: 'Messages & Calls',
    description: 'Accessible communication',
    icon: Phone,
    color: 'blue',
  },
  {
    id: 'document',
    title: 'Document Reader',
    description: 'Scan & read documents',
    icon: FileText,
    color: 'amber',
  },
  {
    id: 'currency',
    title: 'Currency Detector',
    description: 'Identify Indian currency',
    icon: Banknote,
    color: 'emerald',
  },
  {
    id: 'settings',
    title: 'Accessibility',
    description: 'Theme, audio & language',
    icon: Settings,
    color: 'sky',
  },
  {
    id: 'sos',
    title: 'Emergency SOS',
    description: 'Get help quickly',
    icon: ShieldAlert,
    color: 'red',
  },
  {
    id: 'immersive-vr',
    title: 'More Features',
    description: 'Explore assistive tools',
    icon: Grid2X2,
    color: 'slate',
  },
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
  cyan: 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300',
  violet: 'border-violet-500/60 bg-violet-500/10 text-violet-300',
  blue: 'border-blue-500/60 bg-blue-500/10 text-blue-300',
  amber: 'border-amber-500/60 bg-amber-500/10 text-amber-300',
  emerald: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300',
  sky: 'border-sky-500/60 bg-sky-500/10 text-sky-300',
  red: 'border-red-500/60 bg-red-500/10 text-red-300',
  slate: 'border-slate-600 bg-slate-900 text-slate-300',
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
  children,
}: Props) {
  function activate(id: string) {
    if (id === 'settings') {
      onOpenSettings();
    } else if (id === 'sos') {
      onTriggerSOS();
    } else {
      onSelectTab(id as DashboardTab);
    }
  }

  return (
    <div className="min-h-screen bg-[#030b14] text-slate-100">
      {/* Header */}
      <header className="border-b border-cyan-900/60 bg-[#06121f] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/60 bg-cyan-500/10 text-cyan-300">
              <Activity size={30} />
            </div>

            <div>
              <h1 className="text-xl font-extrabold sm:text-2xl">
                Divyang Sahayak
              </h1>
              <p className="text-sm text-cyan-300">
                Drishti · Vani · Sparsh
              </p>
              <p className="text-xs text-slate-400">
                सशक्त जीवन, सुलभ भारत
              </p>
            </div>
          </div>

          <button
            onClick={onToggleListening}
            aria-pressed={isListening}
            className={`flex min-h-12 items-center justify-center gap-3 rounded-2xl border px-5 py-3 font-semibold transition ${
              isListening
                ? 'border-rose-400 bg-rose-500/15 text-rose-200'
                : 'border-cyan-700 bg-slate-900 text-cyan-100 hover:border-cyan-400'
            }`}
          >
            {isListening ? <Activity className="animate-pulse" /> : <Mic />}
            {isListening
              ? 'Listening — say a command'
              : 'Start voice commands'}
            {isListening && (
              <span className="h-2 w-2 rounded-full bg-rose-400" />
            )}
          </button>

          <button
            onClick={onOpenSettings}
            className="rounded-xl border border-slate-700 bg-slate-900 p-3 hover:border-cyan-400"
            aria-label="Accessibility settings"
          >
            <Settings size={21} />
          </button>

          <button
            onClick={onTriggerSOS}
            className="rounded-xl border border-red-500/60 bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-500"
          >
            <ShieldAlert className="mr-2 inline" size={18} />
            SOS
          </button>
        </div>

        <div className="mx-auto mt-4 flex max-w-[1800px] flex-wrap gap-2">
          {[
            '“Open navigation”',
            '“Open sign language”',
            '“Read document”',
            '“Detect currency”',
            '“Open calls”',
            '“Open settings”',
          ].map((command) => (
            <span
              key={command}
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300"
            >
              {command}
            </span>
          ))}
        </div>
      </header>

      {/* Main dashboard */}
      <main className="mx-auto grid max-w-[1800px] grid-cols-1 gap-4 p-4 xl:grid-cols-[300px_minmax(400px,1fr)_310px]">
        {/* Quick action cards */}
        <aside className="rounded-2xl border border-cyan-900/70 bg-[#061522] p-4">
          <div className="mb-4 flex items-center gap-2">
            <Grid2X2 className="text-cyan-300" size={21} />
            <h2 className="text-lg font-bold">Quick Actions</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              const selected = feature.id === activeTab;

              return (
                <button
                  key={feature.id}
                  onClick={() => activate(feature.id)}
                  className={`flex min-h-32 flex-col items-center justify-center rounded-2xl border p-3 text-center transition hover:brightness-125 ${
                    palette[feature.color]
                  } ${
                    selected ? 'ring-2 ring-white/60' : ''
                  }`}
                >
                  <Icon size={29} className="mb-2" />
                  <span className="text-sm font-bold text-white">
                    {feature.title}
                  </span>
                  <span className="mt-1 text-xs leading-snug text-slate-300">
                    {feature.description}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Existing feature modules render here */}
        <section className="min-w-0 rounded-2xl border border-cyan-900/70 bg-[#06121e] p-3 sm:p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
                Assistive workspace
              </p>
              <h2 className="text-xl font-bold">
                {bottomItems.find((item) => item.id === activeTab)?.label ??
                  'Accessibility tools'}
              </h2>
            </div>

            <span className="rounded-full border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
              ● Module active
            </span>
          </div>

          <div className="dashboard-module min-w-0">
            {children}
          </div>
        </section>

        {/* Voice assistant panel */}
        <aside className="space-y-4">
          <section className="rounded-2xl border border-violet-900/70 bg-[#071522] p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-violet-500/15 p-3 text-violet-300">
                <Mic size={24} />
              </div>
              <div>
                <h2 className="font-bold">Voice Commands</h2>
                <p className="text-xs text-slate-400">
                  Control the app by speaking
                </p>
              </div>
            </div>

            {[
              ['“Open navigation”', 'Navigation'],
              ['“Open sign language”', 'ISL Communication'],
              ['“Read document”', 'Document Reader'],
              ['“Detect currency”', 'Currency Detector'],
              ['“Open calls”', 'Messages & Calls'],
              ['“Open settings”', 'Accessibility'],
              ['“Emergency help”', 'SOS support'],
            ].map(([phrase, destination]) => (
              <div
                key={phrase}
                className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
              >
                <span>{phrase}</span>
                <span className="text-right text-xs text-cyan-300">
                  {destination}
                </span>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-cyan-900/70 bg-[#071522] p-4">
            <div className="mb-3 flex items-center gap-2">
              <MessageCircle className="text-cyan-300" size={20} />
              <h2 className="font-bold">Live Transcript</h2>
            </div>

            <div
              aria-live="polite"
              className="min-h-24 break-words rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm"
            >
              {assistantBusy ? (
                <span className="flex items-center gap-2 text-cyan-200">
                  <Sparkles size={16} className="animate-pulse" />
                  Preparing response…
                </span>
              ) : (
                voiceFeedback ||
                (isListening
                  ? 'Listening for your command…'
                  : 'Start voice commands, then speak naturally.')
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={onToggleListening}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-400"
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                {isListening ? 'Stop listening' : 'Start listening'}
              </button>

              <button
                onClick={() => window.speechSynthesis?.cancel()}
                className="rounded-xl border border-slate-700 px-3 text-slate-300 hover:border-cyan-500"
                aria-label="Stop spoken response"
              >
                <Volume2 size={18} />
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-[#071522] p-4">
            <div className="flex items-center gap-3">
              <Map className="text-cyan-300" size={23} />
              <div>
                <h2 className="font-bold">Navigation & Devices</h2>
                <p className="text-xs text-slate-400">
                  Access maps and assistive hardware
                </p>
              </div>
            </div>

            <button
              onClick={() => onSelectTab('navigation')}
              className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm hover:border-cyan-500"
            >
              Open navigation
            </button>

            <button
              onClick={() => onSelectTab('bluetooth')}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm hover:border-cyan-500"
            >
              Manage connected devices
            </button>
          </section>
        </aside>
      </main>

      {/* Bottom navigation */}
      <nav
        className="sticky bottom-0 z-30 border-t border-cyan-900/60 bg-[#04101b]/95 px-2 py-2 backdrop-blur-xl"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex max-w-[1500px] gap-1 overflow-x-auto">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const selected = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                aria-current={selected ? 'page' : undefined}
                className={`flex min-w-24 flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold ${
                  selected
                    ? 'bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/50'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={21} />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
