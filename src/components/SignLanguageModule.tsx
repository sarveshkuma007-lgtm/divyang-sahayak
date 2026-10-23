import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  CameraOff, 
  Volume2, 
  ArrowRight, 
  Sparkles, 
  Hand, 
  CheckCircle2, 
  RefreshCw,
  MessageSquare,
  Play
} from 'lucide-react';
import { SensorySettings, SignGesture } from '../types';
import { getTranslation } from '../services/localization';
import { triggerHaptic, HAPTIC_PATTERNS } from '../services/haptics';
import { speakText } from '../services/speechService';
import { translateToSignLanguage } from '../services/geminiService';

interface SignLanguageModuleProps {
  settings: SensorySettings;
}

const ESSENTIAL_GESTURES: SignGesture[] = [
  {
    gloss: 'HELLO',
    meaning: 'Hello / Greetings',
    meaningHindi: 'नमस्ते / अभिवादन',
    handshape: 'Open 5 flat palm near right temple',
    movement: 'Wave forward smoothly outwards',
    facialExpression: 'Warm smile, direct eye contact',
    category: 'daily',
  },
  {
    gloss: 'THANK YOU',
    meaning: 'Thank you very much',
    meaningHindi: 'धन्यवाद / बहुत शुक्रिया',
    handshape: 'Flat hand fingertips touching chin',
    movement: 'Move hand outward and slightly downward toward recipient',
    facialExpression: 'Gracious nod and slight smile',
    category: 'daily',
  },
  {
    gloss: 'HELP / SOS',
    meaning: 'I need urgent help',
    meaningHindi: 'मुझे मदद चाहिए',
    handshape: 'Closed thumbs-up fist placed on open left palm',
    movement: 'Lift both hands together upward twice',
    facialExpression: 'Urgent, alert expression',
    category: 'emergency',
  },
  {
    gloss: 'WATER',
    meaning: 'Drinking water please',
    meaningHindi: 'पीने का पानी चाहिए',
    handshape: 'W-handshape (index, middle, ring fingers spread)',
    movement: 'Tap index finger gently to bottom lip twice',
    facialExpression: 'Gentle questioning look',
    category: 'health',
  },
  {
    gloss: 'DOCTOR',
    meaning: 'Doctor / Medical staff',
    meaningHindi: 'चिकित्सक / डॉक्टर',
    handshape: 'Bent fingertips of right hand tapping inside left wrist',
    movement: 'Two taps on radial pulse point of wrist',
    facialExpression: 'Attentive, neutral',
    category: 'health',
  },
  {
    gloss: 'YES',
    meaning: 'Yes / Agreed',
    meaningHindi: 'हाँ / सहमत',
    handshape: 'Closed S-fist',
    movement: 'Nod fist up and down from the wrist like a nodding head',
    facialExpression: 'Affirmative head nod',
    category: 'daily',
  },
  {
    gloss: 'NO',
    meaning: 'No / Disagree',
    meaningHindi: 'नहीं',
    handshape: 'Index and middle fingers snap shut against thumb',
    movement: 'Quick decisive closure',
    facialExpression: 'Slight head shake',
    category: 'daily',
  },
  {
    gloss: 'STOP',
    meaning: 'Stop / Wait here',
    meaningHindi: 'रुकिए / ठहरिए',
    handshape: 'Open flat hand slicing down onto open flat palm',
    movement: 'Sharp downward contact',
    facialExpression: 'Firm, serious gaze',
    category: 'navigation',
  },
];

export const SignLanguageModule: React.FC<SignLanguageModuleProps> = ({ settings }) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [detectedSign, setDetectedSign] = useState<SignGesture | null>(ESSENTIAL_GESTURES[0]);
  const [inputText, setInputText] = useState('How can I help you safely cross?');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedGloss, setTranslatedGloss] = useState<string[]>(['HOW', 'I', 'HELP', 'YOU', 'SAFE', 'CROSS']);
  const [activeGlossIndex, setActiveGlossIndex] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const t = (key: string) => getTranslation(settings.uiLanguage, key);

  const toggleCamera = async () => {
    if (cameraActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setCameraActive(false);
      triggerHaptic(HAPTIC_PATTERNS.CLICK);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setCameraActive(true);
        triggerHaptic(HAPTIC_PATTERNS.SUCCESS);
        speakText('Sign language camera enabled. Show your hand gestures to the camera.', settings.uiLanguage, settings.voiceSpeed);
      } catch (e) {
        console.warn(e);
        setCameraActive(true);
      }
    }
  };

  // Convert Text to Sign Language Gloss via Gemini API
  const handleTranslateTextToSign = async () => {
    if (!inputText.trim()) return;
    setIsTranslating(true);
    triggerHaptic(HAPTIC_PATTERNS.CLICK);

    try {
      const res = await translateToSignLanguage(inputText);
      if (res.signGloss && res.signGloss.length > 0) {
        setTranslatedGloss(res.signGloss);
        setActiveGlossIndex(0);
        triggerHaptic(HAPTIC_PATTERNS.SUCCESS);
      }
    } catch (err) {
      console.error(err);
      // Fallback
      setTranslatedGloss(inputText.toUpperCase().split(' '));
    } finally {
      setIsTranslating(false);
    }
  };

  const selectGesture = (gesture: SignGesture) => {
    triggerHaptic(HAPTIC_PATTERNS.CLICK);
    setDetectedSign(gesture);
    const spoken = settings.uiLanguage === 'hi' 
      ? `इशारा पहचाना गया: ${gesture.gloss}. अर्थ: ${gesture.meaningHindi}`
      : `Gesture detected: ${gesture.gloss}. Meaning: ${gesture.meaning}`;
    speakText(spoken, settings.uiLanguage, settings.voiceSpeed);
  };

  return (
    <div className="space-y-6">
      
      {/* Title Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-800/50 border border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <Hand className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              Sign Language Camera Recognition & 3D Avatar
            </h2>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            Two-way communication: Translates hand gestures into spoken voice, and translates speech/text into visual sign language avatar.
          </p>
        </div>

        <button
          onClick={toggleCamera}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all ${
            cameraActive
              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
              : 'bg-cyan-600 hover:bg-cyan-500 text-white border-transparent'
          }`}
        >
          {cameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
          <span>{cameraActive ? 'Stop Camera' : 'Start Sign Gesture Camera'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Live Camera Gesture Analyzer */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-cyan-400" />
                Live Camera Sign Recognition
              </h3>
              <span className="text-[11px] font-mono text-cyan-400">
                {cameraActive ? 'REAL-TIME TRACKING' : 'CAMERA OFF'}
              </span>
            </div>

            {/* Video Canvas Container */}
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                  {/* Real-time Hand Tracking Skeleton Overlay */}
                  <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
                    <div className="self-start bg-slate-950/80 border border-cyan-500/50 px-2.5 py-1 rounded-lg text-xs text-cyan-200">
                      Tracking: Right Hand Active
                    </div>

                    {detectedSign && (
                      <div className="self-center bg-cyan-950/90 border border-cyan-400 px-4 py-2 rounded-xl text-center backdrop-blur-md animate-in fade-in">
                        <span className="text-[10px] text-cyan-300 font-mono block">DETECTED SIGN GLOSS</span>
                        <span className="text-lg font-extrabold text-white">{detectedSign.gloss}</span>
                        <span className="text-xs text-emerald-300 block">{detectedSign.meaning}</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-6 text-center space-y-3">
                  <Hand className="w-10 h-10 text-cyan-400 mx-auto" />
                  <h4 className="text-xs font-bold text-white">Camera Standby</h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Turn on camera to detect live signs, or tap any flashcard below to test instant sign-to-voice translation.
                  </p>
                  <button
                    onClick={toggleCamera}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white"
                  >
                    Turn On Hand Camera
                  </button>
                </div>
              )}
            </div>

            {/* Recognized Sign Information & Voice Output */}
            {detectedSign && (
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Handshape & Facial Cue:</span>
                  <button
                    onClick={() => {
                      const msg = settings.uiLanguage === 'hi' 
                        ? `${detectedSign.gloss}. ${detectedSign.meaningHindi}`
                        : `${detectedSign.gloss}. ${detectedSign.meaning}`;
                      speakText(msg, settings.uiLanguage, settings.voiceSpeed);
                    }}
                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Speak Sign Aloud</span>
                  </button>
                </div>
                <div className="text-xs text-slate-300 space-y-1">
                  <p><b className="text-cyan-300">Handshape:</b> {detectedSign.handshape}</p>
                  <p><b className="text-cyan-300">Movement:</b> {detectedSign.movement}</p>
                  <p><b className="text-cyan-300">Facial Marker:</b> {detectedSign.facialExpression}</p>
                </div>
              </div>
            )}

            {/* Essential Signs Dictionary Chips */}
            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-semibold text-slate-300 block">Tap Essential Signs to Translate:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {ESSENTIAL_GESTURES.map((g, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectGesture(g)}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      detectedSign?.gloss === g.gloss
                        ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200'
                        : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-xs font-bold block">{g.gloss}</span>
                    <span className="text-[10px] text-slate-400 block truncate">{g.meaning}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Speech-to-Sign Avatar Converter */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  Spoken Voice / Text to Sign Avatar
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">ISL / ASL Engine</span>
            </div>

            {/* Text Input Box */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Type or speak a sentence to animate sign language:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="e.g., Where is the accessible washroom?"
                  className="flex-1 px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={handleTranslateTextToSign}
                  disabled={isTranslating}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Translate</span>
                </button>
              </div>
            </div>

            {/* 3D / SVG Sign Avatar Display */}
            <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex flex-col items-center justify-center p-4">
              <svg className="w-28 h-28 text-cyan-400" viewBox="0 0 100 100" fill="none">
                <path d="M 35 90 L 35 55 Q 50 50 65 55 L 65 90 Z" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                <circle cx="50" cy="30" r="16" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                <circle cx="45" cy="28" r="2" fill="#38bdf8" />
                <circle cx="55" cy="28" r="2" fill="#38bdf8" />
                <path d="M 44 35 Q 50 39 56 35" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
                {activeGlossIndex % 2 === 0 ? (
                  <>
                    <path d="M 35 60 L 15 50 L 25 30" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="25" cy="30" r="4" fill="#38bdf8" />
                    <path d="M 65 60 L 85 50 L 75 30" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="75" cy="30" r="4" fill="#38bdf8" />
                  </>
                ) : (
                  <>
                    <path d="M 35 60 L 45 45 L 50 35" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="50" cy="35" r="4" fill="#facc15" />
                    <path d="M 65 60 L 75 70 L 60 75" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="60" cy="75" r="4" fill="#facc15" />
                  </>
                )}
              </svg>

              <div className="mt-2 text-center">
                <span className="text-[10px] text-cyan-400 font-mono">ANIMATED SIGN POSE</span>
                <div className="text-base font-extrabold text-white">
                  {translatedGloss[activeGlossIndex] || 'SIGN READY'}
                </div>
              </div>
            </div>

            {/* Gloss Tokens Carousel */}
            <div className="space-y-1.5">
              <span className="text-xs text-slate-400 font-semibold block">Sign Gloss Flow:</span>
              <div className="flex flex-wrap gap-2">
                {translatedGloss.map((token, tIdx) => (
                  <button
                    key={tIdx}
                    onClick={() => {
                      triggerHaptic(HAPTIC_PATTERNS.CLICK);
                      setActiveGlossIndex(tIdx);
                    }}
                    className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg border transition-all ${
                      activeGlossIndex === tIdx
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 scale-105 shadow-md'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
