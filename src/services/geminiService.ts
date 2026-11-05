
/**
 * Divyora
 * Frontend services for the Express + Gemini backend.
 */

import {
  DocumentScanResult,
  DetectedCurrency,
  ObstacleItem,
} from '../types';

export interface AssistantResponse {
  replyText: string;
  languageCode: string;
  languageName: string;
  command: string;
  commandPayload?: unknown;
  hapticVibrationPattern?: number[];
}

export interface SceneAnalysisResponse {
  detectedCurrency: DetectedCurrency;
  obstacles: ObstacleItem[];
  pathStatus: 'clear' | 'caution' | 'blocked';
  spokenGuidance: string;
  hapticCode: 'CLEAR' | 'LEFT' | 'RIGHT' | 'STOP_DANGER';
  sceneDescription?: string;
  roomType?: string;
  roomNumber?: string | null;
}

export interface GestureDetail {
  gloss: string;
  handshape: string;
  movement: string;
  facialExpression: string;
  durationMs: number;
}

export interface SignTranslateResponse {
  originalText: string;
  signGloss: string[];
  gestureDetails: GestureDetail[];
  simpleExplanation: string;
}

// Render backend URL
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  'https://divyang-sahayak-1uwi.onrender.com'
).replace(/\/+$/, '');

async function postJson<T>(
  path: string,
  payload: unknown,
  operation: string,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    console.error(`[${operation}] Network error:`, message);

    throw new Error(
      `${operation}: Could not connect to the backend. Check internet connection and Render server. ${message}`,
    );
  }

  if (!response.ok) {
    const details = await response.text().catch(
      () => 'Could not read server response.',
    );

    throw new Error(
      `${operation} failed (HTTP ${response.status}): ${details.slice(0, 1200)}`,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`${operation}: server returned invalid JSON.`);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeGestureDetails(value: unknown): GestureDetail[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) &&
        typeof item === 'object' &&
        !Array.isArray(item),
    )
    .map(item => ({
      gloss: stringValue(item.gloss),
      handshape: stringValue(item.handshape),
      movement: stringValue(item.movement),
      facialExpression: stringValue(item.facialExpression),
      durationMs:
        typeof item.durationMs === 'number' &&
        Number.isFinite(item.durationMs) &&
        item.durationMs >= 0
          ? Math.min(item.durationMs, 60000)
          : 0,
    }))
    .filter(item => item.gloss.length > 0)
    .slice(0, 100);
}

export async function askGeminiAssistant(
  message: string,
  detectedLanguage?: string,
  context?: string,
): Promise<AssistantResponse> {
  if (!message.trim()) throw new Error('Please enter a message.');

  return postJson<AssistantResponse>(
    '/api/gemini/assist',
    { message, detectedLanguage, context },
    'AI assistant',
  );
}

export async function analyzeSceneVision(
  imageBase64: string,
  mode: 'navigation' | 'currency' | 'all' = 'all',
  preferredLanguage = 'English',
): Promise<SceneAnalysisResponse> {
  if (!imageBase64) {
    throw new Error('Scene analysis requires an image.');
  }

  return postJson<SceneAnalysisResponse>(
    '/api/gemini/analyze-scene',
    { imageBase64, mode, preferredLanguage },
    'Scene analysis',
  );
}

export async function analyzeDocumentVision(
  imageBase64: string,
  userLanguage = 'English',
): Promise<DocumentScanResult> {
  if (!imageBase64) {
    throw new Error('Document scanning requires an image.');
  }

  return postJson<DocumentScanResult>(
    '/api/gemini/analyze-document',
    { imageBase64, userLanguage },
    'Document scanning',
  );
}

export async function translateToSignLanguage(
  text: string,
  targetDialect = 'ISL',
): Promise<SignTranslateResponse> {
  const normalizedText = text.trim();

  if (!normalizedText) {
    throw new Error('Text is required for sign-language translation.');
  }

  if (normalizedText.length > 1000) {
    throw new Error('Please keep the sentence under 1000 characters.');
  }

  const raw = await postJson<unknown>(
    '/api/gemini/sign-translate',
    { text: normalizedText, targetDialect },
    'Sign-language translation',
  );

  const result = asRecord(raw);

  const signGloss = Array.isArray(result.signGloss)
    ? result.signGloss
        .filter(
          (token): token is string =>
            typeof token === 'string' && token.trim().length > 0,
        )
        .map(token => token.trim())
        .slice(0, 100)
    : [];

  return {
    originalText: stringValue(result.originalText, normalizedText),
    signGloss,
    gestureDetails: normalizeGestureDetails(result.gestureDetails),
    simpleExplanation: stringValue(
      result.simpleExplanation,
      'AI-generated sign descriptions may need review by an ISL-fluent person.',
    ),
  };
}
