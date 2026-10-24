
import React, { useState, useRef, useEffect } from 'react';
import {
  Navigation,
  Camera,
  CameraOff,
  MapPin,
  AlertTriangle,
  Volume2,
  Vibrate,
  Ticket,
  QrCode,
  CheckCircle2,
  Footprints,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  CornerUpLeft,
  CornerUpRight,
  ShieldAlert,
} from 'lucide-react';

import {
  SensorySettings,
  ObstacleItem,
  NavigationRoute,
} from '../types';

import {
  getTranslation,
  formatBionic,
} from '../services/localization';

import {
  triggerHaptic,
  HAPTIC_PATTERNS,
} from '../services/haptics';

import {
  playObstacleBeacon,
  playTurnCue,
} from '../services/audioBeacon';

import { speakText } from '../services/speechService';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { LiveAccessibleMap } from './LiveAccessibleMap';

interface NavigationModuleProps {
  settings: SensorySettings;
  onVoiceCommandRequested?: (command: string) => void;
}

const SAMPLE_ROUTES: NavigationRoute[] = [
  {
    id: 'metro-accessible',
    destinationName: 'Central Metro Station (Elevator & Tactile Gate 2)',
    distance: '320 m',
    duration: '4 mins walk',
    tactileSteps: [
      {
        instruction: 'Follow yellow tactile paving straight ahead for 45 meters.',
        distanceMeters: 45,
        turnDirection: 'straight',
        hapticPattern: HAPTIC_PATTERNS.STRAIGHT,
      },
      {
        instruction: 'Turn left at audible acoustic beacon near Ramp A.',
        distanceMeters: 30,
        turnDirection: 'left',
        hapticPattern: HAPTIC_PATTERNS.TURN_LEFT,
      },
      {
        instruction: 'Caution: 3 gentle tactile warning bumps before street crossing.',
        distanceMeters: 20,
        turnDirection: 'straight',
        hapticPattern: HAPTIC_PATTERNS.STEP_HAZARD,
        hazardWarning: 'Pedestrian crossing with audio chimes.',
      },
      {
        instruction: 'Turn slight right towards Accessible Elevator entrance.',
        distanceMeters: 55,
        turnDirection: 'slight-right',
        hapticPattern: HAPTIC_PATTERNS.SLIGHT_TURN,
      },
      {
        instruction: 'You have arrived at Metro Gate 2. Elevator button is on right at 1.1m height.',
        distanceMeters: 0,
        turnDirection: 'arrival',
        hapticPattern: HAPTIC_PATTERNS.ARRIVED,
      },
    ],
  },
  {
    id: 'hospital-wing',
    destinationName: 'General Hospital - Divyang Assistance Counter',
    distance: '550 m',
    duration: '7 mins walk',
    tactileSteps: [
      {
        instruction: 'Walk straight along sidewalk with continuous tactile guide.',
        distanceMeters: 80,
        turnDirection: 'straight',
        hapticPattern: HAPTIC_PATTERNS.STRAIGHT,
      },
      {
        instruction: 'Turn right at the hospital main security gate.',
        distanceMeters: 40,
        turnDirection: 'right',
        hapticPattern: HAPTIC_PATTERNS.TURN_RIGHT,
      },
      {
        instruction: 'Take the gentle wheelchair ramp up 15 meters.',
        distanceMeters: 15,
        turnDirection: 'stairs-up',
        hapticPattern: HAPTIC_PATTERNS.SLIGHT_TURN,
      },
      {
        instruction: 'Arrived at OPD Building Counter 1 (Braille & Sign Language desk).',
        distanceMeters: 0,
        turnDirection: 'arrival',
        hapticPattern: HAPTIC_PATTERNS.ARRIVED,
      },
    ],
  },
];

type DetectionBox = { x: number; y: number; width: number; height: number };
type DetectedObstacle = ObstacleItem & { boundingBox?: DetectionBox | null };

type LocalScanResult = {
  obstacles: DetectedObstacle[];
  spokenGuidance: string;
  hapticCode: 'STOP_DANGER' | 'LEFT' | 'RIGHT' | 'CLEAR';
};

let localDetectionModelPromise: Promise<cocoSsd.ObjectDetection> | null = null;

async function detectObjectsLocally(source: HTMLCanvasElement): Promise<LocalScanResult> {
  if (!localDetectionModelPromise) {
    localDetectionModelPromise = cocoSsd.load({ base: 'lite_mobilenet_v2' });
  }

  const model = await localDetectionModelPromise;
  const predictions = await model.detect(source);

  const obstacles: DetectedObstacle[] = predictions
    .filter((prediction) => prediction.score >= 0.45)
    .map((prediction) => {
      const [x, y, width, height] = prediction.bbox;
      const centerX = x + width / 2;
      const position = centerX < source.width / 3
        ? 'left'
        : centerX > (source.width * 2) / 3
          ? 'right'
          : 'center';
      const label = prediction.class;
      const criticalObjects = ['car', 'truck', 'bus', 'motorcycle', 'bicycle'];
      const urgency = criticalObjects.includes(label)
        ? 'critical'
        : ['person', 'chair', 'couch', 'bed', 'potted plant'].includes(label)
          ? 'medium'
          : 'low';

      return {
        label,
        position,
        // Monocular object detection cannot reliably measure distance.
        // This is a rough placeholder, not a measured distance.
        distanceMeters: 2,
        urgency,
        boundingBox: { x, y, width, height },
      } as DetectedObstacle;
    });

  const critical = obstacles.filter((item) => item.urgency === 'critical');
  const medium = obstacles.filter((item) => item.urgency === 'medium');

  let spokenGuidance = 'I can identify objects, but I cannot confirm that the path is safe. Stop and check your surroundings.';
  let hapticCode: LocalScanResult['hapticCode'] = 'CLEAR';

  if (critical.length > 0) {
    const first = critical[0];
    spokenGuidance = `Caution. ${first.label} detected ${first.position}. Stop and check your surroundings.`;
    hapticCode = 'STOP_DANGER';
  } else if (medium.length > 0) {
    const first = medium[0];
    spokenGuidance = `Caution. ${first.label} detected ${first.position}. Move carefully and verify the path.`;
    hapticCode = first.position === 'left' ? 'RIGHT' : first.position === 'right' ? 'LEFT' : 'STOP_DANGER';
  } else if (obstacles.length > 0) {
    spokenGuidance = `Objects detected: ${obstacles.slice(0, 3).map((item) => item.label).join(', ')}. I cannot confirm the path is clear. Please check your surroundings.`;
  } else {
    spokenGuidance = 'No supported objects detected in this frame. This does not guarantee the path is clear; check your surroundings.';
  }

  return { obstacles, spokenGuidance, hapticCode };
}

async function analyzeUploadedImageLocally(dataUrl: string): Promise<LocalScanResult> {
  const image = new Image();
  image.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Could not load the selected image.'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.min(image.naturalWidth || image.width, 640);
  canvas.height = Math.max(1, Math.round(canvas.width * (image.naturalHeight || image.height) / (image.naturalWidth || image.width)));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to prepare the uploaded image for local analysis.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return detectObjectsLocally(canvas);
}

const NavigationModule: React.FC<NavigationModuleProps> = ({
  settings,
}) => {
  const [selectedRoute, setSelectedRoute] =
    useState<NavigationRoute>(SAMPLE_ROUTES[0]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  const [obstacles, setObstacles] = useState<DetectedObstacle[]>([]);
  const [cameraStatus, setCameraStatus] = useState('Camera is off.');
  const [scanError, setScanError] = useState('');
  const [hasAnalyzedFrame, setHasAnalyzedFrame] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const [analyzingScene, setAnalyzingScene] = useState(false);
  const [transitModalOpen, setTransitModalOpen] = useState(false);

  const [purchasedPass, setPurchasedPass] = useState<{
    id: string;
    type: string;
    price: string;
    code: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanInFlightRef = useRef(false);
  const scanHandlerRef = useRef<((automatic?: boolean) => Promise<void>) | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const lastSpokenAlertRef = useRef('');
  const lastSpokenAtRef = useRef(0);

  const t = (key: string) =>
    getTranslation(settings.uiLanguage, key);

  // Attach the stream only after React has mounted the conditional video element.
  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;

    const video = videoRef.current;
    video.srcObject = streamRef.current;

    video.play()
      .then(() => {
        setCameraStatus('Camera connected. Ready to analyze.');
      })
      .catch((error) => {
        console.error('Video playback failed:', error);
        setScanError('Camera connected, but video could not start. Check browser permissions or upload an image instead.');
        setCameraStatus('Video could not start.');
      });
  }, [cameraActive]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const toggleCamera = async () => {
    if (cameraActive) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setObstacles([]);
      setScanError('');
      setCameraStatus('Camera is off.');
      setCameraActive(false);
      triggerHaptic(HAPTIC_PATTERNS.CLICK);
      return;
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setScanError('');
      setCameraStatus('Connecting camera…');
      setCameraActive(true);
      triggerHaptic(HAPTIC_PATTERNS.SUCCESS);

      speakText(
        'Obstacle camera activated. Scanning path ahead.',
        settings.uiLanguage,
        settings.voiceSpeed,
      );
    } catch (error) {
      console.error('Camera access failed:', error);
      setScanError(
        `${error instanceof Error ? error.message : 'Camera access failed.'} You can connect a phone as a webcam or upload an image instead.`,
      );
      setCameraStatus('Camera unavailable.');
      setCameraActive(false);

      speakText(
        'Camera could not be activated. Please check camera permission.',
        settings.uiLanguage,
        settings.voiceSpeed,
      );
    }
  };

  // Automatically request camera access whenever the navigation module opens.
  // The browser will still require the user to grant camera permission.
  useEffect(() => {
    let cancelled = false;

    const startCameraOnOpen = async () => {
      // Let React finish mounting before requesting the camera.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

      if (cancelled) return;
      if (streamRef.current || cameraActive) return;

      await toggleCamera();
    };

    void startCameraOnOpen();

    return () => {
      cancelled = true;
    };
    // This effect intentionally runs only when the module mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScanObstaclesWithAI = async (automatic = false) => {
    if (scanInFlightRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (
      !cameraActive ||
      !video ||
      !canvas ||
      video.readyState < 2
    ) {
      speakText(
        'Camera frame is unavailable. Activate the camera and wait for the video before scanning.',
        settings.uiLanguage,
        settings.voiceSpeed,
      );
      return;
    }

    scanInFlightRef.current = true;
    setAnalyzingScene(true);
    if (!automatic) triggerHaptic(HAPTIC_PATTERNS.CLICK);

    try {
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Unable to create camera frame.');
      }

      canvas.width = 480;
      canvas.height = 360;

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const result = await detectObjectsLocally(canvas);

      setObstacles(Array.isArray(result.obstacles) ? result.obstacles : []);
      setHasAnalyzedFrame(true);
      setScanError('');
      setCameraStatus(
        result.obstacles?.length
          ? `Analysis complete: ${result.obstacles.length} possible obstacle(s).`
          : 'Analysis complete: no obstacles identified in this frame.',
      );

      // Speak new/changed hazards during auto-scan, but suppress repeated alerts.
      const important = (result.obstacles || []).filter((item: DetectedObstacle) => item.urgency === 'critical' || item.urgency === 'medium');
      const alertSignature = important.map((item: DetectedObstacle) => `${item.label}:${item.position}:${item.urgency}`).sort().join('|');
      const now = Date.now();
      if (result.spokenGuidance && ((!automatic) || (alertSignature && (alertSignature !== lastSpokenAlertRef.current || now - lastSpokenAtRef.current > 12000)))) {
        speakText(result.spokenGuidance, settings.uiLanguage, settings.voiceSpeed);
        lastSpokenAlertRef.current = alertSignature;
        lastSpokenAtRef.current = now;
      }

      if (result.hapticCode === 'STOP_DANGER' && (!automatic || important.length > 0)) {
        triggerHaptic(HAPTIC_PATTERNS.OBSTACLE_DANGER);
        playObstacleBeacon(0.8, 'center');
      } else if (!automatic && result.hapticCode === 'LEFT') {
        triggerHaptic(HAPTIC_PATTERNS.TURN_LEFT);
        playTurnCue('left');
      } else if (!automatic && result.hapticCode === 'RIGHT') {
        triggerHaptic(HAPTIC_PATTERNS.TURN_RIGHT);
        playTurnCue('right');
      }
    } catch (error) {
      console.error('Obstacle scan failed:', error);
      setScanError(
        error instanceof Error
          ? error.message
          : 'Obstacle analysis failed. Check that local object-detection packages are installed, then try again.',
      );
      setCameraStatus('Analysis failed.');

      if (!automatic) {
        speakText(
          'Obstacle analysis failed. Please try again.',
          settings.uiLanguage,
          settings.voiceSpeed,
        );
      }
    } finally {
      scanInFlightRef.current = false;
      setAnalyzingScene(false);
    }
  };

  scanHandlerRef.current = handleScanObstaclesWithAI;

  // Automatically analyze fresh camera frames. Requests never overlap.
  useEffect(() => {
    if (!cameraActive) return;
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && !scanInFlightRef.current) {
        void scanHandlerRef.current?.(true);
      }
    }, 2400);
    return () => window.clearInterval(timer);
  }, [cameraActive]);

  const handleImageUpload = async (file?: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setScanError('Choose an image file such as JPG, PNG, or WEBP.');
      return;
    }

    try {
      setAnalyzingScene(true);
      setScanError('');
      setCameraStatus('Analyzing uploaded image…');

      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('Could not read image file.'));
        };
        reader.onerror = () => reject(new Error('Could not read image file.'));
        reader.readAsDataURL(file);
      });

      setUploadedImage(dataUrl);

      const result = await analyzeUploadedImageLocally(dataUrl);

      setObstacles(Array.isArray(result.obstacles) ? result.obstacles : []);
      setHasAnalyzedFrame(true);
      setCameraStatus(
        result.obstacles?.length
          ? `Image analysis complete: ${result.obstacles.length} possible obstacle(s).`
          : 'Image analysis complete: no obstacles identified.',
      );

      if (result.spokenGuidance) {
        speakText(result.spokenGuidance, settings.uiLanguage, settings.voiceSpeed);
      }
    } catch (error) {
      console.error('Uploaded image analysis failed:', error);
      setScanError(
        error instanceof Error
          ? error.message
          : 'Local image analysis failed. Check that local object-detection packages are installed.',
      );
      setCameraStatus('Image analysis failed.');
    } finally {
      setAnalyzingScene(false);
    }
  };

  const advanceStep = (direction: 'next' | 'prev') => {
    const newIndex =
      direction === 'next'
        ? Math.min(
            selectedRoute.tactileSteps.length - 1,
            currentStepIndex + 1,
          )
        : Math.max(0, currentStepIndex - 1);

    setCurrentStepIndex(newIndex);

    const step = selectedRoute.tactileSteps[newIndex];

    if (settings.hapticFeedback && step.hapticPattern) {
      triggerHaptic(step.hapticPattern);
    }

    if (settings.soundRadar) {
      if (
        step.turnDirection === 'left' ||
        step.turnDirection === 'slight-left'
      ) {
        playTurnCue('left');
      } else if (
        step.turnDirection === 'right' ||
        step.turnDirection === 'slight-right'
      ) {
        playTurnCue('right');
      } else {
        playTurnCue('straight');
      }
    }

    speakText(
      step.instruction,
      settings.uiLanguage,
      settings.voiceSpeed,
    );
  };

  const startNavigation = () => {
    setIsNavigating(true);
    setCurrentStepIndex(0);

    const firstStep = selectedRoute.tactileSteps[0];

    triggerHaptic(HAPTIC_PATTERNS.SUCCESS);

    speakText(
      `Starting sample guidance to ${selectedRoute.destinationName}. ${firstStep.instruction}`,
      settings.uiLanguage,
      settings.voiceSpeed,
    );
  };

  const currentStep = selectedRoute.tactileSteps[currentStepIndex];

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-800/50 border border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              Accessible Voice &amp; Haptic Navigation
            </h2>
          </div>

          <p className="text-xs text-slate-300 mt-0.5">
            Interactive GPS map, voice guidance, haptic feedback and
            on-device camera object detection.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={toggleCamera}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
              cameraActive
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-slate-700 hover:bg-slate-600 text-white border-transparent'
            }`}
          >
            {cameraActive ? (
              <CameraOff className="w-4 h-4" />
            ) : (
              <Camera className="w-4 h-4 text-cyan-400" />
            )}
            <span>
              {cameraActive ? t('stopCamera') : 'Open Obstacle Camera'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(HAPTIC_PATTERNS.CLICK);
              setTransitModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white"
          >
            <Ticket className="w-4 h-4" />
            Transit Pass
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-cyan-400" />
              Select Sample Route
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SAMPLE_ROUTES.map((route) => (
                <button
                  type="button"
                  key={route.id}
                  onClick={() => {
                    triggerHaptic(HAPTIC_PATTERNS.CLICK);
                    setSelectedRoute(route);
                    setCurrentStepIndex(0);
                    setIsNavigating(false);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedRoute.id === route.id
                      ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400'
                      : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'
                  }`}
                >
                  <p className="text-xs font-bold text-white">
                    {route.destinationName}
                  </p>

                  <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                    <span>{route.distance}</span>
                    <span>·</span>
                    <span>{route.duration}</span>
                  </div>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-amber-300">
              These are demonstration routes. Use the interactive map
              below to explore locations and open walking directions.
            </p>
          </div>

          {/* REAL INTERACTIVE MAP */}
          <div className="relative rounded-2xl overflow-hidden border border-cyan-500/30 bg-slate-950 p-3">
            <LiveAccessibleMap />
          </div>

          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 shrink-0">
                {currentStep.turnDirection === 'left' && (
                  <CornerUpLeft className="w-6 h-6" />
                )}
                {currentStep.turnDirection === 'right' && (
                  <CornerUpRight className="w-6 h-6" />
                )}
                {currentStep.turnDirection === 'slight-left' && (
                  <ArrowLeft className="w-6 h-6" />
                )}
                {currentStep.turnDirection === 'slight-right' && (
                  <ArrowRight className="w-6 h-6" />
                )}
                {currentStep.turnDirection === 'straight' && (
                  <ArrowUp className="w-6 h-6" />
                )}
                {currentStep.turnDirection === 'arrival' && (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                )}
                {currentStep.turnDirection === 'stairs-up' && (
                  <Footprints className="w-6 h-6" />
                )}
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider block">
                  Sample Turn ·{' '}
                  {currentStep.distanceMeters > 0
                    ? `${currentStep.distanceMeters}m ahead`
                    : 'Arrival'}
                </span>

                <p
                  className="text-sm sm:text-base font-semibold text-white leading-snug"
                  dangerouslySetInnerHTML={{
                    __html: formatBionic(
                      currentStep.instruction,
                      settings.bionicReading,
                    ),
                  }}
                />

                {currentStep.hazardWarning && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-300 bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-800/50">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{currentStep.hazardWarning}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-700/60 text-xs">
              <button
                type="button"
                onClick={() =>
                  speakText(
                    currentStep.instruction,
                    settings.uiLanguage,
                    settings.voiceSpeed,
                  )
                }
                className="flex items-center gap-1.5 text-cyan-300 hover:text-cyan-200"
              >
                <Volume2 className="w-4 h-4" />
                Repeat Voice Cue
              </button>

              <button
                type="button"
                onClick={() => {
                  if (currentStep.hapticPattern) {
                    triggerHaptic(currentStep.hapticPattern);
                  }
                }}
                className="flex items-center gap-1.5 text-amber-300 hover:text-amber-200"
              >
                <Vibrate className="w-4 h-4" />
                Test Turn Vibration
              </button>
            </div>

            <div className="pt-3 border-t border-slate-700/60">
              {!isNavigating ? (
                <button
                  type="button"
                  onClick={startNavigation}
                  className="w-full py-2.5 px-4 text-sm font-bold rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center gap-2"
                >
                  <Navigation className="w-4 h-4" />
                  Start Sample Voice Guidance
                </button>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => advanceStep('prev')}
                    disabled={currentStepIndex === 0}
                    className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700"
                  >
                    Previous Step
                  </button>

                  <span className="text-xs font-mono text-cyan-300">
                    Step {currentStepIndex + 1} of{' '}
                    {selectedRoute.tactileSteps.length}
                  </span>

                  <button
                    type="button"
                    onClick={() => advanceStep('next')}
                    disabled={
                      currentStepIndex ===
                      selectedRoute.tactileSteps.length - 1
                    }
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center gap-1.5"
                  >
                    Next Step
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  Real-Time Camera Obstacle Analysis
                </h3>
              </div>

              <span className="text-[11px] text-slate-400 font-mono">
                {cameraActive ? 'CAMERA ON' : 'STANDBY'}
              </span>
            </div>

            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
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

                  <div className="absolute inset-0 pointer-events-none">
                    {obstacles.map((obstacle, index) => obstacle.boundingBox ? (
                      <div
                        key={`box-${obstacle.label}-${index}`}
                        className={`absolute border-2 ${obstacle.urgency === 'critical' ? 'border-red-400' : obstacle.urgency === 'medium' ? 'border-amber-300' : 'border-cyan-300'}`}
                        style={{
                          left: `${Math.max(0, Math.min(100, obstacle.boundingBox.x / 10))}%`,
                          top: `${Math.max(0, Math.min(100, obstacle.boundingBox.y / 10))}%`,
                          width: `${Math.max(1, Math.min(100 - obstacle.boundingBox.x / 10, obstacle.boundingBox.width / 10))}%`,
                          height: `${Math.max(1, Math.min(100 - obstacle.boundingBox.y / 10, obstacle.boundingBox.height / 10))}%`,
                        }}
                      >
                        <span className="absolute -top-5 left-0 max-w-40 truncate rounded bg-slate-950/90 px-1 py-0.5 text-[9px] font-bold text-white">{obstacle.label}</span>
                      </div>
                    ) : null)}
                  </div>
                  <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between">
                    <div className="flex flex-col gap-1.5">
                      {obstacles.map((obstacle, index) => (
                        <div
                          key={`${obstacle.label}-${index}`}
                          className={`self-start px-2 py-1 rounded-md text-[11px] font-bold border backdrop-blur-md flex items-center gap-1.5 ${
                            obstacle.urgency === 'critical'
                              ? 'bg-red-950/80 border-red-500 text-red-200'
                              : obstacle.urgency === 'medium'
                                ? 'bg-amber-950/80 border-amber-500 text-amber-200'
                                : 'bg-slate-900/80 border-cyan-500/50 text-cyan-200'
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          <span>{obstacle.label}</span>
                          <span className="font-mono text-white">
                            ({obstacle.distanceMeters}m · {obstacle.position})
                          </span>
                        </div>
                      ))}
                      {obstacles.length === 0 && (
                        <div className="self-start px-2 py-1 rounded-md text-[11px] bg-slate-950/80 border border-slate-600 text-white">
                          {hasAnalyzedFrame ? 'No obstacles identified in the latest scan' : 'Waiting for first camera scan…'}
                        </div>
                      )}
                    </div>

                    <div className="self-center flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full border-2 border-dashed border-cyan-400/80 flex items-center justify-center text-cyan-400">
                        <ArrowUp className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-mono bg-slate-950/80 px-2 py-0.5 rounded text-cyan-300 mt-1">
                        CAMERA VIEW
                      </span>
                    </div>
                  </div>
                </>
              ) : uploadedImage ? (
                <img
                  src={uploadedImage}
                  alt="Selected image for obstacle analysis"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="p-6 text-center space-y-2">
                  <Camera className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    Activate the camera to scan a frame using on-device object detection.
                  </p>
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white"
                  >
                    Activate Camera
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-300" role="status">
              {cameraStatus}
            </p>
            {scanError && (
              <p
                className="text-xs text-red-300 bg-red-950/40 border border-red-800/60 rounded-lg p-2"
                role="alert"
              >
                {scanError}
              </p>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                void handleImageUpload(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handleScanObstaclesWithAI(false)}
              disabled={!cameraActive || analyzingScene}
              className="w-full py-2 px-3 text-xs font-bold rounded-xl bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 flex items-center justify-center gap-2 border border-slate-600"
            >
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
              {analyzingScene
                ? 'Analyzing camera frame...'
                : cameraActive ? 'Scan Now (auto-scan on)' : 'Activate camera to scan'}
            </button>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={analyzingScene}
              className="w-full py-2 px-3 text-xs font-bold rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white disabled:opacity-50 border border-cyan-600"
            >
              Upload / Take Photo
            </button>
            </div>

            <p className="text-[11px] leading-relaxed text-slate-400">
              AI results may be inaccurate. Do not rely on this feature alone
              for safety-critical obstacle detection.
            </p>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                  Acoustic Beacon Test
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  playObstacleBeacon(1.8, 'center');
                  triggerHaptic(HAPTIC_PATTERNS.STEP_HAZARD);
                }}
                className="w-full py-2 text-[11px] font-medium text-slate-300 hover:text-white text-center"
              >
                Test Acoustic Obstacle Beacon
              </button>
            </div>
          </div>
        </div>
      </div>

      {transitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 space-y-4 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold">Transit Pass Demo</h3>
              </div>

              <button
                type="button"
                onClick={() => setTransitModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
                aria-label="Close transit pass modal"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Demonstration interface only. No real ticket or payment is issued.
            </p>

            <div className="space-y-2">
              {[
                {
                  type: 'Metro Divyang All-Day Pass',
                  price: '₹20 / Free',
                  desc: 'Example pass for metro travel.',
                },
                {
                  type: 'Low-Floor City Bus Pass',
                  price: '₹10',
                  desc: 'Example bus pass.',
                },
                {
                  type: 'Accessible Airport Shuttle',
                  price: '₹50',
                  desc: 'Example shuttle ticket.',
                },
              ].map((pass) => (
                <div
                  key={pass.type}
                  className="p-3 rounded-xl border border-slate-800 bg-slate-800/40 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-white">
                      {pass.type}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {pass.desc}
                    </p>
                    <span className="text-xs font-mono text-cyan-300 font-semibold">
                      {pass.price}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(HAPTIC_PATTERNS.SUCCESS);

                      setPurchasedPass({
                        id: `DEMO-${Date.now().toString().slice(-6)}`,
                        type: pass.type,
                        price: pass.price,
                        code: `DEMO-${Math.floor(1000 + Math.random() * 9000)}`,
                      });

                      speakText(
                        'Demonstration pass created. This is not a real ticket.',
                        settings.uiLanguage,
                        settings.voiceSpeed,
                      );
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white"
                  >
                    Demo
                  </button>
                </div>
              ))}
            </div>

            {purchasedPass && (
              <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/40 space-y-2 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />

                <h4 className="text-xs font-bold text-cyan-200">
                  Demo Pass: {purchasedPass.type}
                </h4>

                <div className="bg-white p-3 rounded-lg inline-block my-1">
                  <QrCode className="w-24 h-24 text-slate-950" />
                </div>

                <div className="font-mono text-xs text-white font-bold tracking-widest bg-slate-900 py-1 px-3 rounded border border-slate-700">
                  {purchasedPass.code}
                </div>

                <p className="text-[10px] text-amber-300">
                  Demo only — this is not a valid travel ticket.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export { NavigationModule };
export default NavigationModule;
