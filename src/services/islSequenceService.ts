
/**
 * Divyang Sahayak
 * ISL Sequence Recognition Service
 *
 * Sends chronological camera frames to the backend for experimental
 * sign-sequence interpretation.
 *
 * Note:
 * This service does not itself contain a trained continuous ISL model.
 * Recognition quality depends on the backend model and available data.
 */

export interface ISLSequenceResult {
  recognizedText: string;
  gloss: string[];
  confidence: number;
  observations: string;
  uncertain: boolean;
  model?: string;
  note?: string;
}

const ENDPOINT = '/api/gemini/recognize-sign-sequence';

const MIN_FRAMES = 2;
const MAX_FRAMES = 8;
const MAX_TOTAL_FRAME_CHARS = 14_000_000;

const IMAGE_DATA_URL =
  /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/i;

function parseErrorPayload(payload: unknown): {
  error?: string;
  details?: string;
} {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const value = payload as Record<string, unknown>;

  return {
    error:
      typeof value.error === 'string'
        ? value.error
        : undefined,
    details:
      typeof value.details === 'string'
        ? value.details
        : undefined,
  };
}

export async function recognizeISLSequence(
  frames: string[],
  language = 'English',
): Promise<ISLSequenceResult> {
  if (!Array.isArray(frames)) {
    throw new Error(
      'Signing frames must be provided as an array.',
    );
  }

  if (
    frames.length < MIN_FRAMES ||
    frames.length > MAX_FRAMES
  ) {
    throw new Error(
      `Provide between ${MIN_FRAMES} and ${MAX_FRAMES} frames. ` +
        'Capture a short signing sequence and try again.',
    );
  }

  let totalChars = 0;

  for (const frame of frames) {
    if (
      typeof frame !== 'string' ||
      !IMAGE_DATA_URL.test(frame)
    ) {
      throw new Error(
        'One or more camera frames are invalid. ' +
          'Restart the camera and capture the sequence again.',
      );
    }

    totalChars += frame.length;
  }

  if (totalChars > MAX_TOTAL_FRAME_CHARS) {
    throw new Error(
      'The signing sequence is too large. ' +
        'Try fewer frames or reduce camera resolution.',
    );
  }

  const preferredLanguage =
    typeof language === 'string' && language.trim()
      ? language.trim().slice(0, 60)
      : 'English';

  let response: Response;

  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        frames,
        language: preferredLanguage,
      }),
    });
  } catch (error: unknown) {
    const details =
      error instanceof Error
        ? error.message
        : String(error);

    throw new Error(
      'Could not reach the ISL backend. Make sure the server is ' +
        'running and open the app through its local URL. ' +
        `Details: ${details}`,
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error(
      `The server returned invalid JSON (HTTP ${response.status}). ` +
        'Check the terminal running server.ts.',
    );
  }

  if (!response.ok) {
    const errorPayload = parseErrorPayload(payload);

    const message =
      errorPayload.error ||
      `ISL analysis failed with HTTP ${response.status}.`;

    throw new Error(
      errorPayload.details
        ? `${message} Details: ${errorPayload.details}`
        : message,
    );
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error(
      'The ISL backend returned an invalid response.',
    );
  }

  const result = payload as Record<string, unknown>;

  if (typeof result.recognizedText !== 'string') {
    throw new Error(
      'The ISL response is missing recognizedText. ' +
        'Check the backend endpoint in server.ts.',
    );
  }

  const confidence =
    typeof result.confidence === 'number' &&
    Number.isFinite(result.confidence)
      ? Math.max(0, Math.min(1, result.confidence))
      : 0;

  const gloss = Array.isArray(result.gloss)
    ? result.gloss
        .filter(
          (token: unknown): token is string =>
            typeof token === 'string',
        )
        .slice(0, 50)
    : [];

  const recognizedText = result.recognizedText.trim();

  return {
    recognizedText,
    gloss,
    confidence,
    observations:
      typeof result.observations === 'string'
        ? result.observations
        : '',
    uncertain:
      result.uncertain !== false ||
      !recognizedText ||
      confidence < 0.5,
    ...(typeof result.model === 'string'
      ? { model: result.model }
      : {}),
    ...(typeof result.note === 'string'
      ? { note: result.note }
      : {}),
  };
}
