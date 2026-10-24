
import React, { useState, useRef, useEffect } from 'react';
import { 
  Banknote, 
  Camera, 
  CameraOff, 
  Volume2, 
  Vibrate, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  Zap
} from 'lucide-react';
import { SensorySettings, DetectedCurrency } from '../types';
import { getTranslation } from '../services/localization';
import { triggerHaptic, HAPTIC_PATTERNS } from '../services/haptics';
import { speakText } from '../services/speechService';
import { analyzeSceneVision } from '../services/geminiService';

interface CurrencyDetectorModuleProps {
  settings: SensorySettings;
}

const SAMPLE_NOTES = [
  {
    denomination: 'â‚¹500 (Five Hundred Indian Rupees)',
    denominationHindi: 'à¤ªà¤¾à¤à¤š à¤¸à¥Œ à¤°à¥à¤ªà¤¯à¥‡ à¤•à¤¾ à¤¨à¤¯à¤¾ à¤¨à¥‹à¤Ÿ',
    color: 'Stone Gray',
    features: 'Red Fort motif on reverse, Swachh Bharat logo, Bleed lines on edge for tactile feel.',
  },
  {
    denomination: 'â‚¹200 (Two Hundred Indian Rupees)',
    denominationHindi: 'à¤¦à¥‹ à¤¸à¥Œ à¤°à¥à¤ªà¤¯à¥‡ à¤•à¤¾ à¤¨à¥‹à¤Ÿ',
    color: 'Bright Yellow',
    features: 'Sanchi Stupa motif, H-symbol tactile mark for visually impaired.',
  },
  {
    denomination: 'â‚¹100 (One Hundred Indian Rupees)',
    denominationHindi: 'à¤à¤• à¤¸à¥Œ à¤°à¥à¤ªà¤¯à¥‡ à¤•à¤¾ à¤¨à¥‹à¤Ÿ',
    color: 'Lavender',
    features: 'Rani ki Vav motif, 4 bleed lines on both edges for tactile identification.',
  },
  {
    denomination: 'â‚¹50 (Fifty Indian Rupees)',
    denominationHindi: 'à¤ªà¤šà¤¾à¤¸ à¤°à¥à¤ªà¤¯à¥‡ à¤•à¤¾ à¤¨à¥‹à¤Ÿ',
    color: 'Fluorescent Blue',
    features: 'Hampi with Chariot motif, Ashoka Pillar emblem on right.',
  },
  {
    denomination: '$20 (Twenty US Dollars)',
    denominationHindi: 'à¤¬à¥€à¤¸ à¤…à¤®à¥‡à¤°à¤¿à¤•à¥€ à¤¡à¥‰à¤²à¤°',
    color: 'Green / Peach',
    features: 'Andrew Jackson portrait, metallic green 20 in lower right.',
  },
];

export const CurrencyDetectorModule: React.FC<CurrencyDetectorModuleProps> = ({ settings }) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  // Start with no result. Never show a denomination until a frame was analyzed
  // or the user explicitly chooses a demo banknote.
  const [detectedNote, setDetectedNote] = useState<DetectedCurrency>({
    found: false,
    denomination: '',
    confidence: 0,
    noteCondition: '',
  });
  const [statusMessage, setStatusMessage] = useState('Camera is off. Start the camera or choose a demo banknote.');
  const [isDemoResult, setIsDemoResult] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const t = (key: string) => getTranslation(settings.uiLanguage, key);

  // The video element only exists after cameraActive becomes true.
  // Attach the stream in an effect after React has mounted that element.
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraActive || !video || !stream) return;

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    video.play().catch((err) => {
      console.warn('Could not start camera preview:', err);
      setStatusMessage('Camera permission is granted, but the preview could not start. Close and reopen the camera.');
    });

    return () => {
      // Do not stop tracks here; toggleCamera handles the stream lifecycle.
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [cameraActive]);

  const toggleCamera = async () => {
    if (cameraActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setCameraActive(false);
      setDetectedNote({ found: false, denomination: '', confidence: 0, noteCondition: '' });
      setIsDemoResult(false);
      setStatusMessage('Camera is off. Start the camera or choose a demo banknote.');
      triggerHaptic(HAPTIC_PATTERNS.CLICK);
    } else {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setStatusMessage('Camera is not available in this browser. Use HTTPS or localhost and try again.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        streamRef.current = stream;
        // This causes React to render the <video>; useEffect attaches the stream.
        setCameraActive(true);
        setStatusMessage('Camera ready. Place one banknote inside the frame, then select Analyze.');
        setDetectedNote({ found: false, denomination: '', confidence: 0, noteCondition: '' });
        setIsDemoResult(false);
        triggerHaptic(HAPTIC_PATTERNS.SUCCESS);
        speakText('Currency camera ready. Hold one banknote in front of the lens, then analyze it.', settings.uiLanguage, settings.voiceSpeed);
      } catch (err) {
        console.warn('Camera stream error', err);
        setCameraActive(false);
        setStatusMessage('Could not open camera. Allow camera permission in your browser and try again.');
      }
    }
  };

  const scanLiveFrame = async () => {
    if (!cameraActive || !videoRef.current || !canvasRef.current || !streamRef.current) {
      setStatusMessage('Camera is off. Start the camera before analyzing a physical banknote.');
      speakText(
        settings.uiLanguage === 'hi' ? 'पहले कैमरा चालू करें।' : 'Please start the camera before analyzing a physical banknote.',
        settings.uiLanguage,
        settings.voiceSpeed
      );
      return;
    }

    if (videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      setStatusMessage('Waiting for camera video. Keep the camera open and try again in a moment.');
      return;
    }

    setAnalyzing(true);
    setStatusMessage('Analyzing the current camera frame…');
    triggerHaptic(HAPTIC_PATTERNS.CLICK);

    let base64Image = '';
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      base64Image = canvas.toDataURL('image/jpeg', 0.85);
    }

    try {
      if (base64Image) {
        const res = await analyzeSceneVision(base64Image, 'currency', settings.uiLanguage=== 'hi' ? 'Hindi' : 'English');
        if (res.detectedCurrency && res.detectedCurrency.found && res.detectedCurrency.denomination) {
          setDetectedNote(res.detectedCurrency);
          setIsDemoResult(false);
          setStatusMessage('Analysis returned a possible denomination. Verify it manually; this is not an authenticity guarantee.');
          triggerHaptic(HAPTIC_PATTERNS.CURRENCY_DETECTED);
          const speech = settings.uiLanguage === 'hi' 
            ? `${res.detectedCurrency.denomination} à¤ªà¤¹à¤šà¤¾à¤¨à¤¾ à¤—à¤¯à¤¾à¥¤`
            : `${res.detectedCurrency.denomination} detected.`;
          speakText(speech, settings.uiLanguage, settings.voiceSpeed);
        } else {
          setDetectedNote({ found: false, denomination: '', confidence: 0, noteCondition: '' });
          setIsDemoResult(false);
          setStatusMessage('No clear banknote was detected. Improve lighting, hold the note steady, and try again.');
          speakText(
            settings.uiLanguage === 'hi'
              ? 'कोई नोट स्पष्ट नहीं दिखा। रोशनी सुधारें और फिर कोशिश करें।'
              : 'No banknote was clearly detected. Improve lighting and try again.',
            settings.uiLanguage,
            settings.voiceSpeed
          );
        }
      } else {
        setStatusMessage('Could not capture a camera frame. Please try again.');
      }
    } catch (e) {
      console.error('Currency analysis failed:', e);
      setStatusMessage('Analysis failed. Check your connection and vision service configuration, then try again.');
      speakText(
        settings.uiLanguage === 'hi' ? 'विश्लेषण नहीं हो पाया। कृपया फिर कोशिश करें।' : 'Analysis failed. Please try again.',
        settings.uiLanguage,
        settings.voiceSpeed
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const selectSampleNote = (note: typeof SAMPLE_NOTES[0]) => {
    setIsDemoResult(true);
    setStatusMessage('Demo result only. This is a sample announcement, not a camera detection.');
    setDetectedNote({
      found: true,
      denomination: note.denomination,
      confidence: 0,
      noteCondition: note.features,
    });
    const speech = settings.uiLanguage === 'hi' 
      ? `${note.denominationHindi} à¤ªà¤¹à¤šà¤¾à¤¨à¤¾ à¤—à¤¯à¤¾à¥¤ ${note.features}`
      : `${note.denomination} detected. ${note.features}`;
    speakText(speech, settings.uiLanguage, settings.voiceSpeed);
  };

  return (
    <div className="space-y-6">
      
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-800/50 border border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              Instant Currency & Banknote Detector
            </h2>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            Designed for visually impaired users. Point camera at any banknote for instant voice readout and tactile vibration confirmation.
          </p>
        </div>

        <button
          onClick={toggleCamera}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all ${
            cameraActive
              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent'
          }`}
        >
          {cameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4"/>}
          <span>{cameraActive ? 'Close Camera' : 'Open Currency Camera'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Camera Viewport */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Banknote Alignment Target Outline */}
                <div className="absolute inset-0 pointer-events-none p-6 flex items-center justify-center">
                  <div className="w-4/5 h-3/5 rounded-2xl border-2 border-dashed border-emerald-400/90 flex flex-col items-center justify-between p-3 bg-emerald-950/20 backdrop-blur-[1px]">
                    <span className="text-[11px] font-mono text-emerald-300 bg-slate-950/80 px-2 py-0.5 rounded">
                      PLACE BANKNOTE WITHIN FRAME
                    </span>
                    <span className="text-[10px] text-white bg-slate-900/80 px-2 py-0.5 rounded">
                      Detects â‚¹10, â‚¹20, â‚¹50, â‚¹100, â‚¹200, â‚¹500, USD
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                  <Banknote className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-white">Live Camera Inactive</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Activate the camera to scan physical banknotes with your phone, or select any denomination below to test instant voice readout.
                </p>
                <button
                  onClick={toggleCamera}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Start Camera Feed
                </button>
              </div>
            )}
          </div>

          {/* Action Trigger */}
          <button
            onClick={scanLiveFrame}
            disabled={analyzing || !cameraActive}
            className="w-full py-3 px-4 text-xs sm:text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
          >
            <Zap className="w-4 h-4 fill-slate-950" />
            <span>{analyzing ? 'Recognizing Banknote...' : 'Analyze Currency Note Now'}</span>
          </button>
        </div>

        {/* Right Column: Result Card & Quick Test Samples */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Detected Note Presentation Card */}
          <div className="p-5 rounded-2xl bg-slate-800/60 border border-emerald-500/40 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <span className={`text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 ${detectedNote.found ? 'text-emerald-400' : 'text-amber-300'}`}>
                {detectedNote.found ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {isDemoResult ? 'Demo Result' : detectedNote.found ? 'Possible Detection' : 'No Detection Yet'}
              </span>
              {detectedNote.found && !isDemoResult && (
                <span className="text-xs font-mono text-slate-300">
                  Model confidence: {typeof detectedNote.confidence === 'number' ? `${(detectedNote.confidence * 100).toFixed(0)}%` : 'Not provided'}
                </span>
              )}
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Identified Denomination</span>
              <h3 className="text-lg sm:text-xl font-extrabold text-white">
                {detectedNote.found && detectedNote.denomination ? detectedNote.denomination : 'No banknote analyzed'}
              </h3>
              <p className="text-xs text-slate-400">{statusMessage}</p>
              {detectedNote.found && !isDemoResult && (
                <p className="text-[11px] text-amber-300">AI output can be wrong. This does not verify genuineness or detect counterfeit notes reliably.</p>
              )}
            </div>

            {detectedNote.found && detectedNote.noteCondition && (
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1">
                <span className="font-semibold text-emerald-300 block">Tactile & SecurityFeatures:</span>
                <p className="text-[11px] text-slate-400">{detectedNote.noteCondition}</p>
              </div>
            )}

            {/* Read Aloud & Vibration Pulse Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                disabled={!detectedNote.found || !detectedNote.denomination}
                onClick={() => {
                  if (!detectedNote.found || !detectedNote.denomination) return;
                  const msg = settings.uiLanguage === 'hi'
                    ? `${detectedNote.denomination} पहचाना गया।`
                    : `${detectedNote.denomination}. ${isDemoResult ? 'This is a demo result.' : 'This is an AI estimate, not an authenticity check.'}`;
                  speakText(msg, settings.uiLanguage, settings.voiceSpeed);
                }}
                className="py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Volume2 className="w-4 h-4 text-cyan-400" />
                <span>Speak Value</span>
              </button>

              <button
                onClick={() => triggerHaptic(HAPTIC_PATTERNS.CURRENCY_DETECTED)}
                className="py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Vibrate className="w-4 h-4" />
                <span>Feel Vibe Pulse</span>
              </button>
            </div>
          </div>

          {/* Quick Test Banknotes */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-300 block">
              Quick Test Banknotes (Instant Voice Demonstration)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {SAMPLE_NOTES.map((n, idx) => (
                <button
                  key={idx}
                  onClick={() => selectSampleNote(n)}
                  className="p-2.5 rounded-xl border border-slate-800 bg-slate-800/40 hover:border-slate-700 text-left transition-all space-y-0.5"
                >
                  <span className="text-xs font-bold text-white block truncate">{n.denomination}</span>
                  <span className="text-[10px] text-emerald-400 font-mono block">{n.color}</span>
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
