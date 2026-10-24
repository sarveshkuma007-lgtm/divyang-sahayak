
import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  CameraOff,
  Volume2,
  Sparkles,
  Hand,
  RefreshCw,
  MessageSquare,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Play,
  AlertTriangle,
} from 'lucide-react';

import { SensorySettings, SignGesture } from '../types';
import { triggerHaptic, HAPTIC_PATTERNS } from '../services/haptics';
import { speakText } from '../services/speechService';
import { translateToSignLanguage } from '../services/geminiService';
import { recognizeISLSequence } from '../services/islSequenceService';
import AccessibleTalk from './AccessibleTalk';
import { useHandGestureRecognition } from '../services/handGestureRecognition';

interface SignLanguageModuleProps {
  settings: SensorySettings;
}

interface GestureDetail {
  gloss: string;
  handshape: string;
  movement: string;
  facialExpression: string;
  durationMs: number;
}

const ESSENTIAL_GESTURES: SignGesture[] = [
  {
    gloss: 'HELLO',
    meaning: 'Hello / Greetings',
    meaningHindi: 'नमस्ते / अभिवादन',
    handshape: 'Check a verified ISL demonstration',
    movement: 'Greeting movement',
    facialExpression: 'Friendly expression',
    category: 'daily',
  },
  {
    gloss: 'THANK YOU',
    meaning: 'Thank you',
    meaningHindi: 'धन्यवाद',
    handshape: 'Check a verified ISL demonstration',
    movement: 'Refer to a verified ISL dictionary',
    facialExpression: 'Context dependent',
    category: 'daily',
  },
  {
    gloss: 'HELP',
    meaning: 'I need help',
    meaningHindi: 'मुझे मदद चाहिए',
    handshape: 'Check a verified ISL demonstration',
    movement: 'Refer to a verified ISL dictionary',
    facialExpression: 'Context dependent',
    category: 'emergency',
  },
  {
    gloss: 'WATER',
    meaning: 'Water',
    meaningHindi: 'पानी',
    handshape: 'Check a verified ISL demonstration',
    movement: 'Refer to a verified ISL dictionary',
    facialExpression: 'Context dependent',
    category: 'health',
  },
  {
    gloss: 'DOCTOR',
    meaning: 'Doctor',
    meaningHindi: 'डॉक्टर',
    handshape: 'Check a verified ISL demonstration',
    movement: 'Refer to a verified ISL dictionary',
    facialExpression: 'Context dependent',
    category: 'health',
  },
  {
    gloss: 'YES',
    meaning: 'Yes',
    meaningHindi: 'हाँ',
    handshape: 'Check a verified ISL demonstration',
    movement: 'Refer to a verified ISL dictionary',
    facialExpression: 'Context dependent',
    category: 'daily',
  },
  {
    gloss: 'NO',
    meaning: 'No',
    meaningHindi: 'नहीं',
    handshape: 'Check a verified ISL demonstration',
    movement: 'Refer to a verified ISL dictionary',
    facialExpression: 'Context dependent',
    category: 'daily',
  },
  {
    gloss: 'STOP',
    meaning: 'Stop',
    meaningHindi: 'रुकिए',
    handshape: 'Check a verified ISL demonstration',
    movement: 'Refer to a verified ISL dictionary',
    facialExpression: 'Context dependent',
    category: 'navigation',
  },
];

const FRAME_COUNT = 8;
const FRAME_INTERVAL_MS = 450;
const MAX_SENTENCE_LENGTH = 1000;

export const SignLanguageModule: React.FC<SignLanguageModuleProps> = ({
  settings,
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [detectedSign, setDetectedSign] = useState<SignGesture | null>(null);

  const [inputText, setInputText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const [translatedGloss, setTranslatedGloss] = useState<string[]>([]);
  const [gestureDetails, setGestureDetails] = useState<GestureDetail[]>([]);
  const [translationExplanation, setTranslationExplanation] = useState('');
  const [activeGlossIndex, setActiveGlossIndex] = useState(0);

  const [recognizedSentence, setRecognizedSentence] = useState('');
  const [recognizedGloss, setRecognizedGloss] = useState<string[]>([]);
  const [recognitionConfidence, setRecognitionConfidence] = useState(0);
  const [recognitionObservations, setRecognitionObservations] = useState('');
  const [recognitionUncertain, setRecognitionUncertain] = useState(true);

  const [recognitionStatus, setRecognitionStatus] = useState('Camera off');
  const [recognitionBusy, setRecognitionBusy] = useState(false);
  const [recognitionError, setRecognitionError] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRunningRef = useRef(false);
  const lastSpokenSentenceRef = useRef('');
  const cameraActiveRef = useRef(false);
  const mountedRef = useRef(true);

  const { result: liveGesture, status: liveGestureStatus } =
    useHandGestureRecognition(videoRef, cameraActive);

  // Speak ONLY the recognized sign-language text. Status messages, gesture
  // model labels, confidence scores, observations, and errors stay silent.
  useEffect(() => {
    const sentence = recognizedSentence.trim();
    if (!sentence || sentence === lastSpokenSentenceRef.current) return;
    if (!("speechSynthesis" in window)) return;

    lastSpokenSentenceRef.current = sentence;
    const timer = window.setTimeout(() => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(sentence);
      utterance.lang = settings.uiLanguage === 'hi' ? 'hi-IN' : 'en-IN';
      utterance.rate = Math.min(2, Math.max(0.5, settings.voiceSpeed || 1));
      utterance.onerror = event => {
        console.error('ISL recognized-text speech failed:', event.error);
      };
      window.speechSynthesis.speak(utterance);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [recognizedSentence, settings.uiLanguage, settings.voiceSpeed]);

  useEffect(() => {
    cameraActiveRef.current = cameraActive;
  }, [cameraActive]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      cameraActiveRef.current = false;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const stopCamera = () => {
    cameraActiveRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
    setRecognitionStatus('Camera off');
    setRecognitionBusy(false);
    triggerHaptic(HAPTIC_PATTERNS.CLICK);
  };

  const toggleCamera = async () => {
    if (cameraActiveRef.current) {
      stopCamera();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setRecognitionError(
        'Camera access is unavailable. Use HTTPS or localhost and a supported browser.',
      );
      return;
    }

    setRecognitionError('');
    setRecognitionStatus('Requesting camera permission…');

    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error('Camera preview is not ready.');
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      cameraActiveRef.current = true;
      setCameraActive(true);
      setRecognitionStatus(
        'Camera ready. Sign naturally, keeping your hands and upper body visible.',
      );

      triggerHaptic(HAPTIC_PATTERNS.SUCCESS);

      speakText(
        'Camera enabled. Show your signing clearly to the camera.',
        settings.uiLanguage,
        settings.voiceSpeed,
      );
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      cameraActiveRef.current = false;

      if (!mountedRef.current) return;

      setCameraActive(false);
      setRecognitionStatus('Camera unavailable.');
      setRecognitionError(
        error instanceof Error
          ? error.message
          : 'Could not start the camera. Check camera permissions.',
      );
    }
  };

  // Automatically start the camera when the sign-language module opens.
  useEffect(() => {
    let cancelled = false;

    const startCameraAutomatically = async () => {
      // Wait for React to attach the video element before requesting the camera.
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => resolve());
      });

      if (cancelled || !mountedRef.current) return;
      if (cameraActiveRef.current) return;

      await toggleCamera();
    };

    void startCameraAutomatically();

    return () => {
      cancelled = true;
    };
  }, []);

  const captureFrame = (): string | null => {
    const video = videoRef.current;

    if (
      !video ||
      video.readyState < 2 ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      return null;
    }

    const canvas = document.createElement('canvas');
    const maxWidth = 480;
    const scale = Math.min(1, maxWidth / video.videoWidth);

    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const context = canvas.getContext('2d');

    if (!context) return null;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.65);
  };

  const wait = (milliseconds: number) =>
    new Promise<void>(resolve => {
      window.setTimeout(resolve, milliseconds);
    });

  const analyzeSigningSequence = async () => {
    if (
      !cameraActiveRef.current ||
      recognitionRunningRef.current
    ) {
      return;
    }

    recognitionRunningRef.current = true;
    setRecognitionBusy(true);
    setRecognitionError('');
    setRecognitionStatus('Recording a short signing sequence…');

    try {
      const frames: string[] = [];

      for (let i = 0; i < FRAME_COUNT; i++) {
        if (!cameraActiveRef.current) break;

        const frame = captureFrame();

        if (frame) {
          frames.push(frame);
        }

        if (i < FRAME_COUNT - 1) {
          await wait(FRAME_INTERVAL_MS);
        }
      }

      if (!cameraActiveRef.current) {
        setRecognitionStatus('Camera stopped.');
        return;
      }

      if (frames.length < 2) {
        setRecognitionStatus(
          'Not enough usable frames. Keep your hands visible and try again.',
        );
        return;
      }

      setRecognitionStatus(
        `Analyzing ${frames.length} frames. This may take a few seconds…`,
      );

      const result = await recognizeISLSequence(
        frames,
        settings.uiLanguage === 'hi' ? 'Hindi' : 'English',
      );

      if (!mountedRef.current || !cameraActiveRef.current) return;

      setRecognizedGloss(result.gloss);
      setRecognitionConfidence(result.confidence);
      setRecognitionObservations(result.observations);
      setRecognitionUncertain(result.uncertain);

      if (result.recognizedText.trim()) {
        setRecognizedSentence(result.recognizedText.trim());
        setRecognitionStatus('Sign interpretation received.');
      } else {
        setRecognizedSentence('');
        setRecognitionStatus(
          'No text was returned by the recognition service. Try again with your hands clearly visible.',
        );
      }
    } catch (error) {
      console.error('ISL sequence recognition failed:', error);

      if (!mountedRef.current) return;

      setRecognitionError(
        error instanceof Error
          ? error.message
          : 'Could not analyze the signing sequence.',
      );

      setRecognitionStatus('Recognition unavailable.');
    } finally {
      recognitionRunningRef.current = false;

      if (mountedRef.current) {
        setRecognitionBusy(false);
      }
    }
  };


  // Automatically analyze signing periodically while the camera is active.
  // Each cycle captures several frames; the ref prevents overlapping runs.
  useEffect(() => {
    if (!cameraActive) return;

    const timer = window.setInterval(() => {
      if (
        cameraActiveRef.current &&
        !recognitionRunningRef.current
      ) {
        void analyzeSigningSequence();
      }
    }, 6000);

    return () => window.clearInterval(timer);
  }, [cameraActive, settings.uiLanguage]);

  const handleTranslateTextToSign = async () => {
    const sentence = inputText.trim();

    if (!sentence || isTranslating) return;

    setIsTranslating(true);
    setRecognitionError('');
    setTranslatedGloss([]);
    setGestureDetails([]);
    setTranslationExplanation('');
    setActiveGlossIndex(0);

    triggerHaptic(HAPTIC_PATTERNS.CLICK);

    try {
      const response = await translateToSignLanguage(
        sentence,
        'ISL',
      );

      if (!mountedRef.current) return;

      const gloss = Array.isArray(response.signGloss)
        ? response.signGloss.filter(
            token => typeof token === 'string' && token.trim(),
          )
        : [];

      const details = Array.isArray(response.gestureDetails)
        ? response.gestureDetails.filter(
            detail =>
              detail &&
              typeof detail.gloss === 'string',
          )
        : [];

      setTranslatedGloss(gloss);
      setGestureDetails(details);
      setTranslationExplanation(
        typeof response.simpleExplanation === 'string'
          ? response.simpleExplanation
          : '',
      );

      if (gloss.length > 0) {
        triggerHaptic(HAPTIC_PATTERNS.SUCCESS);
      } else {
        setRecognitionError(
          'The translation did not return a usable gloss sequence. Try rephrasing the sentence.',
        );
      }
    } catch (error) {
      console.error('Text-to-sign translation failed:', error);

      if (!mountedRef.current) return;

      setRecognitionError(
        error instanceof Error
          ? error.message
          : 'Text-to-sign translation failed.',
      );
    } finally {
      if (mountedRef.current) {
        setIsTranslating(false);
      }
    }
  };

  const selectGesture = (gesture: SignGesture) => {
    setDetectedSign(gesture);
    triggerHaptic(HAPTIC_PATTERNS.CLICK);

  };

  const speakRecognizedSentence = () => {
    const sentence = recognizedSentence.trim();
    if (!sentence) return;

    if (!('speechSynthesis' in window)) {
      setRecognitionStatus('Speech output is not supported by this browser.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = settings.uiLanguage === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = Math.min(2, Math.max(0.5, settings.voiceSpeed || 1));
    utterance.onerror = event => {
      console.error('ISL manual speech failed:', event.error);
      setRecognitionStatus(`Speech output failed: ${event.error}`);
    };
    window.speechSynthesis.speak(utterance);
  };

  const testVoiceOutput = () => {
    if (!('speechSynthesis' in window)) {
      setRecognitionStatus('Speech output is not supported by this browser.');
      return;
    }

    window.speechSynthesis.cancel();
    const testText = settings.uiLanguage === 'hi'
      ? 'साइन लैंग्वेज वॉइस असिस्टेंट काम कर रहा है।'
      : 'The sign language voice assistant is working.';
    const utterance = new SpeechSynthesisUtterance(testText);
    utterance.lang = settings.uiLanguage === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = Math.min(2, Math.max(0.5, settings.voiceSpeed || 1));
    utterance.onerror = event => {
      console.error('ISL test voice failed:', event.error);
      setRecognitionStatus(`Test voice failed: ${event.error}`);
    };
    window.speechSynthesis.speak(utterance);
  };

  const currentGloss =
    translatedGloss[activeGlossIndex] || 'SIGN READY';

  const currentGestureDetail =
    gestureDetails.find(
      detail =>
        detail.gloss.toLowerCase() ===
        currentGloss.toLowerCase(),
    ) || gestureDetails[activeGlossIndex];

  const resetTranslation = () => {
    setActiveGlossIndex(0);
    triggerHaptic(HAPTIC_PATTERNS.CLICK);
  };

  const moveGloss = (direction: -1 | 1) => {
    setActiveGlossIndex(index =>
      Math.max(
        0,
        Math.min(translatedGloss.length - 1, index + direction),
      ),
    );

    triggerHaptic(HAPTIC_PATTERNS.CLICK);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-800/50 border border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <Hand className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              ISL Communication
            </h2>
          </div>

          <p className="text-xs text-slate-300 mt-1">
            Experimental sequence interpretation and structured sign
            translation.
          </p>
        </div>

        <button
          type="button"
          onClick={toggleCamera}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border ${
            cameraActive
              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
              : 'bg-cyan-600 hover:bg-cyan-500 text-white border-transparent'
          }`}
        >
          {cameraActive ? (
            <CameraOff className="w-4 h-4" />
          ) : (
            <Camera className="w-4 h-4" />
          )}
          {cameraActive ? 'Stop Camera' : 'Start Camera'}
        </button>
      </header>

      {recognitionError && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-200"
        >
          {recognitionError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sign to text and speech */}
        <section className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Camera className="w-4 h-4 text-cyan-400" />
              Sign to Text & Speech
            </h3>
            <span className="text-[10px] text-amber-300">
              EXPERIMENTAL
            </span>
          </div>

          <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-slate-700 flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${
                cameraActive ? '-scale-x-100' : 'hidden'
              }`}
            />

            {!cameraActive && (
              <div className="p-6 text-center space-y-2">
                <Hand className="w-10 h-10 text-cyan-400 mx-auto" />
                <p className="text-sm font-bold text-white">
                  Camera standby
                </p>
                <p className="text-xs text-slate-400">
                  Start the camera to capture a signing sequence.
                </p>
              </div>
            )}

            {cameraActive && (
              <span className="absolute top-3 left-3 rounded-lg bg-slate-950/80 px-2 py-1 text-xs text-cyan-200">
                Live camera
              </span>
            )}
          </div>

          <div className="rounded-xl bg-slate-900 border border-slate-700 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-300">
              Recognition status
            </p>

            <p aria-live="polite" className="text-sm text-cyan-200">
              {recognitionStatus}
            </p>

            <div className="rounded-lg border border-cyan-500/30 bg-slate-950 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-300">
                Live Hand Gesture Model
              </p>

              <p aria-live="polite" className="text-sm text-cyan-200">
                {liveGestureStatus}
              </p>

              <p className="text-lg font-bold text-white">
                {liveGesture?.label ?? 'No gesture detected yet'}
              </p>

              {liveGesture && (
                <p className="text-xs text-slate-400">
                  Model confidence:{' '}
                  {(liveGesture.confidence * 100).toFixed(1)}%
                </p>
              )}

              <p className="text-xs text-slate-500">
                This detector recognizes a limited set of generic hand
                gestures; it is not a complete ISL sentence model.
              </p>
            </div>

            <button
              type="button"
              onClick={analyzeSigningSequence}
              disabled={!cameraActive || recognitionBusy}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold disabled:opacity-50"
            >
              {recognitionBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}

              {recognitionBusy
                ? 'Analyzing sequence…'
                : `Analyze ${FRAME_COUNT}-Frame Sequence`}
            </button>

            <div className="rounded-lg bg-slate-950 p-3 min-h-20">
              <p className="text-[10px] font-mono text-slate-400">
                INTERPRETED SENTENCE
              </p>

              <p className="mt-2 text-sm text-white whitespace-pre-wrap">
                {recognizedSentence ||
                  'Your interpreted text will appear here.'}
              </p>
            </div>

            {recognizedGloss.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-300">
                  Suggested gloss sequence
                </p>

                <div className="flex flex-wrap gap-2">
                  {recognizedGloss.map((token, index) => (
                    <span
                      key={`${token}-${index}`}
                      className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-cyan-200"
                    >
                      {token}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {recognitionObservations && (
              <div className="rounded-lg border border-slate-700 p-3">
                <p className="text-xs font-semibold text-slate-300">
                  Model observations
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {recognitionObservations}
                </p>
              </div>
            )}

            {recognizedSentence && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>
                    Model confidence: {(recognitionConfidence * 100).toFixed(0)}%
                  </span>
                  {recognitionUncertain && (
                    <span className="flex items-center gap-1 text-amber-300">
                      <AlertTriangle className="w-3 h-3" />
                      Uncertain
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={speakRecognizedSentence}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 text-white text-xs font-bold"
                  >
                    <Volume2 className="w-4 h-4" />
                    Speak interpreted text
                  </button>
                  <button
                    type="button"
                    onClick={testVoiceOutput}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                  >
                    <Volume2 className="w-4 h-4" />
                    Test voice
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-300">
              Example sign cards — manual selection only
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ESSENTIAL_GESTURES.map(gesture => (
                <button
                  type="button"
                  key={gesture.gloss}
                  onClick={() => selectGesture(gesture)}
                  className={`p-2 rounded-lg border text-left ${
                    detectedSign?.gloss === gesture.gloss
                      ? 'bg-cyan-950 border-cyan-400 text-cyan-200'
                      : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                >
                  <span className="text-xs font-bold block">
                    {gesture.gloss}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {gesture.meaning}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {detectedSign && (
            <div className="rounded-xl bg-slate-900 border border-slate-700 p-3 space-y-2">
              <p className="text-sm font-bold text-white">
                {detectedSign.gloss}
              </p>
              <p className="text-xs text-slate-300">
                {detectedSign.handshape}
              </p>
              <p className="text-xs text-slate-300">
                {detectedSign.movement}
              </p>
              <p className="text-xs text-slate-400">
                {detectedSign.facialExpression}
              </p>
              <button
                type="button"
                onClick={() =>
                  speakText(
                    settings.uiLanguage === 'hi'
                      ? detectedSign.meaningHindi
                      : detectedSign.meaning,
                    settings.uiLanguage,
                    settings.voiceSpeed,
                  )
                }
                className="flex items-center gap-2 text-xs text-cyan-300"
              >
                <Volume2 className="w-4 h-4" />
                Speak example
              </button>
            </div>
          )}
        </section>

        {/* Text to structured sign sequence */}
        <section className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-700 pb-3">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">
              Text to Sign Sequence
            </h3>
          </div>

          <label
            htmlFor="isl-input-text"
            className="text-xs font-semibold text-slate-300 block"
          >
            Enter a sentence
          </label>

          <textarea
            id="isl-input-text"
            value={inputText}
            onChange={event => setInputText(event.target.value)}
            rows={4}
            maxLength={MAX_SENTENCE_LENGTH}
            placeholder="Enter the sentence you want to communicate…"
            className="w-full px-3 py-3 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />

          <p className="text-right text-xs text-slate-500">
            {inputText.length}/{MAX_SENTENCE_LENGTH}
          </p>

          <button
            type="button"
            onClick={handleTranslateTextToSign}
            disabled={isTranslating || !inputText.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm disabled:opacity-50"
          >
            {isTranslating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}

            {isTranslating
              ? 'Creating sign sequence…'
              : 'Translate Sentence to Signs'}
          </button>

          <div className="rounded-xl bg-slate-950 border border-slate-700 p-4">
            <p className="text-[10px] font-mono text-cyan-300">
              CURRENT GLOSS TOKEN
            </p>

            <div className="text-xl font-extrabold text-white mt-2">
              {currentGloss}
            </div>

            <p className="text-xs text-slate-400 mt-2">
              Gloss is a written representation, not an animated sign.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-300">
                Gloss sequence
              </p>

              {translatedGloss.length > 0 && (
                <button
                  type="button"
                  onClick={resetTranslation}
                  className="flex items-center gap-1 text-xs text-cyan-300"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {translatedGloss.map((token, index) => (
                <button
                  type="button"
                  key={`${token}-${index}`}
                  onClick={() => {
                    setActiveGlossIndex(index);
                    triggerHaptic(HAPTIC_PATTERNS.CLICK);
                  }}
                  className={`px-3 py-2 rounded-lg border text-xs font-mono font-bold ${
                    activeGlossIndex === index
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                      : 'bg-slate-900 text-slate-300 border-slate-700'
                  }`}
                >
                  {token}
                </button>
              ))}
            </div>
          </div>

          {translatedGloss.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={activeGlossIndex === 0}
                onClick={() => moveGloss(-1)}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-slate-600 text-white text-xs disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <button
                type="button"
                disabled={activeGlossIndex >= translatedGloss.length - 1}
                onClick={() => moveGloss(1)}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-slate-600 text-white text-xs disabled:opacity-40"
              >
                Next sign
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {currentGestureDetail && (
            <div className="rounded-xl border border-cyan-500/30 bg-slate-950 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-cyan-200">
                  {currentGestureDetail.gloss}
                </p>
                <span className="text-xs text-slate-400">
                  {currentGestureDetail.durationMs > 0
                    ? `${currentGestureDetail.durationMs} ms`
                    : 'Timing unspecified'}
                </span>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-300">
                  Handshape
                </p>
                <p className="text-sm text-slate-400">
                  {currentGestureDetail.handshape || 'Not specified'}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-300">
                  Movement
                </p>
                <p className="text-sm text-slate-400">
                  {currentGestureDetail.movement || 'Not specified'}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-300">
                  Facial expression
                </p>
                <p className="text-sm text-slate-400">
                  {currentGestureDetail.facialExpression || 'Not specified'}
                </p>
              </div>

              <p className="text-xs text-amber-200/90">
                These details are AI-generated descriptions. Verify them
                with an ISL-fluent reviewer before relying on them.
              </p>
            </div>
          )}

          {translationExplanation && (
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
              <p className="text-xs font-semibold text-slate-300">
                Translation notes
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {translationExplanation}
              </p>
            </div>
          )}

          {translatedGloss.length > 0 && (
            <button
              type="button"
              onClick={() =>
                speakText(
                  inputText,
                  settings.uiLanguage,
                  settings.voiceSpeed,
                )
              }
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 text-white text-xs font-bold"
            >
              <Play className="w-4 h-4" />
              Speak original sentence
            </button>
          )}

          <p className="text-xs text-amber-200/90">
            A gloss sequence is not a complete ISL translation or a
            signing avatar. Real signing output requires verified
            demonstrations or a trained, validated avatar model.
          </p>
        </section>
      </div>

      <AccessibleTalk />
    </div>
  );
};
