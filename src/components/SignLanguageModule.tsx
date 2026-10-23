
import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  CameraOff,
  Volume2,
  Sparkles,
  Hand,
  RefreshCw,
  MessageSquare,
  Play,
  Loader2
} from 'lucide-react';

import { SensorySettings, SignGesture } from '../types';
import { getTranslation } from '../services/localization';
import { triggerHaptic, HAPTIC_PATTERNS } from '../services/haptics';
import { speakText } from '../services/speechService';
import { translateToSignLanguage } from '../services/geminiService';
import { recognizeISLSequence } from '../services/islSequenceService';
import AccessibleTalk from './AccessibleTalk';

interface SignLanguageModuleProps {
  settings: SensorySettings;
}

const ESSENTIAL_GESTURES: SignGesture[] = [
  {
    gloss: 'HELLO',
    meaning: 'Hello / Greetings',
    meaningHindi: 'नमस्ते / अभिवादन',
    handshape: 'Open flat palm',
    movement: 'Wave gently',
    facialExpression: 'Friendly expression',
    category: 'daily'
  },
  {
    gloss: 'THANK YOU',
    meaning: 'Thank you',
    meaningHindi: 'धन्यवाद',
    handshape: 'Flat hand',
    movement: 'Move hand outward',
    facialExpression: 'Gentle smile',
    category: 'daily'
  },
  {
    gloss: 'HELP',
    meaning: 'I need help',
    meaningHindi: 'मुझे मदद चाहिए',
    handshape: 'Hand configuration varies by sign',
    movement: 'Refer to a verified ISL demonstration',
    facialExpression: 'Urgent expression when appropriate',
    category: 'emergency'
  },
  {
    gloss: 'WATER',
    meaning: 'Water',
    meaningHindi: 'पानी',
    handshape: 'Refer to verified ISL dictionary',
    movement: 'Refer to verified ISL demonstration',
    facialExpression: 'Context dependent',
    category: 'health'
  },
  {
    gloss: 'DOCTOR',
    meaning: 'Doctor',
    meaningHindi: 'डॉक्टर',
    handshape: 'Refer to verified ISL dictionary',
    movement: 'Refer to verified ISL demonstration',
    facialExpression: 'Context dependent',
    category: 'health'
  },
  {
    gloss: 'YES',
    meaning: 'Yes',
    meaningHindi: 'हाँ',
    handshape: 'Refer to verified ISL dictionary',
    movement: 'Refer to verified ISL demonstration',
    facialExpression: 'Context dependent',
    category: 'daily'
  },
  {
    gloss: 'NO',
    meaning: 'No',
    meaningHindi: 'नहीं',
    handshape: 'Refer to verified ISL dictionary',
    movement: 'Refer to verified ISL demonstration',
    facialExpression: 'Context dependent',
    category: 'daily'
  },
  {
    gloss: 'STOP',
    meaning: 'Stop',
    meaningHindi: 'रुकिए',
    handshape: 'Refer to verified ISL dictionary',
    movement: 'Refer to verified ISL demonstration',
    facialExpression: 'Context dependent',
    category: 'navigation'
  }
];

export const SignLanguageModule: React.FC<SignLanguageModuleProps> = ({
  settings
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [detectedSign, setDetectedSign] =
    useState<SignGesture | null>(null);

  const [inputText, setInputText] = useState(
    'How can I help you safely cross?'
  );

  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedGloss, setTranslatedGloss] = useState<string[]>([]);
  const [activeGlossIndex, setActiveGlossIndex] = useState(0);

  const [recognizedSentence, setRecognizedSentence] = useState('');
  const [recognitionStatus, setRecognitionStatus] =
    useState('Camera off');
  const [recognitionBusy, setRecognitionBusy] = useState(false);
  const [recognitionError, setRecognitionError] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRunningRef = useRef(false);
  const cameraActiveRef = useRef(false);

  const t = (key: string) => getTranslation(settings.uiLanguage, key);

  useEffect(() => {
    cameraActiveRef.current = cameraActive;
  }, [cameraActive]);

  useEffect(() => {
    return () => {
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
    if (cameraActive) {
      stopCamera();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setRecognitionError(
        'Camera access is unavailable. Use HTTPS or localhost and a supported browser.'
      );
      return;
    }

    setRecognitionError('');
    setRecognitionStatus('Requesting camera permission…');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      cameraActiveRef.current = true;
      setCameraActive(true);
      setRecognitionStatus(
        'Camera ready. Keep your hands visible and analyze a signing sequence.'
      );

      triggerHaptic(HAPTIC_PATTERNS.SUCCESS);

      speakText(
        'Camera enabled. Show your signing clearly to the camera.',
        settings.uiLanguage,
        settings.voiceSpeed
      );
    } catch (error) {
      console.error('Camera initialization failed:', error);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      setCameraActive(false);
      cameraActiveRef.current = false;
      setRecognitionStatus('Camera unavailable.');

      setRecognitionError(
        error instanceof Error
          ? error.message
          : 'Could not start the camera. Check camera permissions.'
      );
    }
  };

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
    setRecognitionStatus('Capturing signing sequence…');

    try {
      const frames: string[] = [];

      // Capture several frames so the API can inspect changes over time.
      for (let i = 0; i < 5; i++) {
        if (!cameraActiveRef.current) break;

        const frame = captureFrame();

        if (frame) frames.push(frame);

        if (i < 4) {
          await new Promise<void>(resolve => {
            window.setTimeout(resolve, 300);
          });
        }
      }

      if (!cameraActiveRef.current) {
        setRecognitionStatus('Camera stopped.');
        return;
      }

      if (frames.length < 2) {
        setRecognitionStatus(
          'Not enough camera frames. Keep the camera running and try again.'
        );
        return;
      }

      setRecognitionStatus('Analyzing frames…');

      const result = await recognizeISLSequence(
        frames,
        settings.uiLanguage === 'hi' ? 'Hindi' : 'English'
      );

      if (!cameraActiveRef.current) return;

      if (result.recognizedText.trim()) {
        setRecognizedSentence(result.recognizedText.trim());
        // Speak the interpreted sentence automatically; keep the manual button too.
        speakText(
          result.recognizedText.trim(),
          settings.uiLanguage,
          settings.voiceSpeed
        );

        setRecognitionStatus(
          result.uncertain
            ? 'Possible interpretation — please verify.'
            : 'Interpretation received. Verify its accuracy.'
        );
      } else {
        setRecognitionStatus(
          'The sequence was unclear. Try again with both hands visible and good lighting.'
        );
      }
    } catch (error) {
      console.error('ISL sequence recognition failed:', error);

      setRecognitionError(
        error instanceof Error
          ? error.message
          : 'Could not analyze the signing sequence.'
      );

      setRecognitionStatus('Recognition unavailable.');
    } finally {
      recognitionRunningRef.current = false;
      setRecognitionBusy(false);
    }
  };

  const handleTranslateTextToSign = async () => {
    if (!inputText.trim() || isTranslating) return;

    setIsTranslating(true);
    setRecognitionError('');
    triggerHaptic(HAPTIC_PATTERNS.CLICK);

    try {
      const response = await translateToSignLanguage(inputText);

      if (response.signGloss?.length) {
        setTranslatedGloss(response.signGloss);
        setActiveGlossIndex(0);
        triggerHaptic(HAPTIC_PATTERNS.SUCCESS);
      } else {
        setTranslatedGloss([]);
      }
    } catch (error) {
      console.error('Text-to-sign translation failed:', error);

      setRecognitionError(
        error instanceof Error
          ? error.message
          : 'Text-to-sign translation failed.'
      );
    } finally {
      setIsTranslating(false);
    }
  };

  const selectGesture = (gesture: SignGesture) => {
    setDetectedSign(gesture);
    triggerHaptic(HAPTIC_PATTERNS.CLICK);

    const message =
      settings.uiLanguage === 'hi'
        ? `${gesture.gloss}. ${gesture.meaningHindi}`
        : `${gesture.gloss}. ${gesture.meaning}`;

    speakText(
      message,
      settings.uiLanguage,
      settings.voiceSpeed
    );
  };

  const speakRecognizedSentence = () => {
    if (!recognizedSentence.trim()) return;

    speakText(
      recognizedSentence,
      settings.uiLanguage,
      settings.voiceSpeed
    );
  };

  const currentGloss =
    translatedGloss[activeGlossIndex] || 'SIGN READY';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-800/50 border border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <Hand className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              ISL Communication
            </h2>
          </div>

          <p className="text-xs text-slate-300 mt-1">
            Experimental camera sequence analysis and text-to-gloss support.
            This is not yet validated continuous ISL translation.
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
      </div>

      {recognitionError && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-200"
        >
          {recognitionError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sign to text */}
        <section className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Camera className="w-4 h-4 text-cyan-400" />
              Sign to Text
            </h3>

            <span className="text-[10px] text-cyan-300">
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
                  Start the camera before analyzing a signing sequence.
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
                : 'Analyze Signing Sequence'}
            </button>

            <div className="rounded-lg bg-slate-950 p-3 min-h-20">
              <p className="text-[10px] font-mono text-slate-400">
                INTERPRETED SENTENCE
              </p>

              <p className="mt-2 text-sm text-white">
                {recognizedSentence ||
                  'Your interpreted text will appear here.'}
              </p>
            </div>

            <button
              type="button"
              onClick={speakRecognizedSentence}
              disabled={!recognizedSentence}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 text-white text-xs font-bold disabled:opacity-50"
            >
              <Volume2 className="w-4 h-4" />
              Speak interpreted text
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-300">
              Example sign cards — for manual testing only
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

              <button
                type="button"
                onClick={() => {
                  speakText(
                    settings.uiLanguage === 'hi'
                      ? detectedSign.meaningHindi
                      : detectedSign.meaning,
                    settings.uiLanguage,
                    settings.voiceSpeed
                  );
                }}
                className="flex items-center gap-2 text-xs text-cyan-300"
              >
                <Volume2 className="w-4 h-4" />
                Speak example
              </button>
            </div>
          )}
        </section>

        {/* Text to sign */}
        <section className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-700 pb-3">
            <MessageSquare className="w-4 h-4 text-cyan-400" />

            <h3 className="text-sm font-bold text-white">
              Text to Sign Gloss
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
            rows={3}
            maxLength={1000}
            placeholder="Enter the sentence you want to communicate…"
            className="w-full px-3 py-3 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />

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
              ? 'Translating…'
              : 'Translate to Sign Gloss'}
          </button>

          <div className="rounded-xl bg-slate-950 border border-slate-700 p-4">
            <p className="text-[10px] font-mono text-cyan-300">
              CURRENT GLOSS TOKEN
            </p>

            <div className="text-xl font-extrabold text-white mt-2">
              {currentGloss}
            </div>

            <p className="text-xs text-slate-400 mt-2">
              This is a gloss preview, not a real sign animation.
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
                  onClick={() => {
                    setActiveGlossIndex(0);
                    triggerHaptic(HAPTIC_PATTERNS.CLICK);
                  }}
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
                onClick={() =>
                  setActiveGlossIndex(index => Math.max(0, index - 1))
                }
                className="flex-1 px-3 py-2 rounded-lg border border-slate-600 text-white text-xs disabled:opacity-40"
              >
                Previous
              </button>

              <button
                type="button"
                disabled={activeGlossIndex >= translatedGloss.length - 1}
                onClick={() =>
                  setActiveGlossIndex(index =>
                    Math.min(translatedGloss.length - 1, index + 1)
                  )
                }
                className="flex-1 px-3 py-2 rounded-lg border border-slate-600 text-white text-xs disabled:opacity-40"
              >
                Next sign
              </button>
            </div>
          )}

          <p className="text-xs text-amber-200/90">
            For accessibility use, verify translations with an ISL-fluent
            reviewer. Actual sign demonstrations require verified video
            assets or a trained signing avatar.
          </p>
        </section>
      </div>

      {/* Accessible conversation for people who do not know sign language */}
      <AccessibleTalk />
    </div>
  );
};
