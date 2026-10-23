
/**
 * Client service for Express Gemini endpoints.
 * Includes detailed error reporting for debugging.
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
  commandPayload?: any;
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

async function postJson<T>(
  url: string,
  payload: unknown,
  operation: string,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    console.error(`[${operation}] Network error:`, message);
    throw new Error(`${operation}: network request failed: ${message}`);
  }

  if (!response.ok) {
    let details = '';

    try {
      const body = await response.text();

      if (body) {
        try {
          const parsed = JSON.parse(body);
          details =
            parsed.details ||
            parsed.error ||
            parsed.message ||
            body;
        } catch {
          details = body;
        }
      }
    } catch {
      details = 'Could not read the server error response.';
    }

    const message =
      `${operation} failed (HTTP ${response.status} ${response.statusText})` +
      (details ? `: ${String(details).slice(0, 1200)}` : '');

    console.error(`[${operation}]`, message);
    throw new Error(message);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`${operation}: server returned invalid JSON.`);
  }
}

export async function askGeminiAssistant(
  message: string,
  detectedLanguage?: string,
  context?: string,
): Promise<AssistantResponse> {
  return postJson<AssistantResponse>(
    '/api/gemini/assist',
    { message, detectedLanguage, context },
    'AI assistant',
  );
}

export async function analyzeSceneVision(
  imageBase64: string,
  mode: 'navigation' | 'currency' | 'all' = 'all',
  preferredLanguage: string = 'English',
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
  userLanguage: string = 'English',
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
  targetDialect: string = 'ISL/ASL',
): Promise<SignTranslateResponse> {
  if (!text.trim()) {
    throw new Error('Text is required for sign-language translation.');
  }

  return postJson<SignTranslateResponse>(
    '/api/gemini/sign-translate',
    { text, targetDialect },
    'Sign-language translation',
  );
}
