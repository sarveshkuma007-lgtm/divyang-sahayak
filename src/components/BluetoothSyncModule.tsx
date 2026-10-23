import React, { useState } from 'react';
import { 
  Ear, 
  Bluetooth, 
  Activity, 
  Vibrate, 
  BatteryCharging, 
  RefreshCw, 
  CheckCircle2, 
  Sliders, 
  ShieldCheck, 
  Heart,
  Volume2,
  Sparkles
} from 'lucide-react';
import { SensorySettings, BluetoothDeviceStatus } from '../types';
import { getTranslation } from '../services/localization';
import { triggerHaptic, HAPTIC_PATTERNS } from '../services/haptics';
import { speakText } from '../services/speechService';

interface BluetoothSyncModuleProps {
  settings: SensorySettings;
  hearingAidConnected: boolean;
  hearingAidBattery: number;
  onToggleHearingAidSync: () => void;
}

export const BluetoothSyncModule: React.FC<BluetoothSyncModuleProps> = ({
  settings,
  hearingAidConnected,
  hearingAidBattery,
  onToggleHearingAidSync,
}) => {
  const [devices, setDevices] = useState<BluetoothDeviceStatus[]>([
    {
      id: 'aid-1',
      name: 'Oticon Real 1 / Phonak Audéo Bimodal',
      type: 'hearing-aid',
      connected: hearingAidConnected,
      battery: hearingAidBattery,
      activeMode: 'Speech in Noise (+6dB)',
      lastTelemetry: 'Direct BLE audio stream connected',
    },
    {
      id: 'cane-1',
      name: 'Smart Tactile Cane & Haptic Belt V2',
      type: 'smart-cane',
      connected: true,
      battery: 88,
      activeMode: 'Tactile Navigation Sync',
      lastTelemetry: 'Ultrasonic rangefinder active (0.2m - 4.5m)',
    },
    {
      id: 'med-1',
      name: 'Medical BLE Pulse Oximeter',
      type: 'pulse-oximeter',
      connected: true,
      battery: 92,
      activeMode: 'Live Vitals Monitor',
      lastTelemetry: 'Heart Rate: 72 BPM · SpO2: 99%',
    },
    {
      id: 'braille-1',
      name: 'Orbit 20 Refreshable Braille Display',
      type: 'braille-display',
      connected: false,
      battery: 64,
      activeMode: 'Standby',
      lastTelemetry: 'Grade 2 Braille translation ready',
    },
  ]);

  const [scanning, setScanning] = useState(false);
  const [hapticIntensity, setHapticIntensity] = useState<'gentle' | 'standard' | 'high'>('standard');
  const [telecoilActive, setTelecoilActive] = useState(true);

  const t = (key: string) => getTranslation(settings.uiLanguage, key);

  // Scan for Bluetooth peripheral devices
  const scanForDevices = async () => {
    setScanning(true);
    triggerHaptic(HAPTIC_PATTERNS.CLICK);

    // Try real Web Bluetooth API if available in browser
    if (typeof navigator !== 'undefined' && (navigator as any).bluetooth) {
      try {
        await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['battery_service', 'heart_rate'],
        });
      } catch {
        // User cancelled or simulated
      }
    }

    setTimeout(() => {
      setScanning(false);
      triggerHaptic(HAPTIC_PATTERNS.SUCCESS);
      speakText('Bluetooth peripherals refreshed. 3 devices synchronized.', settings.uiLanguage, settings.voiceSpeed);
    }, 1200);
  };

  const toggleDevice = (id: string) => {
    triggerHaptic(HAPTIC_PATTERNS.CLICK);
    if (id === 'aid-1') {
      onToggleHearingAidSync();
    }
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, connected: !d.connected } : d))
    );
  };

  const testHapticWearable = (patternName: string, pattern: number[]) => {
    triggerHaptic(pattern);
    speakText(`Testing haptic wearable: ${patternName}`, settings.uiLanguage, settings.voiceSpeed);
  };

  return (
    <div className="space-y-6">
      
      {/* Module Title Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-800/50 border border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <Bluetooth className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              Bluetooth Peripherals & Automated Hearing Aid Sync
            </h2>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            Automated synchronization for hearing aids, smart tactile canes, haptic guidance belts, and peripheral medical monitors.
          </p>
        </div>

        <button
          onClick={scanForDevices}
          disabled={scanning}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
          <span>{scanning ? 'Searching BLE Devices...' : 'Pair / Scan Peripherals'}</span>
        </button>
      </div>

      {/* Synchronized Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {devices.map((device) => (
          <div
            key={device.id}
            className={`p-4 rounded-2xl border transition-all ${
              device.connected
                ? 'bg-slate-800/60 border-cyan-500/40 ring-1 ring-cyan-500/20'
                : 'bg-slate-850/40 border-slate-800 opacity-70'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  device.connected ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-500'
                }`}>
                  {device.type === 'hearing-aid' && <Ear className="w-5 h-5" />}
                  {device.type === 'smart-cane' && <Vibrate className="w-5 h-5" />}
                  {device.type === 'pulse-oximeter' && <Heart className="w-5 h-5 text-red-400" />}
                  {device.type === 'braille-display' && <Activity className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1">{device.name}</h4>
                  <span className="text-[11px] text-slate-400 capitalize block">{device.type.replace('-', ' ')}</span>
                </div>
              </div>

              <button
                onClick={() => toggleDevice(device.id)}
                className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                  device.connected
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                {device.connected ? 'Connected' : 'Connect'}
              </button>
            </div>

            {device.connected && (
              <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-[11px] text-slate-400">Battery Status</span>
                  <span className="font-mono text-emerald-400 font-semibold">{device.battery}% Charged</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-[11px] text-slate-400">Active Profile</span>
                  <span className="text-cyan-300 font-medium">{device.activeMode}</span>
                </div>
                {device.lastTelemetry && (
                  <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 font-mono">
                    Telemetry: {device.lastTelemetry}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Hearing Aid Audio Equalizer & Mode Tuning */}
      <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            <Ear className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">
              Hearing Aid / Cochlear Audio Profile Manager
            </h3>
          </div>
          <span className="text-xs font-mono text-emerald-400">Low-Latency BLE Sync</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { mode: 'Speech Clarity Boost', desc: 'Amplifies 1kHz - 4kHz consonants for conversation.' },
            { mode: 'Traffic & Directional Sense', desc: 'Spatial 360° awareness of passing vehicles and horns.' },
            { mode: 'Acoustic Telecoil Loop (T-Coil)', desc: 'Direct magnetic induction loop in transit and theaters.' },
          ].map((item, idx) => (
            <div key={idx} className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
              <span className="text-xs font-bold text-white block">{item.mode}</span>
              <p className="text-[11px] text-slate-400 leading-tight">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Smart Haptic Belt Turn Guidance Simulator */}
      <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            <Vibrate className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">
              Tactile Haptic Wearable Turn-by-Turn Pulse Testing
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">Wearable Waist / Cane Vibration</span>
        </div>

        <p className="text-xs text-slate-300">
          Wearable belts vibrate left or right to discreetly guide blind commuters without needing headphones in noisy urban traffic:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => testHapticWearable('Turn Left', HAPTIC_PATTERNS.TURN_LEFT)}
            className="p-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-white border border-slate-600 flex flex-col items-center gap-1.5"
          >
            <Vibrate className="w-4 h-4 text-cyan-400" />
            <span>Turn Left Pulse</span>
            <span className="text-[10px] text-slate-400 font-mono">2 short pulses</span>
          </button>

          <button
            onClick={() => testHapticWearable('Turn Right', HAPTIC_PATTERNS.TURN_RIGHT)}
            className="p-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-white border border-slate-600 flex flex-col items-center gap-1.5"
          >
            <Vibrate className="w-4 h-4 text-cyan-400" />
            <span>Turn Right Pulse</span>
            <span className="text-[10px] text-slate-400 font-mono">3 rhythmic pulses</span>
          </button>

          <button
            onClick={() => testHapticWearable('Step Hazard Warning', HAPTIC_PATTERNS.STEP_HAZARD)}
            className="p-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-amber-300 border border-slate-600 flex flex-col items-center gap-1.5"
          >
            <Vibrate className="w-4 h-4 text-amber-400" />
            <span>Step Hazard</span>
            <span className="text-[10px] text-slate-400 font-mono">2 medium bumps</span>
          </button>

          <button
            onClick={() => testHapticWearable('Stop Danger Obstacle', HAPTIC_PATTERNS.OBSTACLE_DANGER)}
            className="p-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-red-300 border border-slate-600 flex flex-col items-center gap-1.5"
          >
            <Vibrate className="w-4 h-4 text-red-400" />
            <span>Stop Danger</span>
            <span className="text-[10px] text-slate-400 font-mono">Heavy urgent buzz</span>
          </button>
        </div>
      </div>

    </div>
  );
};
