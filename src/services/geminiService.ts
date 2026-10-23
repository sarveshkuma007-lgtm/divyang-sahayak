
/**
 * Divyang Sahayak
 * Frontend services for the Express + Gemini backend.
 *
 * Keeps existing assistant, scene analysis, document scanning,
 * and sign-language translation APIs.
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

async function postJson<T>(
  url: string,
  payload: unknown,
  operation: string,
): Promise<T> {
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
      `${operation}: network request failed: ${message}`,
    );
  }

  if (!response.ok) {
    let details = '';

    try {
      const body = await response.text();

      if (body) {
        try {
          const parsed: unknown = JSON.parse(body);

          if (parsed && typeof parsed === 'object') {
            const value = parsed as Record<string, unknown>;

            details =
              (typeof value.details === 'string' && value.details) ||
              (typeof value.error === 'string' && value.error) ||
              (typeof value.message === 'string' && value.message) ||
              body;
          } else {
            details = body;
          }
        } catch {
          details = body;
        }
      }
    } catch {
      details = 'Could not read the server error response.';
    }

    const message =
      `${operation} failed (HTTP ${response.status} ${response.statusText})` +
      (details ? `: ${details.slice(0, 1200)}` : '');

    console.error(`[${operation}]`, message);
    throw new Error(message);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(
      `${operation}: server returned invalid JSON.`,
    );
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
    .map(item => {
      const duration = item.durationMs;

      return {
        gloss: stringValue(item.gloss),
        handshape: stringValue(item.handshape),
        movement: stringValue(item.movement),
        facialExpression: stringValue(item.facialExpression),
        durationMs:
          typeof duration === 'number' &&
          Number.isFinite(duration) &&
          duration >= 0
            ? Math.min(duration, 60000)
            : 0,
      };
    })
    .filter(item => item.gloss.length > 0)
    .slice(0, 100);
}

export async function askGeminiAssistant(
  message: string,
  detectedLanguage?: string,
  context?: string,
): Promise<AssistantResponse> {
  if (!message.trim()) {
    throw new Error('Please enter a message.');
  }

  return postJson<AssistantResponse>(
    '/api/gemini/assist',
    {
      message,
      detectedLanguage,
      context,
    },
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
    {
      imageBase64,
      mode,
      preferredLanguage,
    },
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
    {
      imageBase64,
      userLanguage,
    },
    'Document scanning',
  );
}

/**
 * Requests a proposed sign-language sequence from the backend.
 *
 * The response contains gloss tokens and optional gesture descriptions.
 * It is not itself a video, avatar, or verified ISL translation.
 */
export async function translateToSignLanguage(
  text: string,
  targetDialect = 'ISL',
): Promise<SignTranslateResponse> {
  const normalizedText = text.trim();

  if (!normalizedText) {
    throw new Error(
      'Text is required for sign-language translation.',
    );
  }

  if (normalizedText.length > 1000) {
    throw new Error(
      'Please keep the sentence under 1000 characters.',
    );
  }

  const raw = await postJson<unknown>(
    '/api/gemini/sign-translate',
    {
      text: normalizedText,
      targetDialect,
    },
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

  const gestureDetails = normalizeGestureDetails(
    result.gestureDetails,
  );

  return {
    originalText: stringValue(
      result.originalText,
      normalizedText,
    ),
    signGloss,
    gestureDetails,
    simpleExplanation: stringValue(
      result.simpleExplanation,
      'AI-generated sign descriptions may need review by an ISL-fluent person.',
    ),
  };
}
