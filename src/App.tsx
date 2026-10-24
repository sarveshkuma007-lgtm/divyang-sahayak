
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { askGeminiAssistant } from './services/geminiService';

type AppTab =
  | 'navigation'
  | 'immersive-vr'
  | 'currency'
  | 'document'
  | 'sign-lang'
  | 'video-call'
  | 'bluetooth'
  | 'ai-search';

const LANGUAGE_LOCALES: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  pa: 'pa-IN',
  ur: 'ur-IN',
  or: 'or-IN',
  es: 'es-ES',
};

function getSpeechRecognitionConstructor(): any {
  if (typeof window === 'undefined') return null;

  const browser = window as any;
  return browser.SpeechRecognition || browser.webkitSpeechRecognition || null;
}

export default function App() {
  const [settings, setSettings] = useState<SensorySettings>({
    theme: 'eye-comfort',
    brightness: 100,
    contrast: 105,
    fontSize: 'standard',
    bionicReading: false,
    hapticFeedback: true,
    soundRadar: true,
    voiceSpeed: 1,
    uiLanguage: 'hi',
  });

  const [activeTab, setActiveTab] = useState<AppTab>('navigation');
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [bluetoothModalOpen, setBluetoothModalOpen] = useState(false);

  const [hearingAidConnected, setHearingAidConnected] = useState(true);
  const [hearingAidBattery] = useState(88);

  const [isListening, setIsListening] = useState(false);
  const [detectedVoiceFeedback, setDetectedVoiceFeedback] =
    useState<string | undefined>();
  const [assistantBusy, setAssistantBusy] = useState(false);

  const recognitionRef = useRef<any>(null);
  const listeningRef = useRef(false);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const t = (key: string) => getTranslation(settings.uiLanguage, key);

  const handleUpdateSettings = (partial: Partial<SensorySettings>) => {
    setSettings((previous) => ({ ...previous, ...partial }));
  };

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const say = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      speakText(text, settings.uiLanguage, settings.voiceSpeed);
    },
    [settings.uiLanguage, settings.voiceSpeed],
  );

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    setIsListening(false);

    const recognition = recognitionRef.current;
    recognitionRef.current = null;

    if (recognition) {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;

      try {
        recognition.stop();
      } catch {
        // It may already have stopped.
      }
    }
  }, []);

  const readPage = useCallback(() => {
    const main = document.querySelector('main');
    const text = main?.textContent?.replace(/\s+/g, ' ').trim();

    if (!text) {
      say(
        settings.uiLanguage === 'hi'
          ? 'इस पेज पर पढ़ने के लिए कोई जानकारी नहीं है।'
          : 'There is no page content available to read.',
      );
      return;
    }

    say(text);
  }, [say, settings.uiLanguage]);

  const processVoiceCommand = useCallback(
    async (transcript: string) => {
      const text = transcript.trim();
      if (!text) return;

      const lower = text.toLocaleLowerCase();

      setDetectedVoiceFeedback(`Heard: "${text}"`);

      // Stop commands should work without contacting Gemini.
      if (
        /^(stop|stop speaking|be quiet|cancel speech|रुको|बंद करो|चुप हो जाओ)$/i.test(
          lower,
        )
      ) {
        stopSpeaking();
        say(settings.uiLanguage === 'hi' ? 'ठीक है।' : 'Stopped.');
        return;
      }

      if (
        lower.includes('read this page') ||
        lower.includes('read the page') ||
        lower.includes('read screen') ||
        lower.includes('read everything') ||
        lower.includes('पेज पढ़ो') ||
        lower.includes('स्क्रीन पढ़ो')
      ) {
        readPage();
        return;
      }

      if (
        lower.includes('repeat that') ||
        lower.includes('repeat answer') ||
        lower.includes('फिर से बोलो')
      ) {
        readPage();
        return;
      }

      const parsed = parseVoiceIntent(text);

      // Handle explicit navigation commands locally.
      // General questions are sent to Gemini below.
      switch (parsed.intent) {
        case 'SOS':
          setSosModalOpen(true);
          triggerHaptic(HAPTIC_PATTERNS.EMERGENCY_SOS);
          say(
            settings.uiLanguage === 'hi'
              ? 'आपातकालीन सहायता स्क्रीन खोल रहा हूँ।'
              : 'Opening emergency assistance.',
          );
          return;

        case 'CURRENCY':
          setActiveTab('currency');
          say(
            settings.uiLanguage === 'hi'
              ? 'मुद्रा पहचान स्क्रीन खोल रहा हूँ।'
              : 'Opening the currency detector.',
          );
          return;

        case 'DOCUMENT':
          setActiveTab('document');
          say(
            settings.uiLanguage === 'hi'
              ? 'दस्तावेज़ स्कैनर खोल रहा हूँ।'
              : 'Opening the document scanner.',
          );
          return;

        case 'SIGN_LANG':
          setActiveTab('sign-lang');
          say(
            settings.uiLanguage === 'hi'
              ? 'सांकेतिक भाषा अनुवादक खोल रहा हूँ।'
              : 'Opening the sign language translator.',
          );
          return;

        case 'CALL':
          setActiveTab('video-call');
          say(
            settings.uiLanguage === 'hi'
              ? 'कॉल स्क्रीन खोल रहा हूँ।'
              : 'Opening messages and calls.',
          );
          return;

        case 'NAVIGATE':
          setActiveTab('navigation');
          say(
            settings.uiLanguage === 'hi'
              ? 'नेविगेशन खोल रहा हूँ।'
              : 'Opening navigation.',
          );
          return;

        case 'THEME':
          setSettingsModalOpen(true);
          say(
            settings.uiLanguage === 'hi'
              ? 'एक्सेसिबिलिटी सेटिंग्स खोल रहा हूँ।'
              : 'Opening accessibility settings.',
          );
          return;

        case 'SETTINGS':
          setActiveTab('bluetooth');
          say(
            settings.uiLanguage === 'hi'
              ? 'डिवाइस सेटिंग्स खोल रहा हूँ।'
              : 'Opening device settings.',
          );
          return;

        case 'SEARCH':
        case 'UNKNOWN':
        default:
          break;
      }

      // General questions go to Gemini instead of only opening AI Search.
      const requestId = ++requestIdRef.current;
      setAssistantBusy(true);

      try {
        const result = await askGeminiAssistant(
          text,
          settings.uiLanguage,
          [
            'You are the voice assistant for Divyang Sahayak, an accessibility app.',
            `Reply in the user's selected language: ${settings.uiLanguage}.`,
            'Answer the actual question directly and completely.',
            'Use clear, natural sentences that sound good when read aloud.',
            'For multi-step instructions, explain the steps instead of giving only a short acknowledgement.',
            'Do not claim to have performed actions that you did not perform.',
            'Keep the answer useful and avoid unnecessary markdown formatting.',
          ].join(' '),
        );

        // Do not let an older request overwrite a newer one.
        if (!mountedRef.current || requestId !== requestIdRef.current) {
          return;
        }

        const answer = result.replyText?.trim();

        if (!answer) {
          say(
            settings.uiLanguage === 'hi'
              ? 'मुझे पूरा उत्तर नहीं मिला। कृपया दोबारा पूछें।'
              : 'I did not receive an answer. Please try again.',
          );
          return;
        }

        // Read the complete returned answer aloud.
        say(answer);
        setDetectedVoiceFeedback(`Gemini: ${answer}`);
      } catch (error) {
        console.error('Gemini voice assistant failed:', error);

        if (!mountedRef.current || requestId !== requestIdRef.current) {
          return;
        }

        say(
          settings.uiLanguage === 'hi'
            ? 'AI सहायक से संपर्क नहीं हो पाया। इंटरनेट कनेक्शन और सर्वर जाँचें।'
            : 'I could not connect to the AI assistant. Please check your internet connection and server.',
        );
      } finally {
        if (mountedRef.current && requestId === requestIdRef.current) {
          setAssistantBusy(false);
        }
      }
    },
    [
      readPage,
      say,
      settings.uiLanguage,
      stopSpeaking,
    ],
  );

  const toggleListening = useCallback(() => {
    if (listeningRef.current) {
      stopListening();
      setDetectedVoiceFeedback(undefined);
      say(
        settings.uiLanguage === 'hi'
          ? 'वॉइस असिस्टेंट बंद है।'
          : 'Voice assistant stopped listening.',
      );
      return;
    }

    const SpeechRecognition = getSpeechRecognitionConstructor();

    if (!SpeechRecognition) {
      say(
        'Voice recognition is not supported in this browser. Please use a supported browser or the on-screen controls.',
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.lang =
        LANGUAGE_LOCALES[settings.uiLanguage] || 'en-IN';

      listeningRef.current = true;
      recognitionRef.current = recognition;
      setIsListening(true);

      recognition.onresult = (event: any) => {
        const result = event.results?.[event.results.length - 1];
        if (!result || !result.isFinal) return;

        const transcript = result[0]?.transcript?.trim();
        if (transcript) {
          void processVoiceCommand(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          stopListening();
          setDetectedVoiceFeedback(
            'Microphone permission is required. Allow microphone access in your browser settings.',
          );
        } else if (event.error === 'language-not-supported') {
          setDetectedVoiceFeedback(
            `Speech recognition may not support ${settings.uiLanguage} in this browser.`,
          );
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setDetectedVoiceFeedback(`Voice recognition error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        // Keep listening across recognition sessions while the user
        // has not explicitly switched the assistant off.
        if (
          listeningRef.current &&
          recognitionRef.current === recognition
        ) {
          try {
            recognition.start();
          } catch (error) {
            console.warn('Could not restart speech recognition:', error);
          }
        } else if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
          setIsListening(false);
        }
      };

      recognition.start();
      triggerHaptic(HAPTIC_PATTERNS.CLICK);

      say(
        settings.uiLanguage === 'hi'
          ? 'वॉइस असिस्टेंट चालू है। अपना सवाल पूछिए।'
          : 'Voice assistant is on. Ask your question.',
      );
    } catch (error) {
      console.error('Could not start speech recognition:', error);
      stopListening();
      say('Could not start the microphone. Check browser permissions and try again.');
    }
  }, [
    processVoiceCommand,
    say,
    settings.uiLanguage,
    stopListening,
  ]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      listeningRef.current = false;
      requestIdRef.current++;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore cleanup errors.
        }
        recognitionRef.current = null;
      }

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleToggleHearingAid = () => {
    setHearingAidConnected((previous) => !previous);
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
    id: AppTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'navigation', label: t('tabNavigation'), icon: Navigation },
    { id: 'immersive-vr', label: t('tabImmersiveVR'), icon: Headphones },
    { id: 'currency', label: t('tabCurrency'), icon: Banknote },
    { id: 'document', label: t('tabDocument'), icon: FileText },
    { id: 'sign-lang', label: t('tabSignLang'), icon: Hand },
    { id: 'video-call', label: 'Messages & Calls', icon: Video },
    { id: 'bluetooth', label: t('tabBluetooth'), icon: Bluetooth },
    { id: 'ai-search', label: t('tabAiSearch'), icon: Search },
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
        detectedLangText={
          assistantBusy
            ? 'Gemini is preparing your answer…'
            : detectedVoiceFeedback
        }
        onSelectLanguage={(lang) => {
          handleUpdateSettings({ uiLanguage: lang });
          if (recognitionRef.current && listeningRef.current) {
            stopListening();
            say('Language changed. Turn the voice assistant on again to use the new recognition language.');
          }
        }}
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
            onOpenBluetoothModal={() => setBluetoothModalOpen(true)}
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
                setActiveTab(
                  tab === 'videocall' ? 'video-call' : tab,
                );
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
          isOpen
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
