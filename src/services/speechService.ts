
/**
 * Divyang Sahayak — Speech Service
 * Text-to-speech and voice-command parsing.
 * Supports 12 Indian languages where browser voices are available.
 */

import { triggerHaptic, HAPTIC_PATTERNS } from './haptics';

export type SupportedLanguage =
  | 'hi' | 'en' | 'bn' | 'ta' | 'te' | 'mr'
  | 'gu' | 'kn' | 'ml' | 'pa' | 'ur' | 'or';

export interface RecognizedVoiceCommand {
  rawTranscript: string;
  detectedLang: 'hi' | 'en' | 'es' | 'bn' | 'ta' | 'mr';
  intent:
    | 'NAVIGATE'
    | 'CURRENCY'
    | 'DOCUMENT'
    | 'SIGN_LANG'
    | 'CALL'
    | 'SOS'
    | 'THEME'
    | 'SETTINGS'
    | 'SEARCH'
    | 'UNKNOWN';
  targetPayload?: string;
}

const LANGUAGE_LOCALES: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  pa: 'pa-IN',
  ur: 'ur-IN',
  or: 'or-IN',
  es: 'es-ES',
};

let currentUtterance: SpeechSynthesisUtterance | null = null;
let voiceLoadHandler: (() => void) | null = null;

/** Identify a likely language from a transcript. */
export function detectLanguageFromTranscript(
  text: string
): 'hi' | 'en' | 'es' | 'bn' | 'ta' | 'mr' {
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';

  const lower = text.toLowerCase();

  if (
    /[\u0A80-\u0AFF]/.test(text) ||
    ['kem cho', 'majama', 'gujarati'].some(k => lower.includes(k))
  ) return 'en';

  if (
    /[\u0C00-\u0C7F]/.test(text) ||
    ['telugu'].some(k => lower.includes(k))
  ) return 'en';

  if (['namaste', 'madad', 'rasta', 'kahan', 'paise',
       'dawa', 'aspataal', 'batao'].some(k => lower.includes(k))) {
    return 'hi';
  }

  if (['hola', 'ayuda', 'gracias', 'dinero'].some(k => lower.includes(k))) {
    return 'es';
  }

  return 'en';
}

/** Parse basic voice commands. */
export function parseVoiceIntent(
  transcript: string
): RecognizedVoiceCommand {
  const lower = transcript.toLowerCase();
  const detectedLang = detectLanguageFromTranscript(transcript);

  if (
    ['sos', 'emergency', 'help me', 'बचाओ', 'मदद', 'socorro']
      .some(k => lower.includes(k))
  ) {
    return { rawTranscript: transcript, detectedLang, intent: 'SOS' };
  }

  if (
    ['money', 'currency', 'rupee', 'नोट', 'पैसे', 'dinero', 'cash']
      .some(k => lower.includes(k))
  ) {
    return { rawTranscript: transcript, detectedLang, intent: 'CURRENCY' };
  }

  if (
    ['document', 'scan', 'दस्तावेज', 'कागज', 'prescription', 'parcha']
      .some(k => lower.includes(k))
  ) {
    return { rawTranscript: transcript, detectedLang, intent: 'DOCUMENT' };
  }

  if (
    ['sign language', 'gesture', 'इशारा', 'संकेत', 'senas', 'avatar']
      .some(k => lower.includes(k))
  ) {
    return { rawTranscript: transcript, detectedLang, intent: 'SIGN_LANG' };
  }

  if (
    ['call', 'video call', 'कॉल', 'llamar']
      .some(k => lower.includes(k))
  ) {
    return { rawTranscript: transcript, detectedLang, intent: 'CALL' };
  }

  if (
    ['navigate', 'map', 'rasta', 'direction', 'रास्ता', 'कहाँ', 'go to']
      .some(k => lower.includes(k))
  ) {
    return {
      rawTranscript: transcript,
      detectedLang,
      intent: 'NAVIGATE',
      targetPayload: transcript,
    };
  }

  if (
    ['contrast', 'dark mode', 'brightness', 'थीम', 'रंग']
      .some(k => lower.includes(k))
  ) {
    return { rawTranscript: transcript, detectedLang, intent: 'THEME' };
  }

  if (
    ['bluetooth', 'hearing aid', 'मशीन', 'dispositivo']
      .some(k => lower.includes(k))
  ) {
    return { rawTranscript: transcript, detectedLang, intent: 'SETTINGS' };
  }

  return {
    rawTranscript: transcript,
    detectedLang,
    intent: 'SEARCH',
    targetPayload: transcript,
  };
}

/** Wait for the browser to load its available voices. */
function getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
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

    const finish = () => {
      if (finished) return;
      finished = true;
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      window.clearTimeout(timeout);
      resolve(synth.getVoices());
    };

    const onVoicesChanged = () => finish();

    synth.addEventListener('voiceschanged', onVoicesChanged);

    const timeout = window.setTimeout(finish, 1500);
  });
}

/**
 * Speak text aloud.
 * Call this function from a user interaction when possible,
 * because browsers can restrict audio initiated without user action.
 */
export function speakText(
  text: string,
  language: string = 'en',
  rate: number = 1
): void {
  if (typeof window === 'undefined') {
    console.error('[Speech] Browser window is unavailable.');
    return;
  }

  if (!('speechSynthesis' in window)) {
    console.error('[Speech] This browser does not support speech synthesis.');
    return;
  }

  const cleanedText = text?.trim();

  if (!cleanedText) {
    console.warn('[Speech] Nothing to speak.');
    return;
  }

  const synth = window.speechSynthesis;

  try {
    synth.cancel();
    currentUtterance = null;

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    const languageCode = language.toLowerCase().split('-')[0];
    const locale = LANGUAGE_LOCALES[languageCode] || language || 'en-IN';

    utterance.lang = locale;
    utterance.rate = Math.max(0.7, Math.min(1.5, rate || 1));
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      console.info('[Speech] Started:', locale);
    };

    utterance.onend = () => {
      console.info('[Speech] Finished.');
      if (currentUtterance === utterance) {
        currentUtterance = null;
      }
    };

    utterance.onerror = event => {
      console.error('[Speech] Playback error:', event.error);
      if (currentUtterance === utterance) {
        currentUtterance = null;
      }
    };

    currentUtterance = utterance;

    void getAvailableVoices().then(voices => {
      if (currentUtterance !== utterance) return;

      const wantedLanguage = locale.toLowerCase();
      const baseLanguage = wantedLanguage.split('-')[0];

      const voice =
        voices.find(v => v.lang.toLowerCase() === wantedLanguage) ||
        voices.find(v => v.lang.toLowerCase().startsWith(baseLanguage + '-')) ||
        voices.find(v => v.lang.toLowerCase().startsWith('en-'));

      if (voice) {
        utterance.voice = voice;
        console.info('[Speech] Using voice:', voice.name, voice.lang);
      } else {
        console.warn(
          '[Speech] No matching installed voice for',
          locale,
          '. Trying the browser default voice.'
        );
      }

      try {
        synth.speak(utterance);

        // Some browsers suspend the speech engine until resumed.
        if (synth.paused) synth.resume();

        triggerHaptic(HAPTIC_PATTERNS.CLICK);
      } catch (error) {
        console.error('[Speech] Could not start playback:', error);
      }
    }).catch(error => {
      console.error('[Speech] Could not load voices:', error);
    });
  } catch (error) {
    console.error('[Speech] Unexpected error:', error);
  }
}

/** Stop the current speech. */
export function stopSpeech(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();
  currentUtterance = null;
}

/** Pause the current speech. */
export function pauseSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.pause();
  }
}

/** Resume paused speech. */
export function resumeSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.resume();
  }
}
