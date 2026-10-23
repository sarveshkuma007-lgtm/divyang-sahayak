/**
 * Multilingual Speech Recognition & Synthesis Service
 * Automatically detects user language (Hindi, English, etc.) and adjusts UI settings.
 */

import { triggerHaptic, HAPTIC_PATTERNS } from './haptics';

export interface RecognizedVoiceCommand {
  rawTranscript: string;
  detectedLang: 'hi' | 'en' | 'es' | 'bn' | 'ta' | 'mr';
  intent: 'NAVIGATE' | 'CURRENCY' | 'DOCUMENT' | 'SIGN_LANG' | 'CALL' | 'SOS' | 'THEME' | 'SETTINGS' | 'SEARCH' | 'UNKNOWN';
  targetPayload?: string;
}

export function detectLanguageFromTranscript(text: string): 'hi' | 'en' | 'es' | 'bn' | 'ta' | 'mr' {
  // Check Devanagari script for Hindi / Marathi
  if (/[\u0900-\u097F]/.test(text)) {
    return 'hi';
  }
  // Bengali script
  if (/[\u0980-\u09FF]/.test(text)) {
    return 'bn';
  }
  // Tamil script
  if (/[\u0B80-\u0BFF]/.test(text)) {
    return 'ta';
  }

  // Hinglish / phonetic Hindi keywords
  const hindiKeywords = ['namaste', 'madad', 'rasta', 'kahan', 'paise', 'dawa', 'aspataal', 'chalo', 'batao', 'ruk', 'sunai'];
  const lower = text.toLowerCase();
  for (const kw of hindiKeywords) {
    if (lower.includes(kw)) {
      return 'hi';
    }
  }

  // Spanish keywords
  const esKeywords = ['hola', 'ayuda', 'donde', 'gracias', 'navegar', 'dinero'];
  for (const kw of esKeywords) {
    if (lower.includes(kw)) {
      return 'es';
    }
  }

  return 'en';
}

export function parseVoiceIntent(transcript: string): RecognizedVoiceCommand {
  const lower = transcript.toLowerCase();
  const detectedLang = detectLanguageFromTranscript(transcript);

  // SOS Emergency keywords
  if (lower.includes('sos') || lower.includes('emergency') || lower.includes('help me') || lower.includes('बचाओ') || lower.includes('मदद') || lower.includes('socorro')) {
    return { rawTranscript: transcript, detectedLang, intent: 'SOS' };
  }

  // Currency / Money detection keywords
  if (lower.includes('money') || lower.includes('currency') || lower.includes('rupee') || lower.includes('नोट') || lower.includes('पैसे') || lower.includes('dinero') || lower.includes('cash')) {
    return { rawTranscript: transcript, detectedLang, intent: 'CURRENCY' };
  }

  // Document scan keywords
  if (lower.includes('document') || lower.includes('scan') || lower.includes('दस्तावेज') || lower.includes('कागज') || lower.includes('documento') || lower.includes('prescription') || lower.includes('parcha')) {
    return { rawTranscript: transcript, detectedLang, intent: 'DOCUMENT' };
  }

  // Sign language translation keywords
  if (lower.includes('sign') || lower.includes('gesture') || lower.includes('इशारा') || lower.includes('संकेत') || lower.includes('senas') || lower.includes('avatar')) {
    return { rawTranscript: transcript, detectedLang, intent: 'SIGN_LANG' };
  }

  // WebRTC Call keywords
  if (lower.includes('call') || lower.includes('video call') || lower.includes('कॉल') || lower.includes('llamar') || lower.includes('video')) {
    return { rawTranscript: transcript, detectedLang, intent: 'CALL' };
  }

  // Navigation keywords
  if (lower.includes('navigate') || lower.includes('map') || lower.includes('rasta') || lower.includes('direction') || lower.includes('रास्ता') || lower.includes('कहाँ') || lower.includes('le chalo') || lower.includes('go to')) {
    const payload = transcript.replace(/navigate|to|map|rasta|go|रास्ता|चलो/gi, '').trim();
    return { rawTranscript: transcript, detectedLang, intent: 'NAVIGATE', targetPayload: payload };
  }

  // Theme / Contrast keywords
  if (lower.includes('contrast') || lower.includes('dark mode') || lower.includes('brightness') || lower.includes('थीम') || lower.includes('रंग')) {
    return { rawTranscript: transcript, detectedLang, intent: 'THEME' };
  }

  // Settings / Bluetooth keywords
  if (lower.includes('bluetooth') || lower.includes('hearing aid') || lower.includes('मशीन') || lower.includes('dispositivo')) {
    return { rawTranscript: transcript, detectedLang, intent: 'SETTINGS' };
  }

  return { rawTranscript: transcript, detectedLang, intent: 'SEARCH', targetPayload: transcript };
}

/**
 * Text-to-Speech speaking wrapper with language mapping and speed control
 */
export function speakText(text: string, language: string = 'en', rate: number = 1.0) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel(); // Stop any ongoing speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = Math.max(0.7, Math.min(1.8, rate));

    // Map language code to full locale
    const localeMap: Record<string, string> = {
      hi: 'hi-IN',
      en: 'en-US',
      es: 'es-ES',
      bn: 'bn-IN',
      ta: 'ta-IN',
      mr: 'mr-IN',
    };
    utterance.lang = localeMap[language] || 'en-US';

    // Try finding matching voice
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => v.lang.startsWith(language));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    window.speechSynthesis.speak(utterance);
    triggerHaptic(HAPTIC_PATTERNS.CLICK);
  } catch (err) {
    console.warn('Speech synthesis error', err);
  }
}
