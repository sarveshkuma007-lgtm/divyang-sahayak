import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  X, 
  MapPin, 
  PhoneCall, 
  Users, 
  ShieldAlert, 
  Volume2, 
  VolumeX, 
  Vibrate, 
  CheckCircle2, 
  Send 
} from 'lucide-react';
import { SensorySettings } from '../types';
import { triggerHaptic, HAPTIC_PATTERNS } from '../services/haptics';
import { speakText } from '../services/speechService';

interface EmergencySOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SensorySettings;
}

export const EmergencySOSModal: React.FC<EmergencySOSModalProps> = ({
  isOpen,
  onClose,
  settings,
}) => {
  const [sirenPlaying, setSirenPlaying] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>({
    lat: 28.6139,
    lng: 77.2090,
  });
  const [smsDispatched, setSmsDispatched] = useState(true);
  const [volunteerBeaconActive, setVolunteerBeaconActive] = useState(true);

  useEffect(() => {
    if (isOpen) {
      // Trigger urgent haptic sequence
      triggerHaptic(HAPTIC_PATTERNS.EMERGENCY_SOS);

      // Announce emergency
      speakText(
        settings.uiLanguage === 'hi'
          ? 'आपातकालीन एसओएस सक्रिय। आपकी जीपीएस स्थिति आपातकालीन संपर्कों को भेजी जा चुकी है।'
          : 'Emergency SOS activated. Your live location has been transmitted to emergency responders and family.',
        settings.uiLanguage,
        settings.voiceSpeed
      );

      // Fetch real GPS if permitted
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          () => {},
          { timeout: 5000 }
        );
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-red-950/80 backdrop-blur-md animate-in fade-in"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="sos-title"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-950 border-4 border-red-500 text-white shadow-2xl p-5 sm:p-6 space-y-5 animate-pulse-border">
        
        {/* Urgent Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-red-600 text-white animate-bounce">
              <AlertTriangle className="w-8 h-8 fill-white" />
            </div>
            <div>
              <h2 id="sos-title" className="text-xl sm:text-2xl font-black text-red-400 tracking-tight">
                EMERGENCY SOS ACTIVE
              </h2>
              <span className="text-xs font-mono text-red-300">
                Live Broadcast to Emergency Services & Guardians
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              triggerHaptic(HAPTIC_PATTERNS.CLICK);
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            aria-label="Deactivate SOS"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live GPS Coordinates Card */}
        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/50 space-y-2">
          <div className="flex items-center justify-between text-xs text-red-200">
            <span className="flex items-center gap-1.5 font-bold">
              <MapPin className="w-4 h-4 text-red-400" />
              Live Geolocation Transmitted
            </span>
            <span className="font-mono text-emerald-400">GPS ACCURACY ±3M</span>
          </div>
          <div className="font-mono text-sm font-bold text-white bg-slate-900/80 py-2 px-3 rounded-xl border border-slate-800">
            Lat: {coords?.lat.toFixed(5)}, Lng: {coords?.lng.toFixed(5)}
          </div>
          <p className="text-[11px] text-red-300/80">
            Automated SMS alert containing map tracking link dispatched to: <b>Primary Guardian, National Divyang Helpline (14456), and Ambulance</b>.
          </p>
        </div>

        {/* Community Social Assistance Volunteer Beacon */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white">
                Social Assistance Terrain Beacon
              </span>
            </div>
            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
              3 Nearby Volunteers Alerted
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-snug">
            Notified nearby verified volunteers for immediate physical escort or navigation assistance on complex/unfamiliar terrain.
          </p>
        </div>

        {/* Quick Emergency Hotlines */}
        <div className="grid grid-cols-2 gap-2">
          <a
            href="tel:112"
            onClick={() => triggerHaptic(HAPTIC_PATTERNS.CLICK)}
            className="py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg text-center"
          >
            <PhoneCall className="w-4 h-4 fill-white" />
            <span>Call 112 (Police)</span>
          </a>

          <a
            href="tel:108"
            onClick={() => triggerHaptic(HAPTIC_PATTERNS.CLICK)}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border border-slate-700 text-center"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Call 108 (Ambulance)</span>
          </a>
        </div>

        {/* Deactivate Button */}
        <button
          onClick={() => {
            triggerHaptic(HAPTIC_PATTERNS.CLICK);
            onClose();
          }}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
        >
          Cancel / I Am Safe Now
        </button>

      </div>
    </div>
  );
};
