export type AccessibilityProfile =
  | 'deaf'
  | 'mute'
  | 'blind'
  | 'deaf-blind'
  | 'general';

export type SupportedLanguage =
  | 'en'
  | 'hi'
  | 'es'
  | 'mr'
  | 'bn'
  | 'ta'
  | 'te'
  | 'gu'
  | 'kn'
  | 'ml'
  | 'pa'
  | 'ur'
  | 'or';

export type SensoryTheme =
  | 'eye-comfort'
  | 'calm-forest'
  | 'warm-amber'
  | 'high-contrast-dark'
  | 'high-contrast-light'
  | 'monochrome';

export interface SensorySettings {
  theme: SensoryTheme;
  brightness: number;
  contrast: number;
  fontSize: 'standard' | 'large' | 'extra-large';
  bionicReading: boolean;
  hapticFeedback: boolean;
  soundRadar: boolean;
  voiceSpeed: number;
  uiLanguage: SupportedLanguage;
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
  type:
    | 'hearing-aid'
    | 'cochlear'
    | 'braille-display'
    | 'pulse-oximeter'
    | 'smart-cane';
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
    turnDirection:
      | 'straight'
      | 'left'
      | 'right'
      | 'slight-left'
      | 'slight-right'
      | 'stairs-up'
      | 'stairs-down'
      | 'arrival';
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
  soundscapeType:
    | 'metro'
    | 'airport'
    | 'garden'
    | 'market'
    | 'temple';
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