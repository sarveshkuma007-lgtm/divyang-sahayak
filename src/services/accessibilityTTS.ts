
export const TTS_LANGUAGES = {
  en: { name: "English", locale: "en-IN" },
  hi: { name: "Hindi", locale: "hi-IN" },
  mr: { name: "Marathi", locale: "mr-IN" },
  bn: { name: "Bengali", locale: "bn-IN" },
  ta: { name: "Tamil", locale: "ta-IN" },
  te: { name: "Telugu", locale: "te-IN" },
  gu: { name: "Gujarati", locale: "gu-IN" },
  kn: { name: "Kannada", locale: "kn-IN" },
  ml: { name: "Malayalam", locale: "ml-IN" },
  pa: { name: "Punjabi", locale: "pa-IN" },
  ur: { name: "Urdu", locale: "ur-IN" },
  or: { name: "Odia", locale: "or-IN" },
} as const;

export type TTSLanguage = keyof typeof TTS_LANGUAGES;

type SpeechCallbacks = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
};

class AccessibilityTTS {
  private callbacks: SpeechCallbacks = {};
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private selectedLanguage: TTSLanguage = "en";
  private rate = 1;
  private pitch = 1;
  private queue: string[] = [];
  private index = 0;
  private speaking = false;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.loadVoices();

      window.speechSynthesis.onvoiceschanged = () => {
        this.loadVoices();
      };
    }
  }

  private loadVoices(): void {
    if (!("speechSynthesis" in window)) return;
    this.voices = window.speechSynthesis.getVoices();
  }

  isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      "SpeechSynthesisUtterance" in window
    );
  }

  setCallbacks(callbacks: SpeechCallbacks): void {
    this.callbacks = callbacks;
  }

  setLanguage(language: TTSLanguage): void {
    this.selectedLanguage = language;
  }

  getLanguage(): TTSLanguage {
    return this.selectedLanguage;
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (this.isSupported()) this.loadVoices();
    return [...this.voices];
  }

  getAvailableLanguages(): {
    code: TTSLanguage;
    name: string;
    locale: string;
    voiceAvailable: boolean;
  }[] {
    return Object.entries(TTS_LANGUAGES).map(([code, language]) => ({
      code: code as TTSLanguage,
      name: language.name,
      locale: language.locale,
      voiceAvailable: this.voices.some(
        (voice) =>
          voice.lang.toLowerCase().startsWith(code.toLowerCase()) ||
          voice.lang.toLowerCase() === language.locale.toLowerCase(),
      ),
    }));
  }

  setRate(rate: number): void {
    this.rate = Math.min(2, Math.max(0.5, rate));
  }

  setPitch(pitch: number): void {
    this.pitch = Math.min(2, Math.max(0, pitch));
  }

  speak(text: string): void {
    if (!this.isSupported()) {
      this.callbacks.onError?.(
        "Text-to-speech is not supported in this browser.",
      );
      return;
    }

    const cleanedText = text.replace(/\s+/g, " ").trim();

    if (!cleanedText) {
      this.callbacks.onError?.("There is no text to read.");
      return;
    }

    this.stop();

    // Split long content into manageable chunks so full pages can be read.
    this.queue = this.splitText(cleanedText, 180);
    this.index = 0;
    this.speaking = true;
    this.speakNextChunk();
  }

  private splitText(text: string, maxLength: number): string[] {
    const sentences = text.match(/[^.!?।]+[.!?।]?/g) ?? [text];
    const chunks: string[] = [];
    let current = "";

    for (const sentence of sentences) {
      const part = sentence.trim();
      if (!part) continue;

      if ((current + " " + part).trim().length <= maxLength) {
        current = (current + " " + part).trim();
        continue;
      }

      if (current) chunks.push(current);

      if (part.length > maxLength) {
        for (let i = 0; i < part.length; i += maxLength) {
          chunks.push(part.slice(i, i + maxLength));
        }
        current = "";
      } else {
        current = part;
      }
    }

    if (current) chunks.push(current);
    return chunks;
  }

  private speakNextChunk(): void {
    if (!this.speaking || this.index >= this.queue.length) {
      this.speaking = false;
      this.currentUtterance = null;
      this.callbacks.onEnd?.();
      return;
    }

    const text = this.queue[this.index++];
    const utterance = new SpeechSynthesisUtterance(text);
    const language = TTS_LANGUAGES[this.selectedLanguage];

    utterance.lang = language.locale;
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;

    const prefix = this.selectedLanguage.toLowerCase();
    const locale = language.locale.toLowerCase();

    const matchingVoice = this.voices.find(
      (voice) => voice.lang.toLowerCase() === locale,
    ) ?? this.voices.find(
      (voice) => voice.lang.toLowerCase().startsWith(prefix),
    );

    if (matchingVoice) utterance.voice = matchingVoice;

    utterance.onstart = () => this.callbacks.onStart?.();

    utterance.onend = () => {
      if (this.speaking) this.speakNextChunk();
    };

    utterance.onerror = (event) => {
      if (
        event.error === "canceled" ||
        event.error === "interrupted"
      ) {
        return;
      }

      this.speaking = false;
      this.callbacks.onError?.(
        `Speech failed: ${event.error}. Check that a voice for ${language.name} is installed.`,
      );
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  pause(): void {
    if (this.isSupported() && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
    }
  }

  resume(): void {
    if (this.isSupported()) {
      window.speechSynthesis.resume();
    }
  }

  stop(): void {
    this.speaking = false;
    this.queue = [];
    this.index = 0;
    this.currentUtterance = null;

    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  isSpeaking(): boolean {
    return this.isSupported() && window.speechSynthesis.speaking;
  }

  isPaused(): boolean {
    return this.isSupported() && window.speechSynthesis.paused;
  }
}

export const accessibilityTTS = new AccessibilityTTS();
