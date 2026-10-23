export type AccessibilityProfile = 'deaf' | 'mute' | 'blind' | 'deaf-blind' | 'general';

export type SensoryTheme =
  | 'eye-comfort' // Gentle soothing blue-slate, non-irritating for deaf/sensory sensitivity
  | 'calm-forest' // Soft sage green, low eye strain
  | 'warm-amber' // Gentle warm sepia
  | 'high-contrast-dark' // Pure black with high-visibility gold/cyan
  | 'high-contrast-light' // Crisp white/dark navy
  | 'monochrome'; // Pure grayscale for photophobia

export interface SensorySettings {
  theme: SensoryTheme;
  brightness: number; // 70% to 130%
  contrast: number; // 80% to 150%
  fontSize: 'standard' | 'large' | 'extra-large';
  bionicReading: boolean;
  hapticFeedback: boolean;
  soundRadar: boolean;
  voiceSpeed: number; // 0.8 to 1.5
  uiLanguage: 'hi' | 'en' | 'es' | 'bn' | 'ta' | 'mr';
}

export interface ObstacleItem {
  label: string;
  position: 'left' | 'center' | 'right';
  distanceMeters: number;
  urgency: 'low' | 'medium' | 'critical';
}

export interface DetectedCurrency {
  found: boolean;
  denomination: string;
  confidence: number;
  noteCondition?: string;
}

export interface DocumentScanResult {
  documentType: string;
  isPrivacyRisk: boolean;
  privacyAlertMessage: string;
  extractedText: string;
  summary: string;
  signLanguageGloss: string[];
  keyActions: string[];
}

export interface BluetoothDeviceStatus {
  id: string;
  name: string;
  type: 'hearing-aid' | 'cochlear' | 'braille-display' | 'pulse-oximeter' | 'smart-cane';
  connected: boolean;
  battery: number;
  activeMode: string;
  lastTelemetry?: string;
}

export interface NavigationRoute {
  id: string;
  destinationName: string;
  distance: string;
  duration: string;
  tactileSteps: {
    instruction: string;
    distanceMeters: number;
    turnDirection: 'straight' | 'left' | 'right' | 'slight-left' | 'slight-right' | 'stairs-up' | 'stairs-down' | 'arrival';
    hapticPattern: number[];
    hazardWarning?: string;
  }[];
}

export interface VRVirtualWorld {
  id: string;
  name: string;
  nameHindi: string;
  category: 'transit' | 'nature' | 'urban' | 'cultural';
  description: string;
  soundscapeType: 'metro' | 'airport' | 'garden' | 'market' | 'temple';
  steps: {
    title: string;
    audioNarration: string;
    spatialSounds: string[];
    tactileVibe: number[];
    compassHeading: string;
  }[];
}

export interface SignGesture {
  gloss: string;
  meaning: string;
  meaningHindi: string;
  handshape: string;
  movement: string;
  facialExpression: string;
  category: 'daily' | 'emergency' | 'navigation' | 'health';
  svgGesturePath?: string;
}
