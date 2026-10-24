
import React, { useState, useEffect, useRef, useCallback } from 'react';

import { SensorySettings } from './types';
import DesktopDashboard, {
  type DashboardTab,
} from './components/DesktopDashboard';

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

import { triggerHaptic, HAPTIC_PATTERNS } from './services/haptics';
import { parseVoiceIntent, speakText } from './services/speechService';
import { askGeminiAssistant } from './services/geminiService';

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

  return browser.SpeechRecognition ||
    browser.webkitSpeechRecognition ||
    null;
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

  const [activeTab, setActiveTab] =
    useState<DashboardTab>('navigation');

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

  const handleUpdateSettings = (
    partial: Partial<SensorySettings>,
  ) => {
    setSettings((previous) => ({
      ...previous,
      ...partial,
    }));
  };

  const stopSpeaking = useCallback(() => {
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window
    ) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const say = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      speakText(
        text,
        settings.uiLanguage,
        settings.voiceSpeed,
      );
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
        // Recognition may already have stopped.
      }
    }
  }, []);

  const readPage = useCallback(() => {
    const main = document.querySelector('main');
    const content = main?.textContent
      ?.replace(/\s+/g, ' ')
      .trim();

    if (!content) {
      say(
        settings.uiLanguage === 'hi'
          ? 'इस पेज पर पढ़ने के लिए कोई जानकारी नहीं है।'
          : 'There is no page content available to read.',
      );
      return;
    }

    say(content);
  }, [say, settings.uiLanguage]);

  const processVoiceCommand = useCallback(
    async (transcript: string) => {
      const text = transcript.trim();

      if (!text) return;

      const lower = text
        .toLocaleLowerCase()
        .replace(/[.,!?]/g, '')
        .trim();

      setDetectedVoiceFeedback(`Heard: "${text}"`);

      const isHindi = settings.uiLanguage === 'hi';

      const goTo = (
        tab: DashboardTab,
        englishMessage: string,
        hindiMessage: string,
      ) => {
        setActiveTab(tab);
        say(isHindi ? hindiMessage : englishMessage);
      };

      // Stop speech without contacting the AI.
      if (
        /^(stop|stop speaking|be quiet|cancel speech|रुको|बंद करो|चुप हो जाओ)$/.test(
          lower,
        )
      ) {
        stopSpeaking();
        say(isHindi ? 'ठीक है।' : 'Stopped speaking.');
        return;
      }

      // Stop voice recognition.
      if (
        /^(stop listening|turn off voice|disable voice commands)$/.test(
          lower,
        )
      ) {
        stopListening();
        say(
          isHindi
            ? 'वॉइस कमांड बंद कर दिए गए हैं।'
            : 'Voice commands stopped.',
        );
        return;
      }

      // Read the current screen.
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

      // Return to the main dashboard.
      if (
        /(go home|open home|dashboard|show dashboard|मुख्य पेज|होम खोलो)/.test(
          lower,
        )
      ) {
        goTo(
          'navigation',
          'Opening the main dashboard.',
          'मुख्य डैशबोर्ड खोल रहा हूँ।',
        );
        return;
      }

      // Navigation.
      if (
        /(open navigation|navigation|start navigation|navigate|नेविगेशन खोलो)/.test(
          lower,
        )
      ) {
        goTo(
          'navigation',
          'Opening navigation.',
          'नेविगेशन खोल रहा हूँ।',
        );
        return;
      }

      // Sign language.
      if (
        /(open sign language|sign language|open isl|सांकेतिक भाषा खोलो)/.test(
          lower,
        )
      ) {
        goTo(
          'sign-lang',
          'Opening sign language communication.',
          'सांकेतिक भाषा संचार खोल रहा हूँ।',
        );
        return;
      }

      // Document reader.
      if (
        /(read document|open document|open documents|document reader|read the document|दस्तावेज़ पढ़ो)/.test(
          lower,
        )
      ) {
        goTo(
          'document',
          'Opening the document reader.',
          'दस्तावेज़ रीडर खोल रहा हूँ।',
        );
        return;
      }

      // Currency detector.
      if (
        /(detect currency|open currency|currency detector|detect the currency|मुद्रा पहचानो)/.test(
          lower,
        )
      ) {
        goTo(
          'currency',
          'Opening the currency detector.',
          'मुद्रा पहचान खोल रहा हूँ।',
        );
        return;
      }

      // Calls and messages.
      if (
        /(open calls|open messages|make a call|open phone|calls|कॉल खोलो)/.test(
          lower,
        )
      ) {
        goTo(
          'video-call',
          'Opening messages and calls.',
          'कॉल और संदेश खोल रहा हूँ।',
        );
        return;
      }

      // AI assistant.
      if (
        /(open ai|open assistant|ask assistant|ai assistant)/.test(
          lower,
        )
      ) {
        goTo(
          'ai-search',
          'Opening the AI assistant.',
          'एआई सहायक खोल रहा हूँ।',
        );
        return;
      }

      // Bluetooth and connected devices.
      if (
        /(open devices|bluetooth|device settings|कनेक्टेड डिवाइस खोलो)/.test(
          lower,
        )
      ) {
        goTo(
          'bluetooth',
          'Opening connected devices.',
          'कनेक्टेड डिवाइस खोल रहा हूँ।',
        );
        return;
      }

      // Accessibility settings.
      if (
        /(open settings|accessibility settings|change settings|सेटिंग खोलो)/.test(
          lower,
        )
      ) {
        setSettingsModalOpen(true);
        say(
          isHindi
            ? 'एक्सेसिबिलिटी सेटिंग्स खोल रहा हूँ।'
            : 'Opening accessibility settings.',
        );
        return;
      }

      // Emergency support.
      if (
        /(emergency help|help me|sos|आपातकालीन सहायता)/.test(
          lower,
        )
      ) {
        triggerHaptic(HAPTIC_PATTERNS.EMERGENCY_SOS);
        setSosModalOpen(true);

        say(
          isHindi
            ? 'आपातकालीन सहायता खोल रहा हूँ।'
            : 'Opening emergency assistance.',
        );
        return;
      }

      // Support other intents already implemented in the project.
      const parsed = parseVoiceIntent(text);

      switch (parsed.intent) {
        case 'SOS':
          triggerHaptic(HAPTIC_PATTERNS.EMERGENCY_SOS);
          setSosModalOpen(true);
          say(
            isHindi
              ? 'आपातकालीन सहायता खोल रहा हूँ।'
              : 'Opening emergency assistance.',
          );
          return;

        case 'CURRENCY':
          goTo(
            'currency',
            'Opening the currency detector.',
            'मुद्रा पहचान खोल रहा हूँ।',
          );
          return;

        case 'DOCUMENT':
          goTo(
            'document',
            'Opening the document reader.',
            'दस्तावेज़ रीडर खोल रहा हूँ।',
          );
          return;

        case 'SIGN_LANG':
          goTo(
            'sign-lang',
            'Opening sign language communication.',
            'सांकेतिक भाषा संचार खोल रहा हूँ।',
          );
          return;

        case 'CALL':
          goTo(
            'video-call',
            'Opening messages and calls.',
            'कॉल और संदेश खोल रहा हूँ।',
          );
          return;

        case 'NAVIGATE':
          goTo(
            'navigation',
            'Opening navigation.',
            'नेविगेशन खोल रहा हूँ।',
          );
          return;

        case 'THEME':
          setSettingsModalOpen(true);
          say(
            isHindi
              ? 'एक्सेसिबिलिटी सेटिंग्स खोल रहा हूँ।'
              : 'Opening accessibility settings.',
          );
          return;

        case 'SETTINGS':
          goTo(
            'bluetooth',
            'Opening device settings.',
            'डिवाइस सेटिंग्स खोल रहा हूँ।',
          );
          return;

        default:
          break;
      }

      // Ask the AI assistant when the phrase isn't a local command.
      const requestId = ++requestIdRef.current;
      setAssistantBusy(true);

      try {
        const result = await askGeminiAssistant(
          text,
          settings.uiLanguage,
          [
            'You are the voice assistant for Divyang Sahayak, an accessibility app.',
            `Reply in the user's selected language: ${settings.uiLanguage}.`,
            'Answer the actual question directly and clearly.',
            'Use natural sentences that sound good when read aloud.',
            'Never claim that you performed an action you did not perform.',
            'Keep the answer useful and concise.',
          ].join(' '),
        );

        if (
          !mountedRef.current ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        const answer = result.replyText?.trim();

        if (!answer) {
          say(
            isHindi
              ? 'मुझे पूरा उत्तर नहीं मिला। कृपया दोबारा पूछें।'
              : 'I did not receive an answer. Please try again.',
          );
          return;
        }

        setDetectedVoiceFeedback(`Assistant: ${answer}`);
        say(answer);
      } catch (error) {
        console.error('Voice assistant failed:', error);

        if (
          !mountedRef.current ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        say(
          isHindi
            ? 'एआई सहायक से संपर्क नहीं हो पाया। इंटरनेट और सर्वर जाँचें।'
            : 'I could not connect to the AI assistant. Check your internet connection and server.',
        );
      } finally {
        if (
          mountedRef.current &&
          requestId === requestIdRef.current
        ) {
          setAssistantBusy(false);
        }
      }
    },
    [
      readPage,
      say,
      settings.uiLanguage,
      stopListening,
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

    const SpeechRecognition =
      getSpeechRecognitionConstructor();

    if (!SpeechRecognition) {
      say(
        'Voice recognition is not supported in this browser. Use a supported browser and the on-screen controls.',
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.lang = 'en-IN'; // The visible quick-command phrases are English.

      listeningRef.current = true;
      recognitionRef.current = recognition;
      setIsListening(true);

      recognition.onresult = (event: any) => {
        const result =
          event.results?.[event.results.length - 1];

        if (!result || !result.isFinal) return;

        const transcript = result[0]?.transcript?.trim();

        if (transcript) {
          void processVoiceCommand(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);

        if (
          event.error === 'not-allowed' ||
          event.error === 'service-not-allowed'
        ) {
          stopListening();

          setDetectedVoiceFeedback(
            'Microphone permission is required. Allow microphone access in browser settings.',
          );
        } else if (
          event.error === 'language-not-supported'
        ) {
          setDetectedVoiceFeedback(
            `Speech recognition may not support ${settings.uiLanguage} in this browser.`,
          );
        } else if (
          event.error !== 'no-speech' &&
          event.error !== 'aborted'
        ) {
          setDetectedVoiceFeedback(
            `Voice recognition error: ${event.error}`,
          );
        }
      };

      recognition.onend = () => {
        if (
          listeningRef.current &&
          recognitionRef.current === recognition
        ) {
          try {
            recognition.start();
          } catch (error) {
            console.warn(
              'Could not restart speech recognition:',
              error,
            );
          }
        } else if (
          recognitionRef.current === recognition
        ) {
          recognitionRef.current = null;
          setIsListening(false);
        }
      };

      recognition.start();
      triggerHaptic(HAPTIC_PATTERNS.CLICK);

      say(
        settings.uiLanguage === 'hi'
          ? 'वॉइस असिस्टेंट चालू है। अपना कमांड बोलिए।'
          : 'Voice assistant is on. Speak a command.',
      );
    } catch (error) {
      console.error(
        'Could not start speech recognition:',
        error,
      );

      stopListening();
      say(
        'Could not start the microphone. Check browser permissions and try again.',
      );
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

  return (
    <div
      className="min-h-screen font-sans transition-colors duration-200"
      style={{
        filter: `brightness(${settings.brightness}%) contrast(${settings.contrast}%)`,
      }}
    >
      <DesktopDashboard
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isListening={isListening}
        onToggleListening={toggleListening}
        voiceFeedback={detectedVoiceFeedback}
        assistantBusy={assistantBusy}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onTriggerSOS={() => {
          triggerHaptic(HAPTIC_PATTERNS.EMERGENCY_SOS);
          setSosModalOpen(true);
        }}
        readingMode={settings.theme === 'warm-amber'}
        onToggleReadingMode={() => {
          handleUpdateSettings({
            theme: settings.theme === 'warm-amber'
              ? 'eye-comfort'
              : 'warm-amber',
          });
        }}
      >
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
                setActiveTab(
                  tab === 'videocall'
                    ? 'video-call'
                    : tab,
                );
              }
            }}
          />
        )}
      </DesktopDashboard>

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
