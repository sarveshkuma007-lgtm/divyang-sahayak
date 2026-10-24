
import { triggerHaptic, HAPTIC_PATTERNS } from './haptics';

export type SupportedLanguage =
  | 'hi' | 'en' | 'es' | 'bn' | 'ta' | 'mr'
  | 'te' | 'gu' | 'kn' | 'ml' | 'pa' | 'ur' | 'or';

export interface RecognizedVoiceCommand {
  rawTranscript: string;
  detectedLang: SupportedLanguage;
  intent:
    | 'NAVIGATE' | 'CURRENCY' | 'DOCUMENT' | 'SIGN_LANG'
    | 'CALL' | 'SOS' | 'THEME' | 'SETTINGS' | 'SEARCH' | 'UNKNOWN';
  targetPayload?: string;
}

const LOCALES: Record<SupportedLanguage, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  es: 'es-ES',
  bn: 'bn-IN',
  ta: 'ta-IN',
  mr: 'mr-IN',
  te: 'te-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  pa: 'pa-IN',
  ur: 'ur-IN',
  or: 'or-IN',
};

export function detectLanguageFromTranscript(text: string): SupportedLanguage {
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn';
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa';
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu';
  if (/[\u0600-\u06FF]/.test(text)) return 'ur';
  if (/[\u0B00-\u0B7F]/.test(text)) return 'or';

  if (/[\u0900-\u097F]/.test(text)) return 'hi';

  const lower = text.toLowerCase();

  if (/\b(namaste|madad|rasta|kahan|paise|batao|chalo)\b/.test(lower)) {
    return 'hi';
  }

  if (/\b(hola|ayuda|gracias|dinero)\b/.test(lower)) {
    return 'es';
  }

  return 'en';
}

export function parseVoiceIntent(transcript: string): RecognizedVoiceCommand {
  const lower = transcript.toLowerCase();
  const detectedLang = detectLanguageFromTranscript(transcript);

  const result = (intent: RecognizedVoiceCommand['intent'], targetPayload?: string) => ({
    rawTranscript: transcript,
    detectedLang,
    intent,
    targetPayload,
  });

  if (/sos|emergency|help me|बचाओ|मदद|आपातकाल/.test(lower)) {
    return result('SOS');
  }

  if (/money|currency|rupee|cash|नोट|पैसे/.test(lower)) {
    return result('CURRENCY');
  }

  if (/document|scan|दस्तावेज|कागज|prescription/.test(lower)) {
    return result('DOCUMENT');
  }

  if (/sign language|gesture|इशारा|संकेत/.test(lower)) {
    return result('SIGN_LANG');
  }

  if (/video call|call|कॉल/.test(lower)) {
    return result('CALL');
  }

  if (/navigate|direction|map|go to|रास्ता|कहाँ|ले चलो/.test(lower)) {
    return result('NAVIGATE', transcript);
  }

  if (/contrast|dark mode|brightness|थीम|रंग/.test(lower)) {
    return result('THEME');
  }

  if (/bluetooth|hearing aid|मशीन/.test(lower)) {
    return result('SETTINGS');
  }

  return result('SEARCH', transcript);
}

let speechSequence = 0;

function getVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve([]);
      return;
    }

    const synth = window.speechSynthesis;
    const existing = synth.getVoices();

    if (existing.length > 0) {
      resolve(existing);
      return;
    }

    let finished = false;

    const complete = () => {
      if (finished) return;
      finished = true;
      synth.removeEventListener('voiceschanged', complete);
      resolve(synth.getVoices());
    };

    synth.addEventListener('voiceschanged', complete);
    window.setTimeout(complete, 1200);
  });
}

export async function speakText(
  text: string,
  language: string = 'en',
  rate: number = 1,
): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.error('Text-to-speech is not supported in this browser.');
    return;
  }

  const cleaned = text?.replace(/\s+/g, ' ').trim();

  if (!cleaned) {
    console.warn('TTS skipped: text is empty.');
    return;
  }

  const sequence = ++speechSequence;
  const synth = window.speechSynthesis;
  const locale = LOCALES[language as SupportedLanguage] || 'en-US';

  synth.cancel();

  try {
    const voices = await getVoices();

    // A newer request may have arrived while voices were loading.
    if (sequence !== speechSequence) return;

    const langCode = locale.split('-')[0].toLowerCase();

    const voice =
      voices.find(v => v.lang.toLowerCase() === locale.toLowerCase()) ||
      voices.find(v => v.lang.toLowerCase().startsWith(`${langCode}-`)) ||
      voices.find(v => v.lang.toLowerCase().startsWith(langCode));

    const utterance = new SpeechSynthesisUtterance(cleaned);

    utterance.lang = locale;
    utterance.rate = Math.max(0.6, Math.min(1.8, rate));
    utterance.pitch = 1;

    if (voice) {
      utterance.voice = voice;
    } else {
      console.warn(`No installed voice found for ${locale}; using browser default.`);
    }

    utterance.onstart = () => {
      console.info('[TTS] Speech started:', locale);
      try {
        triggerHaptic(HAPTIC_PATTERNS.CLICK);
      } catch {
        // Haptic feedback must not prevent speech.
      }
    };

    utterance.onend = () => {
      console.info('[TTS] Speech finished.');
    };

    utterance.onerror = (event) => {
      console.error('[TTS] Speech failed:', event.error, {
        locale,
        voice: voice?.name,
        textLength: cleaned.length,
      });
    };

    // Allow the browser to process cancellation before speaking again.
    await new Promise<void>(resolve => window.setTimeout(resolve, 120));

    if (sequence !== speechSequence) return;

    synth.speak(utterance);

    // Some browser implementations can remain paused after interruptions.
    if (synth.paused) synth.resume();
  } catch (error) {
    console.error('[TTS] Could not start speech:', error);
  }
}

export function stopSpeech(): void {
  speechSequence++;

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function pauseSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.pause();
  }
}

export function resumeSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.resume();
  }
}
