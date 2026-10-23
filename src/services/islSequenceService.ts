
export interface ISLSequenceResult {
  recognizedText: string;
  gloss: string[];
  confidence: number;
  observations: string;
  uncertain: boolean;
}

export async function recognizeISLSequence(
  frames: string[],
  language = 'English'
): Promise<ISLSequenceResult> {
  const response = await fetch(
    '/api/gemini/recognize-sign-sequence',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frames, language })
    }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `ISL analysis failed (${response.status}): ${message.slice(0, 300)}`
    );
  }

  const result: unknown = await response.json();

  if (
    !result ||
    typeof result !== 'object' ||
    !('recognizedText' in result) ||
    typeof result.recognizedText !== 'string'
  ) {
    throw new Error('Invalid ISL analysis response.');
  }

  return result as ISLSequenceResult;
}
