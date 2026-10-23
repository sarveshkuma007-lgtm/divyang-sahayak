
import React, { useState, useEffect, useRef } from 'react';
import {
  Navigation,
  Headphones,
  Banknote,
  FileText,
  Hand,
  Video,
  Bluetooth,
  Search,
} from 'lucide-react';

import { SensorySettings } from './types';
import { Header } from './components/Header';
import { SensoryControlsModal } from './components/SensoryControlsModal';
import { NavigationModule } from './components/NavigationModule';
import { ImmersiveVRBlindModule } from './components/ImmersiveVRBlindModule';
import { CurrencyDetectorModule } from './components/CurrencyDetectorModule';
import { DocumentScannerModule } from './components/DocumentScannerModule';
import { SignLanguageModule } from './components/SignLanguageModule';
import { WebRTCCallModule } from './components/WebRTCCallModule';
import ConnectMessagesCalls from './components/ConnectMessagesCalls';
import { BluetoothSyncModule } from './components/BluetoothSyncModule';
import { EmergencySOSModal } from './components/EmergencySOSModal';
import { AiChatSearchModule } from './components/AiChatSearchModule';
import { getTranslation } from './services/localization';
import { triggerHaptic, HAPTIC_PATTERNS } from './services/haptics';
import { parseVoiceIntent, speakText } from './services/speechService';

export default function App() {
  const [settings, setSettings] = useState<SensorySettings>({
    theme: 'eye-comfort',
    brightness: 100,
    contrast: 105,
    fontSize: 'standard',
    bionicReading: false,
    hapticFeedback: true,
    soundRadar: true,
    voiceSpeed: 1.0,
    uiLanguage: 'hi',
  });

  const [activeTab, setActiveTab] = useState<
    | 'navigation'
    | 'immersive-vr'
    | 'currency'
    | 'document'
    | 'sign-lang'
    | 'video-call'
    | 'bluetooth'
    | 'ai-search'
  >('navigation');

  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [bluetoothModalOpen, setBluetoothModalOpen] = useState(false);

  const [hearingAidConnected, setHearingAidConnected] = useState(true);
  const [hearingAidBattery, setHearingAidBattery] = useState(88);

  const [isListening, setIsListening] = useState(false);
  const [detectedVoiceFeedback, setDetectedVoiceFeedback] =
    useState<string | undefined>();

  const speechRecognitionRef = useRef<any>(null);

  const t = (key: string) =>
    getTranslation(settings.uiLanguage, key);

  const handleUpdateSettings = (
    partial: Partial<SensorySettings>
  ) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const handleToggleHearingAid = () => {
    setHearingAidConnected((prev) => !prev);
  };

  const toggleListening = () => {
    if (isListening) {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // Recognition may already have stopped.
        }
      }

      setIsListening(false);
      setDetectedVoiceFeedback(undefined);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      speakText(
        'Voice recognition not supported in this browser. Please use on-screen controls.',
        settings.uiLanguage,
        settings.voiceSpeed
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang =
        settings.uiLanguage === 'hi' ? 'hi-IN' : 'en-US';

      recognition.onresult = (event: any) => {
        const lastIdx = event.results.length - 1;
        const transcript =
          event.results[lastIdx][0].transcript;

        processVoiceCommand(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition event:', event);
      };

      recognition.onend = () => {
        if (isListening) {
          try {
            recognition.start();
          } catch {
            // Ignore restart errors.
          }
        }
      };

      recognition.start();
      speechRecognitionRef.current = recognition;
      setIsListening(true);

      triggerHaptic(HAPTIC_PATTERNS.CLICK);

      speakText(
        settings.uiLanguage === 'hi'
          ? 'आवाज सहायक सक्रिय है। बोलिए।'
          : 'Voice assistant active. Speak any command.',
        settings.uiLanguage,
        settings.voiceSpeed
      );
    } catch (error) {
      console.warn('Could not start recognition', error);
    }
  };

  useEffect(() => {
    return () => {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // Recognition may already have stopped.
        }
      }
    };
  }, []);

  const processVoiceCommand = (transcript: string) => {
    const parsed = parseVoiceIntent(transcript);

    if (
      parsed.detectedLang &&
      parsed.detectedLang !== settings.uiLanguage
    ) {
      handleUpdateSettings({
        uiLanguage: parsed.detectedLang,
      });
    }

    setDetectedVoiceFeedback(
      `Heard: "${transcript}" · Switched to ${parsed.detectedLang.toUpperCase()}`
    );

    switch (parsed.intent) {
      case 'SOS':
        setSosModalOpen(true);
        triggerHaptic(HAPTIC_PATTERNS.EMERGENCY_SOS);
        break;

      case 'CURRENCY':
        setActiveTab('currency');
        speakText(
          parsed.detectedLang === 'hi'
            ? 'मुद्रा पहचान कैमरा खोला जा रहा है।'
            : 'Opening money detector.',
          parsed.detectedLang,
          settings.voiceSpeed
        );
        break;

      case 'DOCUMENT':
        setActiveTab('document');
        speakText(
          parsed.detectedLang === 'hi'
            ? 'दस्तावेज स्कैनर खोला गया।'
            : 'Opening document scanner.',
          parsed.detectedLang,
          settings.voiceSpeed
        );
        break;

      case 'SIGN_LANG':
        setActiveTab('sign-lang');
        speakText(
          parsed.detectedLang === 'hi'
            ? 'सांकेतिक भाषा अनुवादक सक्रिय।'
            : 'Opening sign language translator.',
          parsed.detectedLang,
          settings.voiceSpeed
        );
        break;

      case 'CALL':
        setActiveTab('video-call');
        speakText(
          parsed.detectedLang === 'hi'
            ? 'मैसेज और कॉल स्क्रीन खोली जा रही है।'
            : 'Opening messages and calls.',
          parsed.detectedLang,
          settings.voiceSpeed
        );
        break;

      case 'NAVIGATE':
        setActiveTab('navigation');
        speakText(
          parsed.detectedLang === 'hi'
            ? 'नेविगेशन और रडार चालू है।'
            : 'Opening navigation map.',
          parsed.detectedLang,
          settings.voiceSpeed
        );
        break;

      case 'THEME':
        setSettingsModalOpen(true);
        break;

      case 'SETTINGS':
        setActiveTab('bluetooth');
        break;

      case 'SEARCH':
      default:
        setActiveTab('ai-search');
        break;
    }
  };

  const getThemeClass = () => {
    switch (settings.theme) {
      case 'calm-forest':
        return 'bg-emerald-950 text-emerald-100';

      case 'warm-amber':
        return 'bg-amber-950 text-amber-100';

      case 'high-contrast-dark':
        return 'bg-black text-yellow-300';

      case 'high-contrast-light':
        return 'bg-slate-100 text-slate-900';

      case 'monochrome':
        return 'bg-neutral-950 text-neutral-200';

      case 'eye-comfort':
      default:
        return 'bg-slate-950 text-slate-100';
    }
  };

  const getFontSizeClass = () => {
    switch (settings.fontSize) {
      case 'large':
        return 'text-base';

      case 'extra-large':
        return 'text-lg';

      case 'standard':
      default:
        return 'text-sm';
    }
  };

  const tabs: {
    id: typeof activeTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'navigation',
      label: t('tabNavigation'),
      icon: Navigation,
    },
    {
      id: 'immersive-vr',
      label: t('tabImmersiveVR'),
      icon: Headphones,
    },
    {
      id: 'currency',
      label: t('tabCurrency'),
      icon: Banknote,
    },
    {
      id: 'document',
      label: t('tabDocument'),
      icon: FileText,
    },
    {
      id: 'sign-lang',
      label: t('tabSignLang'),
      icon: Hand,
    },
    {
      id: 'video-call',
      label: 'Messages & Calls',
      icon: Video,
    },
    {
      id: 'bluetooth',
      label: t('tabBluetooth'),
      icon: Bluetooth,
    },
    {
      id: 'ai-search',
      label: t('tabAiSearch'),
      icon: Search,
    },
  ];

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${getThemeClass()} ${getFontSizeClass()}`}
      style={{
        filter: `brightness(${settings.brightness}%) contrast(${settings.contrast}%)`,
      }}
    >
      <Header
        settings={settings}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onTriggerSOS={() => setSosModalOpen(true)}
        isListening={isListening}
        onToggleListening={toggleListening}
        detectedLangText={detectedVoiceFeedback}
        onSelectLanguage={(lang) =>
          handleUpdateSettings({ uiLanguage: lang })
        }
        hearingAidConnected={hearingAidConnected}
        hearingAidBattery={hearingAidBattery}
      />

      <nav
        className="sticky top-14 z-30 w-full overflow-x-auto border-b border-slate-800/80 bg-slate-900/60 px-3 py-2 backdrop-blur-md sm:px-6 scrollbar-none"
        aria-label="Accessible Modules"
      >
        <div className="mx-auto flex min-w-max max-w-7xl items-center gap-1 sm:gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  triggerHaptic(HAPTIC_PATTERNS.CLICK);
                  setActiveTab(tab.id);
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all sm:text-sm ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950/40'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${
                    isActive ? 'text-slate-950' : 'text-cyan-400'
                  }`}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className="mx-auto w-full max-w-7xl flex-1 p-3 pb-16 sm:p-6">
        {activeTab === 'navigation' && (
          <NavigationModule settings={settings} />
        )}

        {activeTab === 'immersive-vr' && (
          <ImmersiveVRBlindModule settings={settings} />
        )}

        {activeTab === 'currency' && (
          <CurrencyDetectorModule settings={settings} />
        )}

        {activeTab === 'document' && (
          <DocumentScannerModule
            settings={settings}
            hearingAidConnected={hearingAidConnected}
            onOpenBluetoothModal={() =>
              setBluetoothModalOpen(true)
            }
          />
        )}

        {activeTab === 'sign-lang' && (
          <SignLanguageModule settings={settings} />
        )}

        {activeTab === 'video-call' && (
          <div className="space-y-6">
            <WebRTCCallModule settings={settings} />
            <ConnectMessagesCalls />
          </div>
        )}

        {activeTab === 'bluetooth' && (
          <BluetoothSyncModule
            settings={settings}
            hearingAidConnected={hearingAidConnected}
            hearingAidBattery={hearingAidBattery}
            onToggleHearingAidSync={handleToggleHearingAid}
          />
        )}

        {activeTab === 'ai-search' && (
          <AiChatSearchModule
            settings={settings}
            onNavigateToTab={(tab) => {
              if (
                tab === 'navigation' ||
                tab === 'currency' ||
                tab === 'document' ||
                tab === 'videocall'
              ) {
                if (tab === 'videocall') {
                  setActiveTab('video-call');
                } else {
                  setActiveTab(tab as any);
                }
              }
            }}
          />
        )}
      </main>

      <SensoryControlsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        hearingAidConnected={hearingAidConnected}
        hearingAidBattery={hearingAidBattery}
        onToggleHearingAidSync={handleToggleHearingAid}
      />

      <EmergencySOSModal
        isOpen={sosModalOpen}
        onClose={() => setSosModalOpen(false)}
        settings={settings}
      />

      {bluetoothModalOpen && (
        <SensoryControlsModal
          isOpen={true}
          onClose={() => setBluetoothModalOpen(false)}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          hearingAidConnected={hearingAidConnected}
          hearingAidBattery={hearingAidBattery}
          onToggleHearingAidSync={handleToggleHearingAid}
        />
      )}
    </div>
  );
}
