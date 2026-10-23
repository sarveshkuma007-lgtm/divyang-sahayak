import React, { useState, useRef } from 'react';
import { 
  FileText, 
  Camera, 
  Upload, 
  ShieldAlert, 
  Ear, 
  Volume2, 
  Play, 
  Sparkles, 
  CheckCircle2, 
  Lock, 
  Unlock,
  AlertTriangle,
  FileCheck
} from 'lucide-react';
import { SensorySettings, DocumentScanResult } from '../types';
import { getTranslation, formatBionic } from '../services/localization';
import { triggerHaptic, HAPTIC_PATTERNS } from '../services/haptics';
import { speakText } from '../services/speechService';
import { analyzeDocumentVision } from '../services/geminiService';

interface DocumentScannerModuleProps {
  settings: SensorySettings;
  hearingAidConnected: boolean;
  onOpenBluetoothModal: () => void;
}

const SAMPLE_DOCUMENTS: DocumentScanResult[] = [
  {
    documentType: 'Medical Prescription',
    isPrivacyRisk: true,
    privacyAlertMessage: 'Privacy Alert: Medical diagnoses and prescribed medication dosage detected. Please connect your Bluetooth device first or proceed to a private location.',
    extractedText: 'Patient: Ram Prakash Sharma. Age: 42. Diagnosis: Post-operative audiometric evaluation. Rx: Tablet Ciprobid 500mg - 1 tablet twice daily after food for 5 days. Otic ear drops 3 drops at night.',
    summary: 'Medical prescription for ear care. Take one antibiotic tablet morning and night after food. Put 3 ear drops before sleeping.',
    signLanguageGloss: ['PATIENT', 'DOCTOR', 'MEDICINE', 'TWO', 'TIMES', 'MORNING', 'NIGHT', 'EAR', 'DROPS', 'SLEEP'],
    keyActions: ['Take tablet with water', 'Store ear drops in cool place'],
  },
  {
    documentType: 'Bank Statement / Financial',
    isPrivacyRisk: true,
    privacyAlertMessage: 'Privacy Alert: Bank account number, salary deposit, and balance information detected. Ensure Bluetooth privacy mode is on.',
    extractedText: 'State Bank of India. Account No: XXXX-XXXX-4921. Available Balance: ₹42,850.00. Divyang Pension Credit received: ₹3,000.00 on 1st October.',
    summary: 'Bank balance statement showing available balance of ₹42,850 and monthly Divyang assistance credit.',
    signLanguageGloss: ['BANK', 'MONEY', 'ACCOUNT', 'BALANCE', 'GOVERNMENT', 'PENSION', 'RECEIVED'],
    keyActions: ['Save transaction receipt', 'Do not share OTP'],
  },
  {
    documentType: 'Public Transit Notice',
    isPrivacyRisk: false,
    privacyAlertMessage: '',
    extractedText: 'Delhi Metro Rail Corporation Public Notice: Platform 2 tactile paving renovation complete. Wheelchair ramps and tactile audio guidance at Gate 3 active 24/7.',
    summary: 'Public transit notice confirming newly renovated tactile flooring and 24/7 ramps at Gate 3.',
    signLanguageGloss: ['METRO', 'PLATFORM', 'TACTILE', 'GUIDE', 'WHEELCHAIR', 'RAMP', 'GATE', 'OPEN'],
    keyActions: ['Proceed to Gate 3 for ramp entry'],
  },
];

export const DocumentScannerModule: React.FC<DocumentScannerModuleProps> = ({
  settings,
  hearingAidConnected,
  onOpenBluetoothModal,
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [scanResult, setScanResult] = useState<DocumentScanResult>(SAMPLE_DOCUMENTS[0]);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [activeSignIdx, setActiveSignIdx] = useState(0);
  const [isPlayingSignAnimation, setIsPlayingSignAnimation] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const t = (key: string) => getTranslation(settings.uiLanguage, key);

  // File Upload OCR Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setPrivacyConfirmed(false);
    triggerHaptic(HAPTIC_PATTERNS.CLICK);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const result = await analyzeDocumentVision(base64, settings.uiLanguage === 'hi' ? 'Hindi' : 'English');
        setScanResult(result);

        if (result.isPrivacyRisk) {
          triggerHaptic(HAPTIC_PATTERNS.PRIVACY_ALERT);
          speakText(result.privacyAlertMessage, settings.uiLanguage, settings.voiceSpeed);
        } else {
          triggerHaptic(HAPTIC_PATTERNS.SUCCESS);
          speakText(`Document scanned: ${result.documentType}. ${result.summary}`, settings.uiLanguage, settings.voiceSpeed);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const loadSampleDoc = (doc: typeof SAMPLE_DOCUMENTS[0]) => {
    triggerHaptic(HAPTIC_PATTERNS.CLICK);
    setScanResult(doc);
    setPrivacyConfirmed(false);
    setActiveSignIdx(0);

    if (doc.isPrivacyRisk) {
      triggerHaptic(HAPTIC_PATTERNS.PRIVACY_ALERT);
      speakText(doc.privacyAlertMessage, settings.uiLanguage, settings.voiceSpeed);
    } else {
      speakText(`Scanned: ${doc.documentType}. ${doc.summary}`, settings.uiLanguage, settings.voiceSpeed);
    }
  };

  const handleReadAloud = () => {
    if (scanResult.isPrivacyRisk && !privacyConfirmed && !hearingAidConnected) {
      speakText(scanResult.privacyAlertMessage, settings.uiLanguage, settings.voiceSpeed);
      return;
    }
    speakText(`${scanResult.documentType}. ${scanResult.summary}. Full text: ${scanResult.extractedText}`, settings.uiLanguage, settings.voiceSpeed);
  };

  const playSignSequence = () => {
    setIsPlayingSignAnimation(true);
    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= scanResult.signLanguageGloss.length - 1) {
        clearInterval(interval);
        setIsPlayingSignAnimation(false);
      } else {
        idx++;
        setActiveSignIdx(idx);
        triggerHaptic(HAPTIC_PATTERNS.CLICK);
      }
    }, 1200);
  };

  return (
    <div className="space-y-6">
      
      {/* Module Title Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-800/50 border border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              Document Scanner, Privacy Shield & Sign Translator
            </h2>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            Extracts text from photos, identifies document sensitivity, and converts prescription/notices into animated Sign Language.
          </p>
        </div>

        {/* Upload & Camera Actions */}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Document Photo</span>
          </button>
        </div>
      </div>

      {/* Preset Document Switcher */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-slate-300 block">
          Select Sample Document to Test OCR & Privacy Guard:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {SAMPLE_DOCUMENTS.map((doc, idx) => (
            <button
              key={idx}
              onClick={() => loadSampleDoc(doc)}
              className={`p-3 rounded-xl border text-left transition-all ${
                scanResult.documentType === doc.documentType
                  ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400'
                  : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-white mb-1">
                <span>{doc.documentType}</span>
                {doc.isPrivacyRisk ? (
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                )}
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                doc.isPrivacyRisk ? 'bg-amber-950 text-amber-300' : 'bg-emerald-950 text-emerald-300'
              }`}>
                {doc.documentType}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Privacy Guard Notification Card */}
      {scanResult.isPrivacyRisk && (
        <div className={`p-4 rounded-2xl border transition-all ${
          privacyConfirmed || hearingAidConnected
            ? 'bg-emerald-950/30 border-emerald-500/40'
            : 'bg-amber-950/40 border-amber-500/60 ring-2 ring-amber-500/30'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-amber-200">
                  Privacy Protection Protocol Triggered
                </h3>
                <p className="text-xs text-amber-300/90 leading-relaxed">
                  {scanResult.privacyAlertMessage}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-slate-300 pt-1">
                  <Ear className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    Bluetooth Audio Status: {hearingAidConnected ? 'Connected (Safe Private Listening)' : 'Not Connected'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {!hearingAidConnected && (
                <button
                  onClick={onOpenBluetoothModal}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5"
                >
                  <Ear className="w-3.5 h-3.5" />
                  <span>Connect Earpiece</span>
                </button>
              )}
              <button
                onClick={() => {
                  triggerHaptic(HAPTIC_PATTERNS.CLICK);
                  setPrivacyConfirmed(true);
                }}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              >
                I am in a Private Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Analysis Display: Text OCR & Sign Language Translation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Extracted Text & Summary */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <span className="text-xs font-mono text-cyan-400 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4" />
                Classification: {scanResult.documentType}
              </span>
              <button
                onClick={handleReadAloud}
                className="flex items-center gap-1.5 text-xs font-bold text-cyan-300 hover:text-cyan-200"
              >
                <Volume2 className="w-4 h-4" />
                <span>{t('speakText')}</span>
              </button>
            </div>

            {/* Plain-Language Summary */}
            <div className="space-y-1">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Easy-Read Summary</span>
              <p 
                className="text-sm font-semibold text-white leading-relaxed"
                dangerouslySetInnerHTML={{ __html: formatBionic(scanResult.summary, settings.bionicReading) }}
              />
            </div>

            {/* Extracted OCR Text Box */}
            <div className="space-y-1">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Full Extracted Text (OCR)</span>
              <div className={`p-3 rounded-xl bg-slate-900 border text-xs font-mono leading-relaxed max-h-40 overflow-y-auto transition-all ${
                scanResult.isPrivacyRisk && !privacyConfirmed && !hearingAidConnected
                  ? 'filter blur-sm select-none border-amber-800'
                  : 'border-slate-800 text-slate-200'
              }`}>
                {scanResult.extractedText}
              </div>
            </div>

            {/* Key Action Checkpoints */}
            {scanResult.keyActions && scanResult.keyActions.length > 0 && (
              <div className="space-y-1 pt-1">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Next Recommended Steps</span>
                <div className="space-y-1">
                  {scanResult.keyActions.map((action, aIdx) => (
                    <div key={aIdx} className="flex items-center gap-2 text-xs text-slate-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Sign Language Video & Animated Avatar Breakdown */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  Sign Language Video & Avatar Conversion
                </h3>
              </div>
              <button
                onClick={playSignSequence}
                disabled={isPlayingSignAnimation}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold disabled:opacity-50"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Play Sign Sequence</span>
              </button>
            </div>

            {/* Interactive Sign Language Avatar Visualizer */}
            <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex flex-col items-center justify-center p-4 text-center">
              {/* Dynamic SVG Sign Avatar Representation */}
              <svg className="w-32 h-32 text-cyan-400" viewBox="0 0 100 100" fill="none">
                {/* Torso */}
                <path d="M 35 90 L 35 55 Q 50 50 65 55 L 65 90 Z" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                {/* Head */}
                <circle cx="50" cy="30" r="16" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                {/* Eyes & Smile */}
                <circle cx="45" cy="28" r="2" fill="#38bdf8" />
                <circle cx="55" cy="28" r="2" fill="#38bdf8" />
                <path d="M 44 35 Q 50 39 56 35" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
                {/* Animated Arms & Hands changing per sign */}
                {activeSignIdx % 2 === 0 ? (
                  // Open chest pose
                  <>
                    <path d="M 35 60 L 20 50 L 30 35" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="30" cy="35" r="4" fill="#facc15" />
                    <path d="M 65 60 L 80 50 L 70 35" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="70" cy="35" r="4" fill="#facc15" />
                  </>
                ) : (
                  // Forward wave pose
                  <>
                    <path d="M 35 60 L 25 70 L 35 80" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="35" cy="80" r="4" fill="#facc15" />
                    <path d="M 65 60 L 75 40 L 85 25" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="85" cy="25" r="5" fill="#facc15" />
                  </>
                )}
              </svg>

              {/* Current Sign Gloss Display */}
              <div className="mt-2 space-y-0.5">
                <span className="text-[10px] font-mono text-cyan-400 uppercase">
                  Current Sign Gloss ({activeSignIdx + 1} of {scanResult.signLanguageGloss.length})
                </span>
                <div className="text-base font-extrabold text-white tracking-widest bg-slate-900 px-4 py-1 rounded-lg border border-slate-700">
                  {scanResult.signLanguageGloss[activeSignIdx] || 'READY'}
                </div>
              </div>
            </div>

            {/* Sign Language Gloss Interactive Chips */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400 font-semibold block">Sign Language Phrase Tokens:</span>
              <div className="flex flex-wrap gap-1.5">
                {scanResult.signLanguageGloss.map((token, gIdx) => (
                  <button
                    key={gIdx}
                    onClick={() => {
                      triggerHaptic(HAPTIC_PATTERNS.CLICK);
                      setActiveSignIdx(gIdx);
                    }}
                    className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition-all ${
                      activeSignIdx === gIdx
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 scale-105'
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
