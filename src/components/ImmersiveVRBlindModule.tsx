import React, { useState, useEffect, useRef } from 'react';
import { 
  Compass, 
  Headphones, 
  EyeOff, 
  Volume2, 
  Vibrate, 
  MapPin, 
  Play, 
  Pause, 
  RotateCcw, 
  ArrowRight, 
  Sparkles,
  Users,
  ShieldCheck,
  Radio,
  Footprints,
  Mic,
  MicOff,
  VolumeX,
  Accessibility,
  CheckCircle2
} from 'lucide-react';
import { SensorySettings, VRVirtualWorld } from '../types';
import { triggerHaptic, HAPTIC_PATTERNS } from '../services/haptics';
import { playAmbientSoundscape, stopAmbientSoundscape, playTurnCue } from '../services/audioBeacon';
import { speakText } from '../services/speechService';
import { formatBionic } from '../services/localization';

interface ImmersiveVRBlindModuleProps {
  settings: SensorySettings;
}

const VR_WORLDS: VRVirtualWorld[] = [
  {
    id: 'delhi-airport-t3',
    name: 'IGI Airport T3 Accessible Transit Route',
    nameHindi: 'इंदिरा गांधी अंतरराष्ट्रीय हवाई अड्डा टर्मिनल 3',
    category: 'transit',
    soundscapeType: 'airport',
    description: 'Travel through the world-class accessible terminal with continuous tactile guide paths, wide security gates, and silent acoustic lounges.',
    steps: [
      {
        title: 'Terminal Entry & Tactile Threshold',
        audioNarration: 'You are standing at Departure Gate 4. Smooth cool granite floor beneath your cane. Audible boarding bell chiming 30 degrees to your left. Straight ahead is the Divyang priority check-in kiosk.',
        spatialSounds: ['Flight chime ding-dong', 'Footsteps on granite', 'Gentle AC airflow'],
        tactileVibe: [100, 50, 100],
        compassHeading: '15° North',
      },
      {
        title: 'Priority Security Checkpoint',
        audioNarration: 'Moving forward 20 paces. You feel ribbed tactile paving underfoot. Security staff voice warmly greets you on the right. Wide magnetic archway with soft confirmation chime.',
        spatialSounds: ['Soft scanner hum', 'Security greeting', 'Luggage wheels rolling'],
        tactileVibe: [80, 40, 80],
        compassHeading: '350° North-Northwest',
      },
      {
        title: 'Duty-Free Acoustic Corridor',
        audioNarration: 'The space opens into a high-ceiling atrium. Soft carpet underfoot dampens all echoes. Aromas of cedar and roasted coffee. An electric buggie honks a gentle melody 10 meters behind.',
        spatialSounds: ['Carpet footsteps', 'Gentle buggie horn', 'Quiet murmurs'],
        tactileVibe: [120, 60, 120],
        compassHeading: '90° East',
      },
      {
        title: 'Boarding Gate 32 Accessible Jetbridge',
        audioNarration: 'Arrival at Gate 32. Tactile blister stop tiles under your feet. Audio beacon announces: Boarding now commencing for priority passengers.',
        spatialSounds: ['Boarding announcement', 'Jetbridge hum', 'Seatbelt click chime'],
        tactileVibe: [200, 100, 200, 100, 300],
        compassHeading: '45° Northeast',
      },
    ],
  },
  {
    id: 'rajiv-chowk-metro',
    name: 'Rajiv Chowk Metro Tactile Interchange Hub',
    nameHindi: 'राजीव चौक मेट्रो स्टेशन इंटरचेंज',
    category: 'transit',
    soundscapeType: 'metro',
    description: 'Immerse into the bustling underground metro interchange safely guided by dual tactile tracks and directional audio radar.',
    steps: [
      {
        title: 'Concourse Level 1 Tactile Paving',
        audioNarration: 'You step off the escalator. Tactile ribbed guidance pavers run straight. The deep rhythmic sub-bass hum of an arriving Yellow Line train vibrates softly under your soles.',
        spatialSounds: ['Train arrival bass hum', 'Turnstile ticket beep', 'Commuter footsteps'],
        tactileVibe: [150, 80, 150],
        compassHeading: '180° South',
      },
      {
        title: 'Blue Line Platform Transition',
        audioNarration: 'Turn right at the tactile T-junction. Gentle descending wheelchair ramp. Acoustic station announcement: Train towards Noida Electronic City arriving on Platform 3.',
        spatialSounds: ['Metro door closing chime', 'Station announcement echo', 'Wind draft'],
        tactileVibe: [80, 40, 80, 40, 80],
        compassHeading: '270° West',
      },
      {
        title: 'Platform Screen Door Alignment',
        audioNarration: 'Approaching Platform 3. Blister warning bumps signal you are 1 meter from the edge. Audio door locator emits alternating C-tones directly in front of you.',
        spatialSounds: ['Platform door locator tone', 'Air brake release', 'Bell chime'],
        tactileVibe: [300, 100, 300],
        compassHeading: '270° West',
      },
    ],
  },
  {
    id: 'lodi-sensory-garden',
    name: 'Lodi Fragrance & Tactile Sensory Botanical Garden',
    nameHindi: 'लोधी संवेदी वनस्पति उद्यान',
    category: 'nature',
    soundscapeType: 'garden',
    description: 'A sensory haven for blind travelers with aromatic herbs, stone water fountains, and handrails embossed with Braille plant guides.',
    steps: [
      {
        title: 'Fragrant Herb Pathway',
        audioNarration: 'Crunch of natural limestone gravel underfoot. The soothing scent of lemongrass, lavender, and crushed mint. Warm afternoon sunlight on your face.',
        spatialSounds: ['Gravel crunch', 'Gentle birdsong', 'Rustling leaves'],
        tactileVibe: [60, 40, 60],
        compassHeading: '120° Southeast',
      },
      {
        title: 'Acoustic Water Fountain Pavilion',
        audioNarration: 'Follow the gentle trickling sound of water straight ahead for 15 steps. Carved sandstone railing with embossed Braille describing the 400-year-old banyan tree.',
        spatialSounds: ['Water fountain cascade', 'Wind chime', 'Breeze'],
        tactileVibe: [100, 50, 100],
        compassHeading: '90° East',
      },
    ],
  },
];

export const ImmersiveVRBlindModule: React.FC<ImmersiveVRBlindModuleProps> = ({ settings }) => {
  const [selectedWorld, setSelectedWorld] = useState<VRVirtualWorld>(VR_WORLDS[0]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [eyesClosedMode, setEyesClosedMode] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready. Choose a journey or say Start when voice control is enabled.');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentStep = selectedWorld.steps[activeStepIndex];

  const announce = (message: string) => {
    setStatusMessage(message);
    if (audioEnabled) speakText(message, settings.uiLanguage, settings.voiceSpeed);
  };

  // Real device vibration where supported; retain the app's existing haptic service.
  const vibrate = (pattern: number | number[]) => {
    if (!settings.hapticFeedback) {
      setStatusMessage('Vibration is disabled in your accessibility settings.');
      return;
    }
    let supported = false;
    try {
      supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
      if (supported) navigator.vibrate(pattern);
    } catch {
      supported = false;
    }
    try { triggerHaptic(Array.isArray(pattern) ? pattern : [pattern]); } catch { /* optional hardware service */ }
    setStatusMessage(supported
      ? 'Vibration pattern sent to your device. Actual vibration depends on device and browser support.'
      : 'This browser does not expose device vibration. The app haptic service was also requested if available.');
  };

  // Short left/centre/right audio cues using the Web Audio stereo panner.
  // These are simulated directional cues, not recordings of the real world.
  const playDirectionalCue = (pan: number, frequency: number) => {
    if (!audioEnabled || typeof window === 'undefined') return;
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) {
        setStatusMessage('Directional audio is not supported in this browser.');
        return;
      }
      const context: AudioContext = audioContextRef.current || new AudioContextCtor();
      audioContextRef.current = context;
      if (context.state === 'suspended') void context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const panner = context.createStereoPanner ? context.createStereoPanner() : null;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
      if (panner) {
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        oscillator.connect(gain).connect(panner).connect(context.destination);
      } else {
        oscillator.connect(gain).connect(context.destination);
      }
      oscillator.start();
      oscillator.stop(context.currentTime + 0.45);
      setStatusMessage(pan < -0.2 ? 'Directional audio cue: left.' : pan > 0.2 ? 'Directional audio cue: right.' : 'Directional audio cue: ahead / centre.');
    } catch {
      setStatusMessage('Could not play directional audio. Check browser sound permissions.');
    }
  };

  const stopJourney = () => {
    stopAmbientSoundscape();
    window.speechSynthesis?.cancel();
    setIsPlaying(false);
    setStatusMessage('Journey paused. Select Start Sensory Walk to continue.');
  };

  const startVoiceControl = () => {
    const speechWindow = window as any;
    const SpeechRecognitionCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setStatusMessage('Voice control is not supported by this browser. Try a supported browser and allow microphone access.');
      announce('Voice control is not supported by this browser. You can still use the accessible buttons.');
      return;
    }
    try {
      if (recognitionRef.current) recognitionRef.current.stop();
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = settings.uiLanguage === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onresult = (event: any) => {
        const result = event.results?.[event.results.length - 1]?.[0]?.transcript?.toLowerCase().trim() || '';
        if (!result) return;
        if (/\b(start|शुरू|चालू)\b/.test(result)) {
          if (!isPlaying) togglePlay(); else announce('Sensory journey is already playing.');
        } else if (/\b(pause|stop|रुको|बंद)\b/.test(result)) {
          stopJourney();
        } else if (/\b(next|forward|अगला|आगे)\b/.test(result)) {
          if (activeStepIndex < selectedWorld.steps.length - 1) advanceStep(activeStepIndex + 1);
          else announce('You are at the last zone.');
        } else if (/\b(previous|back|पिछला|पीछे)\b/.test(result)) {
          if (activeStepIndex > 0) advanceStep(activeStepIndex - 1);
          else announce('You are at the first zone.');
        } else if (/\b(repeat|again|दोहराओ|फिर)\b/.test(result)) {
          announce(`${currentStep.title}. ${currentStep.audioNarration}`);
        } else if (/\b(vibrat(e|ion)|वाइब्रेशन|कंपन)\b/.test(result)) {
          vibrate(currentStep.tactileVibe || [100, 50, 100]);
        } else if (/\b(left|बायें|बाएं)\b/.test(result)) {
          playDirectionalCue(-1, 440);
        } else if (/\b(right|दायें|दाएं)\b/.test(result)) {
          playDirectionalCue(1, 660);
        } else if (/\b(centre|center|ahead|आगे सामने)\b/.test(result)) {
          playDirectionalCue(0, 550);
        } else {
          announce(`I heard: ${result}. Try Start, Pause, Next zone, Previous zone, Repeat, Vibration, Left cue, or Right cue.`);
        }
      };
      recognition.onerror = (event: any) => {
        setVoiceListening(false);
        setStatusMessage(`Voice control stopped: ${event.error || 'microphone error'}. Check microphone permission or use buttons.`);
      };
      recognition.onend = () => setVoiceListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setVoiceListening(true);
      announce('Voice control is listening. Say Start, Pause, Next zone, Previous zone, Repeat, Vibration, Left cue, or Right cue.');
    } catch {
      setVoiceListening(false);
      setStatusMessage('Could not start voice control. Allow microphone access and try again.');
    }
  };

  const toggleVoiceControl = () => {
    if (voiceListening) {
      try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
      recognitionRef.current = null;
      setVoiceListening(false);
      announce('Voice control stopped.');
    } else {
      startVoiceControl();
    }
  };

  // Start / Pause Sensory Journey
  const togglePlay = () => {
    if (isPlaying) {
      stopAmbientSoundscape();
      setIsPlaying(false);
      window.speechSynthesis?.cancel();
      setStatusMessage('Journey paused.');
      return;
    }

    setIsPlaying(true);
    if (audioEnabled) playAmbientSoundscape(selectedWorld.soundscapeType);
    if (settings.hapticFeedback) vibrate(HAPTIC_PATTERNS.SUCCESS);
    announce(`Starting simulated sensory journey in ${selectedWorld.name}. Zone ${activeStepIndex + 1}: ${currentStep.title}. ${currentStep.audioNarration}`);
  };

  const advanceStep = (nextIdx: number) => {
    // Guard both ends so Previous/Next can never select an invalid zone.
    if (nextIdx < 0 || nextIdx >= selectedWorld.steps.length) return;

    setActiveStepIndex(nextIdx);
    const step = selectedWorld.steps[nextIdx];

    if (settings.hapticFeedback && step.tactileVibe) vibrate(step.tactileVibe);

    try { playTurnCue('straight'); } catch { /* optional audio cue service */ }
    announce(`${step.title}. ${step.audioNarration}`);
  };

  const selectWorld = (world: VRVirtualWorld) => {
    window.speechSynthesis?.cancel();
    setSelectedWorld(world);
    setActiveStepIndex(0);

    if (isPlaying) {
      stopAmbientSoundscape();
      if (audioEnabled) playAmbientSoundscape(world.soundscapeType);
      const firstStep = world.steps[0];
      announce(`${world.name}. Zone 1: ${firstStep.title}. ${firstStep.audioNarration}`);
    }
  };

  useEffect(() => {
    return () => {
      stopAmbientSoundscape();
      window.speechSynthesis?.cancel();
      try { recognitionRef.current?.stop(); } catch { /* optional */ }
      try { audioContextRef.current?.close(); } catch { /* optional */ }
    };
  }, []);

  return (
    <div className="space-y-6">
      
      {/* Top Sensory VR Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-800/50 border border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <Headphones className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              Immersive Blind VR Audio & Sensory World
            </h2>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            A guided, simulated sensory journey with spoken scene descriptions, ambient soundscapes, and optional device vibration.
          </p>
        </div>

        {/* Eyes Closed Ultra-Focus Mode */}
        <button
          onClick={() => {
            triggerHaptic(HAPTIC_PATTERNS.CLICK);
            setEyesClosedMode(!eyesClosedMode);
          }}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
            eyesClosedMode
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600'
          }`}
          aria-label="Toggle close eyes focus mode"
        >
          <EyeOff className="w-4 h-4" />
          <span>{eyesClosedMode ? 'Exit Eyes-Closed Mode' : 'Eyes-Closed Sensory Mode'}</span>
        </button>
      </div>

      {/* Eyes Closed Blackout Overlay if active */}
      {eyesClosedMode && (
        <div className="p-6 rounded-2xl bg-black border-2 border-yellow-400/80 text-yellow-300 text-center space-y-4 animate-in fade-in">
          <EyeOff className="w-10 h-10 mx-auto text-yellow-400 animate-pulse" />
          <h3 className="text-lg font-bold">Eyes Closed Sensory Mode Active</h3>
          <p className="text-sm max-w-lg mx-auto text-yellow-200/90 leading-relaxed">
            Screen visual strain is zero. Put on your headphones or hearing aids, relax, and use spoken descriptions, simulated directional audio cues, and device vibration when supported. This is a simulation, not live navigation.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => {
                triggerHaptic([60, 40, 60]);
                advanceStep((activeStepIndex + 1) % selectedWorld.steps.length);
              }}
              className="px-6 py-3 rounded-xl bg-yellow-400 text-black font-bold text-sm hover:bg-yellow-300 shadow-lg"
            >
              Take Next Sensory Step (Footstep Pulse)
            </button>
            <button
              onClick={() => setEyesClosedMode(false)}
              className="px-4 py-3 rounded-xl bg-slate-900 border border-yellow-500 text-yellow-300 text-xs font-semibold"
            >
              Resume Visual Display
            </button>
          </div>
        </div>
      )}

      {/* Accessible voice, audio, and haptic controls */}
      <section aria-labelledby="sensory-controls-title" className="p-4 rounded-2xl bg-slate-900 border border-cyan-900 space-y-3">
        <div className="flex items-center gap-2">
          <Accessibility className="w-5 h-5 text-cyan-300" />
          <h3 id="sensory-controls-title" className="font-bold text-white">Accessible sensory controls</h3>
        </div>
        <p className="text-sm text-slate-300">Use voice commands or large buttons. This is a simulated journey; cues do not detect real-world hazards.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={toggleVoiceControl} aria-pressed={voiceListening} className={`min-h-12 px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-2 ${voiceListening ? 'bg-amber-400 text-slate-950' : 'bg-cyan-500 text-slate-950'}`}>
            {voiceListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            {voiceListening ? 'Stop voice control' : 'Enable voice control'}
          </button>
          <button type="button" onClick={() => { setAudioEnabled(v => !v); if (audioEnabled) { window.speechSynthesis?.cancel(); stopAmbientSoundscape(); setStatusMessage('Audio muted.'); } else { setStatusMessage('Audio enabled. Use Repeat narration to hear this zone.'); } }} aria-pressed={audioEnabled} className="min-h-12 px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white font-semibold text-sm flex items-center gap-2">
            {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />} {audioEnabled ? 'Mute audio' : 'Enable audio'}
          </button>
          <button type="button" onClick={() => vibrate(currentStep.tactileVibe || [100, 50, 100])} className="min-h-12 px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-amber-300 font-semibold text-sm flex items-center gap-2">
            <Vibrate className="w-5 h-5" /> Test vibration
          </button>
          <button type="button" onClick={() => playDirectionalCue(-1, 440)} className="min-h-12 px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white font-semibold text-sm">Play left cue</button>
          <button type="button" onClick={() => playDirectionalCue(0, 550)} className="min-h-12 px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white font-semibold text-sm">Play centre cue</button>
          <button type="button" onClick={() => playDirectionalCue(1, 660)} className="min-h-12 px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white font-semibold text-sm">Play right cue</button>
        </div>
        <div role="status" aria-live="polite" className="rounded-lg bg-slate-950 p-3 text-sm text-cyan-100 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> <span>{statusMessage}</span>
        </div>
        <p className="text-xs text-amber-200">Voice control requires browser microphone permission. Vibration and stereo positioning vary by device. Do not use this simulation as a real-world obstacle detector.</p>
      </section>

      {/* World Selection Carousel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {VR_WORLDS.map((world) => (
          <button
            key={world.id}
            onClick={() => {
              triggerHaptic(HAPTIC_PATTERNS.CLICK);
              selectWorld(world);
            }}
            className={`p-4 rounded-xl border text-left transition-all ${
              selectedWorld.id === world.id
                ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400'
                : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-cyan-400 font-mono mb-1">
              <span className="uppercase">{world.category}</span>
              <span>{world.steps.length} Sensory Zones</span>
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-1">{world.name}</h3>
            <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{world.description}</p>
          </button>
        ))}
      </div>

      {/* Main Sensory Journey Stage */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-700 space-y-6">
        
        {/* Header with Compass Heading and Control */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-mono text-cyan-300 uppercase tracking-wider">
                Virtual Journey: {selectedWorld.name}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mt-1">
              Zone {activeStepIndex + 1}: {currentStep.title}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Play / Pause Virtual Walk */}
            <button
              type="button"
              aria-pressed={isPlaying}
              onClick={togglePlay}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-slate-950" />}
              <span>{isPlaying ? 'Pause Journey' : 'Start Sensory Walk'}</span>
            </button>

            {/* Compass Heading Indicator */}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-cyan-300">
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>{currentStep.compassHeading}</span>
            </div>
          </div>
        </div>

        {/* Narrative Description & Bionic Text */}
        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              Spoken Scene Narration
            </span>
            <span className="font-mono">Step {activeStepIndex + 1} of {selectedWorld.steps.length}</span>
          </div>

          <p 
            className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formatBionic(currentStep.audioNarration, settings.bionicReading) }}
          />

          {/* Spatial Sound Elements Heard */}
          <div className="pt-2 border-t border-slate-700/60 flex flex-wrap gap-2 text-xs">
            <span className="text-slate-400 self-center text-[11px]">Acoustic cues in space:</span>
            {currentStep.spatialSounds.map((sound, sIdx) => (
              <span key={sIdx} className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-cyan-300 text-[11px] font-mono">
                ♫ {sound}
              </span>
            ))}
          </div>
        </div>

        {/* Tactile Footstep Simulation Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (currentStep.tactileVibe) triggerHaptic(currentStep.tactileVibe);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-amber-300 font-semibold border border-slate-700"
            >
              <Vibrate className="w-4 h-4" />
              <span>Feel Ground Texture Vibration</span>
            </button>
            <button
              onClick={() => announce(`${currentStep.title}. ${currentStep.audioNarration}`)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 font-semibold border border-slate-700"
            >
              <Volume2 className="w-4 h-4" />
              <span>Repeat Audio Narration</span>
            </button>
          </div>

          {/* Next Sensory Step Navigation */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              aria-label="Previous sensory zone"
              onClick={() => advanceStep(activeStepIndex - 1)}
              disabled={activeStepIndex === 0}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 disabled:opacity-40 text-slate-300 border border-slate-700"
            >
              Previous Zone
            </button>
            <button
              type="button"
              aria-label="Next sensory zone"
              onClick={() => advanceStep(activeStepIndex + 1)}
              disabled={activeStepIndex === selectedWorld.steps.length - 1}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center gap-1.5"
            >
              <span>Step Forward in VR</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Social Assistance & Community Terrain Shared Beacon */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-3">
          <Users className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">Social Assistance Community Note</span>
              <span className="text-[10px] text-amber-300 font-mono bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-800">Sample community note</span>
            </div>
            <p className="text-slate-300 text-[11px]">
              "Example only: elevator status and accessible-route information must be confirmed with the venue before travel."
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};
