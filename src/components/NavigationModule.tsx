
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
import { analyzeSceneVision } from '../services/geminiService';
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

const NavigationModule: React.FC<NavigationModuleProps> = ({
  settings,
}) => {
  const [selectedRoute, setSelectedRoute] =
    useState<NavigationRoute>(SAMPLE_ROUTES[0]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  const [obstacles, setObstacles] = useState<ObstacleItem[]>([
    {
      label: 'Staircase 4 steps down',
      position: 'center',
      distanceMeters: 1.8,
      urgency: 'medium',
    },
    {
      label: 'Low barrier post',
      position: 'left',
      distanceMeters: 2.5,
      urgency: 'low',
    },
  ]);

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

  const t = (key: string) =>
    getTranslation(settings.uiLanguage, key);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const toggleCamera = async () => {
    if (cameraActive) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

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

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
      triggerHaptic(HAPTIC_PATTERNS.SUCCESS);

      speakText(
        'Obstacle camera activated. Scanning path ahead.',
        settings.uiLanguage,
        settings.voiceSpeed,
      );
    } catch (error) {
      console.error('Camera access failed:', error);
      setCameraActive(false);

      speakText(
        'Camera could not be activated. Please check camera permission.',
        settings.uiLanguage,
        settings.voiceSpeed,
      );
    }
  };

  const handleScanObstaclesWithAI = async () => {
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

    setAnalyzingScene(true);
    triggerHaptic(HAPTIC_PATTERNS.CLICK);

    try {
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Unable to create camera frame.');
      }

      canvas.width = 480;
      canvas.height = 360;

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const base64Image = canvas.toDataURL('image/jpeg', 0.7);

      const result = await analyzeSceneVision(
        base64Image,
        'navigation',
        settings.uiLanguage === 'hi' ? 'Hindi' : 'English',
      );

      if (result.obstacles?.length) {
        setObstacles(result.obstacles);
      }

      if (result.spokenGuidance) {
        speakText(
          result.spokenGuidance,
          settings.uiLanguage,
          settings.voiceSpeed,
        );
      }

      if (result.hapticCode === 'STOP_DANGER') {
        triggerHaptic(HAPTIC_PATTERNS.OBSTACLE_DANGER);
        playObstacleBeacon(0.8, 'center');
      } else if (result.hapticCode === 'LEFT') {
        triggerHaptic(HAPTIC_PATTERNS.TURN_LEFT);
        playTurnCue('left');
      } else if (result.hapticCode === 'RIGHT') {
        triggerHaptic(HAPTIC_PATTERNS.TURN_RIGHT);
        playTurnCue('right');
      }
    } catch (error) {
      console.error('Obstacle scan failed:', error);

      speakText(
        'Obstacle analysis failed. Please try again.',
        settings.uiLanguage,
        settings.voiceSpeed,
      );
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
    <div className="space-y-6">
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
            camera-based obstacle analysis.
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
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
              ) : (
                <div className="p-6 text-center space-y-2">
                  <Camera className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    Activate the camera to capture a real frame for AI analysis.
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

            <button
              type="button"
              onClick={handleScanObstaclesWithAI}
              disabled={!cameraActive || analyzingScene}
              className="w-full py-2 px-3 text-xs font-bold rounded-xl bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 flex items-center justify-center gap-2 border border-slate-600"
            >
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
              {analyzingScene
                ? 'Analyzing camera frame...'
                : 'Analyze Camera Frame'}
            </button>

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
