/**
 * Client service to communicate with backend Express Gemini endpoints
 */

import { DocumentScanResult, DetectedCurrency, ObstacleItem } from '../types';

export interface AssistantResponse {
  replyText: string;
  languageCode: string;
  languageName: string;
  command: string;
  commandPayload?: any;
  hapticVibrationPattern?: number[];
}

export interface SceneAnalysisResponse {
  detectedCurrency: DetectedCurrency;
  obstacles: ObstacleItem[];
  pathStatus: 'clear' | 'caution' | 'blocked';
  spokenGuidance: string;
  hapticCode: 'CLEAR' | 'LEFT' | 'RIGHT' | 'STOP_DANGER';
}

export interface SignTranslateResponse {
  originalText: string;
  signGloss: string[];
  gestureDetails: {
    gloss: string;
    handshape: string;
    movement: string;
    facialExpression: string;
    durationMs: number;
  }[];
  simpleExplanation: string;
}

export async function askGeminiAssistant(
  message: string,
  detectedLanguage?: string,
  context?: string
): Promise<AssistantResponse> {
  const res = await fetch('/api/gemini/assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, detectedLanguage, context }),
  });

  if (!res.ok) {
    throw new Error(`Server assist error: ${res.statusText}`);
  }

  return await res.json();
}

export async function analyzeSceneVision(
  imageBase64: string,
  mode: 'navigation' | 'currency' | 'all' = 'all',
  preferredLanguage: string = 'English'
): Promise<SceneAnalysisResponse> {
  const res = await fetch('/api/gemini/analyze-scene', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mode, preferredLanguage }),
  });

  if (!res.ok) {
    throw new Error(`Scene analysis error: ${res.statusText}`);
  }

  return await res.json();
}

export async function analyzeDocumentVision(
  imageBase64: string,
  userLanguage: string = 'English'
): Promise<DocumentScanResult> {
  const res = await fetch('/api/gemini/analyze-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, userLanguage }),
  });

  if (!res.ok) {
    throw new Error(`Document scan error: ${res.statusText}`);
  }

  return await res.json();
}

export async function translateToSignLanguage(
  text: string,
  targetDialect: string = 'ISL/ASL'
): Promise<SignTranslateResponse> {
  const res = await fetch('/api/gemini/sign-translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, targetDialect }),
  });

  if (!res.ok) {
    throw new Error(`Sign translation error: ${res.statusText}`);
  }

  return await res.json();
}
