import express, { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '20mb' }));

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
      model: 'gemini-3.5-flash-lite',
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
  try {
    const { imageBase64, mode, preferredLanguage } = req.body;

    if (!imageBase64) {
      res.status(400).json({ error: 'Image base64 data is required' });
      return;
    }

    // Clean base64 string
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const systemInstruction = `
You are the real-time Vision & Obstacle Guidance Engine for visually impaired and blind users.
Analyze the provided camera frame thoroughly.
Modes:
1. "navigation": Detect walking surface, physical obstacles (stairs, curbs, poles, vehicles, puddles, walls, doorways, people), their position (Left, Center, Right), approximate distance in meters (e.g., 0.8m, 1.5m, 3m), and safety advice.
2. "currency": Detect any banknotes or coins visible (Indian Rupees â‚¹10, â‚¹20, â‚¹50, â‚¹100, â‚¹200, â‚¹500, or foreign currencies like USD $1, $5, $10, $20, $50, $100). Identify denomination clearly.
3. "all": Both obstacle and currency analysis.

Language requirement: Provide concise, clear spoken prompt text in "${preferredLanguage || 'English'}" (if Hindi is requested, provide clear Hindi).

Return JSON only:
{
  "detectedCurrency": {
    "found": boolean,
    "denomination": string, // e.g. "â‚¹500 (Five Hundred Rupees)"
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

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data,
            },
          },
          {
            text: `Analyze this image in mode "${mode || 'all'}". Preferred language: ${preferredLanguage || 'English'}. Return JSON.`,
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
        detectedCurrency: { found: false, denomination: '', confidence: 0, noteCondition: '' },
        obstacles: [],
        pathStatus: 'caution',
        spokenGuidance: 'Path visible. Proceed with caution.',
        hapticCode: 'CLEAR',
      };
    }

    res.json(result);
  } catch (error: any) {
    console.error('Gemini Scene Analysis Error:', error);
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

    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const systemInstruction = `
You are the Document Scanner and Accessibility Privacy Officer for Divyang individuals.
Analyze the captured photo of a paper or document.
Tasks:
1. Extract the full legible text (OCR).
2. Classify document type: "Medical Report / Prescription", "Bank Statement / Financial", "Government Identity / Card", "Public Notice / Transit Schedule", "Utility Bill", "Personal Letter / Note", "Unknown".
3. CRITICAL PRIVACY CHECK: Is this document confidential or sensitive?
   Mark "isPrivacyRisk: true" if it contains personal financial numbers, medical conditions, Aadhaar/SSN/Tax ID, private legal info, passwords, or personal identity details.
   If true, generate a clear Privacy Warning: "Privacy Alert: This document contains sensitive personal information. Please connect your Bluetooth earpiece first or move to a private location before text is read aloud or displayed."
4. Convert key message into structured Sign Language gloss keywords (e.g. ["HOSPITAL", "MEDICINE", "TWO", "TIMES", "DAY", "AFTER", "FOOD"]).
5. Provide a summary suitable for TTS and reading.

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
      model: 'gemini-3.5-flash-lite',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
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
      model: 'gemini-3.5-flash-lite',
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

