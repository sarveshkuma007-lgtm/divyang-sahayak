import express, { Request, Response } from 'express';

import { GoogleGenAI } from '@google/genai';

import 'dotenv/config';

import path from 'path';

import { fileURLToPath } from 'url';

import authRoutes from './src/services/authRoutes';







const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);



const app = express();

const PORT = parseInt(process.env.PORT || '3000', 10);



app.use(express.json({ limit: '20mb' }));

// Authentication routes (passkey/WebAuthn and optional password fallback)
app.use('/api/auth', authRoutes);



// Initialize Gemini API

const apiKey = process.env.GEMINI_API_KEY || '';

const ai = new GoogleGenAI({

  apiKey,

  httpOptions: {

    headers: {

      'User-Agent': 'aistudio-build',

    },

  },

});



// In-memory WebRTC signaling rooms for real peer-to-peer video calls

interface SignalMessage {

  from: string;

  type: 'offer' | 'answer' | 'candidate' | 'joined' | 'leave';

  payload?: any;

  timestamp: number;

}

const callRooms = new Map<string, SignalMessage[]>();



// WebRTC Signaling Endpoints

app.post('/api/webrtc/join', (req: Request, res: Response) => {

  const { roomId, peerId } = req.body;

  if (!roomId || !peerId) {

    res.status(400).json({ error: 'roomId and peerId are required' });

    return;

  }



  if (!callRooms.has(roomId)) {

    callRooms.set(roomId, []);

  }



  const room = callRooms.get(roomId)!;

  room.push({

    from: peerId,

    type: 'joined',

    payload: { peerId },

    timestamp: Date.now(),

  });



  res.json({ success: true, roomId, currentMessages: room.length });

});



app.post('/api/webrtc/send', (req: Request, res: Response) => {

  const { roomId, from, type, payload } = req.body;

  if (!roomId || !from || !type) {

    res.status(400).json({ error: 'Missing required fields' });

    return;

  }



  if (!callRooms.has(roomId)) {

    callRooms.set(roomId, []);

  }



  const room = callRooms.get(roomId)!;

  room.push({ from, type, payload, timestamp: Date.now() });



  // Clean old messages after 200 items

  if (room.length > 200) {

    room.splice(0, 100);

  }



  res.json({ success: true });

});



app.get('/api/webrtc/poll', (req: Request, res: Response) => {

  const roomId = req.query.roomId as string;

  const peerId = req.query.peerId as string;

  const since = parseInt((req.query.since as string) || '0', 10);



  if (!roomId || !peerId) {

    res.status(400).json({ error: 'roomId and peerId required' });

    return;

  }



  const room = callRooms.get(roomId) || [];

  const newMessages = room.filter(

    (msg) => msg.from !== peerId && msg.timestamp > since

  );



  res.json({ messages: newMessages, timestamp: Date.now() });

});



// Gemini Assistant: Conversational Voice & Text Engine

app.post('/api/gemini/assist', async (req: Request, res: Response) => {

  try {

    const { message, detectedLanguage, context } = req.body;



    if (!message) {

      res.status(400).json({ error: 'Message is required' });

      return;

    }



    const systemInstruction = `

You are the central AI Accessibility Co-pilot for "Divyang Sahayak", an app built for Divyang individuals: Deaf, Mute, Blind, Deaf-Blind, and differently-abled users.

Users may speak or type in any language including Hindi, English, Hinglish, Marathi, Bengali, Tamil, Spanish, etc.

Always detect the user's intent and language. Respond naturally in the SAME language the user is speaking or typing.

If the user asks an operational command (e.g. "navigate to hospital", "scan document", "detect currency", "turn on high contrast", "SOS", "open call", "connect hearing aid"), include a recognized intent in the structured response.



Output JSON format with keys:

{

  "replyText": "Helpful, concise, friendly response tailored for the user (in user's detected language)",

  "languageCode": "e.g. hi, en, es, bn",

  "languageName": "e.g. Hindi, English, Spanish",

  "command": "NAVIGATE | SCAN_DOCUMENT | DETECT_CURRENCY | TOGGLE_HIGH_CONTRAST | TRIGGER_SOS | START_CALL | CONNECT_BLUETOOTH | GENERAL_QUERY",

  "commandPayload": { "destination": "...", "mode": "..." } or null,

  "hapticVibrationPattern": [100, 50, 100] // suggested vibration pattern for haptic feedback

}

`.trim();



    const prompt = `User said: "${message}". User language detected on device: "${detectedLanguage || 'auto'}". Current screen context: "${context || 'dashboard'}". Provide JSON response.`;



    const response = await ai.models.generateContent({

      model: 'gemini-3.8-flash',

      contents: prompt,

      config: {

        systemInstruction,

        responseMimeType: 'application/json',

        temperature: 0.2,

      },

    });



    const text = response.text || '{}';

    let parsed;

    try {

      parsed = JSON.parse(text);

    } catch {

      parsed = {

        replyText: text,

        languageCode: detectedLanguage || 'en',

        languageName: 'English',

        command: 'GENERAL_QUERY',

        commandPayload: null,

        hapticVibrationPattern: [100],

      };

    }



    res.json(parsed);

  } catch (error: any) {

    console.error('Gemini Assist Error:', error);

    res.status(500).json({

      error: 'Failed to process AI assistance request',

      details: error?.message || 'Unknown error',

    });

  }

});



// Gemini Scene & Obstacle & Currency Analysis (for Blind Navigation and Money Detection)

app.post('/api/gemini/analyze-scene', async (req: Request, res: Response) => {

  const startedAt = Date.now();
  try {

    const { imageBase64, mode, preferredLanguage } = req.body;



    if (!imageBase64) {

      res.status(400).json({ error: 'Image base64 data is required' });

      return;

    }



    // Accept a data URL or raw base64. Preserve the actual image MIME type.
    const dataUrlMatch = typeof imageBase64 === 'string'
      ? imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/i)
      : null;
    const mimeType = dataUrlMatch?.[1]?.toLowerCase() || 'image/jpeg';
    const base64Data = dataUrlMatch ? dataUrlMatch[2] : imageBase64;

    if (typeof base64Data !== 'string' || base64Data.length < 100) {
      res.status(400).json({ error: 'Image data is invalid or too small to analyze.' });
      return;
    }
    if (!/^image\/(jpeg|jpg|png|webp|gif)$/i.test(mimeType)) {
      res.status(400).json({ error: `Unsupported image type: ${mimeType}` });
      return;
    }



    const systemInstruction = `

You are the real-time Vision & Obstacle Guidance Engine for visually impaired and blind users.

Analyze the actual pixels in the provided image. Do not invent objects that are not visible. If the image is blurry, dark, blocked, or does not show a walkable scene, say so in spokenGuidance and set pathStatus to "caution"; never claim the path is clear without visual evidence.

Modes:

1\. "navigation": Describe whether a walkable path is visible. Detect only visible obstacles (stairs, curbs, poles, vehicles, puddles, walls, doorways, people, furniture, bags, and other objects) and classify their position as left, center, or right. Give only a rough distance estimate when reasonably inferable; do not present it as measured.

2\. "currency": Detect any banknotes or coins visible (Indian Rupees ₹10, ₹20, ₹50, ₹100, ₹200, ₹500, or foreign currencies like USD $1, $5, $10, $20, $50, $100). Identify denomination clearly.

3\. "all": Both obstacle and currency analysis.



Language requirement: Provide concise, clear spoken prompt text in "${preferredLanguage || 'English'}" (if Hindi is requested, provide clear Hindi).



Return JSON only:

{

  "detectedCurrency": {

    "found": boolean,

    "denomination": string, // e.g. "₹500 (Five Hundred Rupees)"

    "confidence": number, // 0 to 1

    "noteCondition": string

  },

  "obstacles": [

    {

      "label": string, // e.g. "Stairs going down", "Bicycle", "Low branch"

      "position": "left" | "center" | "right",

      "distanceMeters": number,

      "urgency": "low" | "medium" | "critical"

    }

  ],

  "pathStatus": "clear" | "caution" | "blocked",

  "spokenGuidance": "Direct short audio instruction, e.g., 'Straight path clear for 4 meters' or 'Caution: 2 steps down 1 meter ahead in center'",

  "hapticCode": "CLEAR" | "LEFT" | "RIGHT" | "STOP_DANGER"

}

`.trim();



    // Use the REST endpoint directly for this vision route so the request has
    // a real AbortSignal timeout. The SDK call above does not accept a signal
    // in this shape, which can leave the browser request pending on socket hangs.
    if (!apiKey) {
      res.status(500).json({ error: 'Gemini API key is missing. Set GEMINI_API_KEY in .env.' });
      return;
    }

    const GEMINI_MODEL = "gemini-3.6-flash";
    const requestBody = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: `Analyze this image in mode "${mode || 'all'}". Preferred language: ${preferredLanguage || 'English'}. Return JSON.` },
        ],
      }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
    };

    let apiResponse: globalThis.Response | undefined;
    let lastNetworkError: unknown;
    // Retry once only for transient network failures; each attempt is bounded.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        apiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(25000),
          },
        );
        break;
      } catch (networkError) {
        lastNetworkError = networkError;
        console.error(`[Vision] network attempt ${attempt}/2 failed:`, networkError);
        if (attempt === 2) throw networkError;
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }

    if (!apiResponse) throw lastNetworkError || new Error('Gemini API did not respond.');

    const apiPayload: any = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok) {
      const message = apiPayload?.error?.message || `Gemini API returned HTTP ${apiResponse.status}`;
      console.error(`[Vision] Gemini HTTP ${apiResponse.status}: ${message}`);
      res.status(apiResponse.status >= 400 && apiResponse.status < 600 ? apiResponse.status : 502).json({
        error: 'Gemini scene analysis request failed',
        details: message,
      });
      return;
    }

    const text = apiPayload?.candidates?.[0]?.content?.parts
      ?.map((part: any) => typeof part.text === 'string' ? part.text : '')
      .join('') || '{}';
    let result: any;

    try {
      result = JSON.parse(text);
    } catch {
      console.error('Gemini Scene Analysis returned non-JSON output:', text);
      res.status(502).json({
        error: 'Vision model returned an unreadable response. Please try again.',
        details: 'The model response was not valid JSON.',
      });
      return;
    }

    if (!result || typeof result !== 'object' || !Array.isArray(result.obstacles)) {
      res.status(502).json({
        error: 'Vision model response was missing the obstacle list. Please try again.',
      });
      return;
    }

    const validPositions = new Set(['left', 'center', 'right']);
    const validUrgencies = new Set(['low', 'medium', 'critical']);
    result.obstacles = result.obstacles
      .filter((item: any) => item && typeof item.label === 'string' && item.label.trim())
      .map((item: any) => ({
        label: item.label.trim(),
        position: validPositions.has(item.position) ? item.position : 'center',
        distanceMeters: Number.isFinite(Number(item.distanceMeters))
          ? Math.max(0, Number(item.distanceMeters))
          : 1,
        urgency: validUrgencies.has(item.urgency) ? item.urgency : 'medium',
      }));

    if (!['clear', 'caution', 'blocked'].includes(result.pathStatus)) {
      result.pathStatus = 'caution';
    }
    if (typeof result.spokenGuidance !== 'string' || !result.spokenGuidance.trim()) {
      result.spokenGuidance = result.obstacles.length
        ? `Caution. ${result.obstacles.length} possible obstacle(s) detected. Stop and check your surroundings.`
        : 'I could not confidently assess the path. Please check your surroundings before moving.';
    }
    if (!['CLEAR', 'LEFT', 'RIGHT', 'STOP_DANGER'].includes(result.hapticCode)) {
      result.hapticCode = result.obstacles.some((item: any) => item.urgency === 'critical')
        ? 'STOP_DANGER'
        : 'CLEAR';
    }

    console.log(`[Vision] mode=${mode || 'all'} imageChars=${base64Data.length} obstacles=${result.obstacles.length} durationMs=${Date.now() - startedAt}`);
    res.json(result);

  } catch (error: any) {

    console.error(`[Vision] failed after ${Date.now() - startedAt}ms:`, error);

    res.status(500).json({

      error: 'Failed to analyze camera scene',

      details: error?.message || 'Unknown error',

    });

  }

});



// Gemini Document Scanner with Privacy Shield & Sign Language Gloss

app.post('/api/gemini/analyze-document', async (req: Request, res: Response) => {

  try {

    const { imageBase64, userLanguage } = req.body;



    if (!imageBase64) {

      res.status(400).json({ error: 'Image base64 is required' });

      return;

    }



    // Accept a data URL or raw base64. Preserve the actual image MIME type.
    const dataUrlMatch = typeof imageBase64 === 'string'
      ? imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/i)
      : null;
    const mimeType = dataUrlMatch?.[1]?.toLowerCase() || 'image/jpeg';
    const base64Data = dataUrlMatch ? dataUrlMatch[2] : imageBase64;

    if (typeof base64Data !== 'string' || base64Data.length < 100) {
      res.status(400).json({ error: 'Image data is invalid or too small to analyze.' });
      return;
    }
    if (!/^image\/(jpeg|jpg|png|webp|gif)$/i.test(mimeType)) {
      res.status(400).json({ error: `Unsupported image type: ${mimeType}` });
      return;
    }



    const systemInstruction = `

You are the Document Scanner and Accessibility Privacy Officer for Divyang individuals.

Analyze the captured photo of a paper or document.

Tasks:

1\. Extract the full legible text (OCR).

2\. Classify document type: "Medical Report / Prescription", "Bank Statement / Financial", "Government Identity / Card", "Public Notice / Transit Schedule", "Utility Bill", "Personal Letter / Note", "Unknown".

3\. CRITICAL PRIVACY CHECK: Is this document confidential or sensitive?

   Mark "isPrivacyRisk: true" if it contains personal financial numbers, medical conditions, Aadhaar/SSN/Tax ID, private legal info, passwords, or personal identity details.

   If true, generate a clear Privacy Warning: "Privacy Alert: This document contains sensitive personal information. Please connect your Bluetooth earpiece first or move to a private location before text is read aloud or displayed."

4\. Convert key message into structured Sign Language gloss keywords (e.g. ["HOSPITAL", "MEDICINE", "TWO", "TIMES", "DAY", "AFTER", "FOOD"]).

5\. Provide a summary suitable for TTS and reading.



Respond strictly with JSON:

{

  "documentType": string,

  "isPrivacyRisk": boolean,

  "privacyAlertMessage": string,

  "extractedText": string,

  "summary": string,

  "signLanguageGloss": string[],

  "keyActions": string[]

}

`.trim();



    const response = await ai.models.generateContent({

      model: 'gemini-3.8-flash',

      contents: {

        parts: [

          {

            inlineData: {

              mimeType,

              data: base64Data,

            },

          },

          {

            text: `Analyze document. User preferred language: ${userLanguage || 'English'}. Return JSON.`,

          },

        ],

      },

      config: {

        systemInstruction,

        responseMimeType: 'application/json',

        temperature: 0.1,

      },

    });



    const text = response.text || '{}';

    let result;

    try {

      result = JSON.parse(text);

    } catch {

      result = {

        documentType: 'Unknown',

        isPrivacyRisk: false,

        privacyAlertMessage: '',

        extractedText: 'Could not extract text clearly.',

        summary: 'Please try taking a clearer, well-lit photo of the document.',

        signLanguageGloss: ['TRY', 'AGAIN', 'DOCUMENT'],

        keyActions: ['Retake photo'],

      };

    }



    res.json(result);

  } catch (error: any) {

    console.error('Document Scanner Error:', error);

    res.status(500).json({

      error: 'Failed to analyze document',

      details: error?.message || 'Unknown error',

    });

  }

});



// Gemini Sign Language Translation & Synthesis

app.post('/api/gemini/sign-translate', async (req: Request, res: Response) => {

  try {

    const { text, targetDialect } = req.body;



    if (!text) {

      res.status(400).json({ error: 'Text is required' });

      return;

    }



    const systemInstruction = `

You are a master Sign Language linguist specializing in ISL (Indian Sign Language) and ASL (American Sign Language).

Translate the user's sentence into structured sign language sequence with gloss, handshapes, body/facial expressions, and timing.

Respond in JSON:

{

  "originalText": string,

  "signGloss": string[], // e.g. ["HELLO", "HOW", "YOU", "TODAY"]

  "gestureDetails": [

    {

      "gloss": string,

      "handshape": string, // e.g. "Open 5 hand", "Index point", "Flat palm on chest"

      "movement": string, // e.g. "Wave gently near right temple", "Arc forward"

      "facialExpression": string, // e.g. "Smile, head tilt", "Questioning eyebrows"

      "durationMs": number

    }

  ],

  "simpleExplanation": string

}

`.trim();



    const response = await ai.models.generateContent({

      model: 'gemini-3.8-flash',

      contents: `Translate this phrase to sign language structure: "${text}". Target: ${targetDialect || 'ISL/ASL universal'}. Output JSON.`,

      config: {

        systemInstruction,

        responseMimeType: 'application/json',

        temperature: 0.1,

      },

    });



    const respText = response.text || '{}';

    let result;

    try {

      result = JSON.parse(respText);

    } catch {

      result = {

        originalText: text,

        signGloss: text.toUpperCase().split(' '),

        gestureDetails: [],

        simpleExplanation: text,

      };

    }



    res.json(result);

  } catch (error: any) {

    console.error('Sign Translate Error:', error);

    res.status(500).json({

      error: 'Failed to translate sign language',

      details: error?.message || 'Unknown error',

    });

  }

});



// Gemini-generated sign illustration for Text-to-Sign.
// NOTE: Generated illustrations are learning concepts, not verified ISL reference signs.
app.post('/api/gemini/generate-sign-image', async (req: Request, res: Response) => {
  try {
    if (!apiKey) {
      res.status(500).json({ error: 'GEMINI_API_KEY is missing from .env.' });
      return;
    }

    const { sentence, gloss, signDescription } = req.body || {};

    if (
      typeof sentence !== 'string' || !sentence.trim() ||
      typeof gloss !== 'string' || !gloss.trim()
    ) {
      res.status(400).json({ error: 'A sentence and gloss token are required.' });
      return;
    }

    const safeSentence = sentence.trim().slice(0, 500);
    const safeGloss = gloss.trim().slice(0, 80);
    const safeDescription = typeof signDescription === 'string'
      ? signDescription.trim().slice(0, 500)
      : '';

    const prompt = `Create one clear educational illustration for a sign-language learning application.
Original sentence: "${safeSentence}"
Sign/gloss token to illustrate: "${safeGloss}"
Additional gesture description: "${safeDescription || 'Not provided'}"
Show one adult human from the waist up, with both hands fully visible and anatomically plausible. Use a plain light background, consistent clothing, good lighting, and a clear view of the hands. Make the hand position and body pose the main focus. Do not add written words, captions, labels, logos, or watermarks. Generate a single image, not a collage or a multi-panel storyboard.
Important: This is an AI-generated concept illustration, not a verified Indian Sign Language reference. Do not claim that the depicted gesture is a correct ISL sign.`;

    const imageModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
    const response = await ai.models.generateContent({
      model: imageModel,
      contents: prompt,
      config: { responseModalities: ['IMAGE'] },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part: any) =>
      part.inlineData?.data &&
      typeof part.inlineData.mimeType === 'string' &&
      part.inlineData.mimeType.startsWith('image/'),
    );

    if (!imagePart?.inlineData?.data) {
      res.status(502).json({
        error: 'Gemini did not return an image. Check image-model access and API quota.',
        details: parts
          .filter((part: any) => typeof part.text === 'string')
          .map((part: any) => part.text)
          .join('\n')
          .slice(0, 1000),
      });
      return;
    }

    res.json({
      imageDataUrl: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
      gloss: safeGloss,
      sentence: safeSentence,
      model: imageModel,
      note: 'AI-generated concept illustration; ISL accuracy is not verified.',
    });
  } catch (error: any) {
    console.error('Sign image generation failed:', error);
    res.status(500).json({
      error: 'Failed to generate sign illustration.',
      details: error?.message || 'Unknown server error',
    });
  }
});


// Setup Vite middleware in dev or static files in production

async function startServer() {

  const isDev = process.env.NODE_ENV !== 'production';



  if (isDev) {

    const { createServer } = await import('vite');

    const vite = await createServer({

      server: { middlewareMode: true },

      appType: 'spa',

    });

    app.use(vite.middlewares);

  } else {

    const distPath = path.resolve(__dirname, 'dist');

    app.use(express.static(distPath));

    app.get('*', (_req: Request, res: Response) => {

      res.sendFile(path.resolve(distPath, 'index.html'));

    });

  }



  app.listen(PORT, '0.0.0.0', () => {

    console.log(`Divyang Sahayak Server running on port ${PORT}`);

  });

}



startServer();
