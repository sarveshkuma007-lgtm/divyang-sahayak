import React, { useEffect, useRef, useState } from 'react';
import {
  FileText, Camera, CameraOff, ScanLine, Upload, ShieldAlert, Ear,
  Volume2, Play, Sparkles, CheckCircle2, Lock, Unlock, FileCheck,
  RotateCcw, Loader2,
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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturing, setCapturing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const t = (key: string) => getTranslation(settings.uiLanguage, key);

  // Attach the stream after React has rendered the video element.
  // This avoids the camera preview staying blank because requestAnimationFrame ran too early.
  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;

    const video = videoRef.current;
    video.srcObject = streamRef.current;
    void video.play().catch((error) => {
      console.error('Camera preview playback error:', error);
      setCameraError('Camera opened but preview could not start. Try closing and reopening the camera.');
    });

    return () => {
      // Do not stop the stream here; closing the camera is handled by stopCamera().
      video.srcObject = null;
    };
  }, [cameraOpen]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  };

  const openCamera = async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is unavailable. Use localhost or HTTPS in a supported browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (error) {
      console.error('Camera access error:', error);
      setCameraError('Could not open the camera. Allow camera permission in your browser and try again.');
    }
  };

  const processDocumentFile = async (file: File) => {
    setAnalyzing(true);
    setPrivacyConfirmed(false);
    triggerHaptic(HAPTIC_PATTERNS.CLICK);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('Could not read the image.'));
        reader.onerror = () => reject(new Error('Could not read the image.'));
        reader.readAsDataURL(file);
      });

      const result = await analyzeDocumentVision(
        base64,
        settings.uiLanguage === 'hi' ? 'Hindi' : 'English',
      );
      setScanResult(result);
      setActiveSignIdx(0);

      if (result.isPrivacyRisk) {
        triggerHaptic(HAPTIC_PATTERNS.PRIVACY_ALERT);
        speakText(result.privacyAlertMessage, settings.uiLanguage, settings.voiceSpeed);
      } else {
        triggerHaptic(HAPTIC_PATTERNS.SUCCESS);
        speakText(`Document scanned: ${result.documentType}. ${result.summary}`, settings.uiLanguage, settings.voiceSpeed);
      }
    } catch (error) {
      console.error('Document OCR failed:', error);
      setCameraError('Could not analyze this image. Please try a clearer photo or upload another image.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Existing upload handler now shares the same processing function as camera capture.
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await processDocumentFile(file);
    event.target.value = '';
  };

  const captureDocument = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('Camera is not ready yet. Wait for the preview, then capture again.');
      return;
    }
    setCapturing(true);
    setCameraError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not process the camera image.');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Image capture failed.')), 'image/jpeg', 0.92);
      });
      const file = new File([blob], `document-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
      stopCamera();
      await processDocumentFile(file);
    } catch (error) {
      console.error('Document capture failed:', error);
      setCameraError('Could not capture the document. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const loadSampleDoc = (doc: DocumentScanResult) => {
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
    if (isPlayingSignAnimation) return;
    setIsPlayingSignAnimation(true);
    let idx = 0;
    const interval = window.setInterval(() => {
      if (idx >= scanResult.signLanguageGloss.length - 1) {
        window.clearInterval(interval);
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
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-700 bg-slate-800/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white sm:text-lg">Document Scanner, Privacy Shield & Sign Translator</h2>
          </div>
          <p className="mt-1 text-xs text-slate-300">
            Scan documents with your camera or upload a photo, extract text, detect sensitive information, and view sign-language gloss.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            onClick={() => { setCameraError(''); void openCamera(); }}
            className="flex items-center gap-2 rounded-xl bg-cyan-600 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-cyan-500"
          >
            <Camera className="h-4 w-4" />
            Open Camera
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:border-cyan-500"
          >
            <Upload className="h-4 w-4" />
            Upload Photo
          </button>
        </div>
      </div>

      {cameraOpen && (
        <section className="space-y-3 rounded-2xl border border-cyan-700 bg-slate-950 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-white">Live Document Camera</h3>
              <p className="text-xs text-slate-400">LIVE PREVIEW: Hold the document inside the frame. The camera stays on until you capture or close it.</p>
            </div>
            <button type="button" onClick={stopCamera} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-800">
              <CameraOff className="h-4 w-4" /> Close Camera
            </button>
          </div>
          <video ref={videoRef} autoPlay muted playsInline className="max-h-[560px] w-full rounded-xl border border-slate-700 bg-black object-contain" />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void captureDocument()}
              disabled={capturing || analyzing}
              className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 font-bold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {capturing || analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
              {capturing ? 'Capturing…' : analyzing ? 'Analyzing document…' : 'Capture Photo & Scan'}
            </button>
            <button type="button" onClick={() => { stopCamera(); void openCamera(); }} className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm text-white hover:bg-slate-800">
              <RotateCcw className="h-4 w-4" /> Restart Camera
            </button>
          </div>
        </section>
      )}

      {cameraError && (
        <div role="alert" className="rounded-xl border border-red-800 bg-red-950/50 p-3 text-sm text-red-200">
          {cameraError}
        </div>
      )}

      {analyzing && (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-cyan-800 bg-cyan-950/30 p-4 text-sm text-cyan-100">
          <Loader2 className="h-5 w-5 animate-spin" /> Analyzing document and extracting text…
        </div>
      )}

      <div className="space-y-2">
        <span className="block text-xs font-semibold text-slate-300">Select Sample Document to Test OCR & Privacy Guard:</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SAMPLE_DOCUMENTS.map((doc) => (
            <button
              key={doc.documentType}
              type="button"
              onClick={() => loadSampleDoc(doc)}
              className={`rounded-xl border p-3 text-left transition-all ${
                scanResult.documentType === doc.documentType
                  ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400'
                  : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'
              }`}
            >
              <div className="mb-1 flex items-center justify-between text-xs font-bold text-white">
                <span>{doc.documentType}</span>
                {doc.isPrivacyRisk ? <Lock className="h-3.5 w-3.5 text-amber-400" /> : <Unlock className="h-3.5 w-3.5 text-emerald-400" />}
              </div>
              <span className={`rounded px-2 py-0.5 font-mono text-[10px] ${doc.isPrivacyRisk ? 'bg-amber-950 text-amber-300' : 'bg-emerald-950 text-emerald-300'}`}>
                {doc.documentType}
              </span>
            </button>
          ))}
        </div>
      </div>

      {scanResult.isPrivacyRisk && (
        <div className={`rounded-2xl border p-4 transition-all ${
          privacyConfirmed || hearingAidConnected ? 'border-emerald-500/40 bg-emerald-950/30' : 'border-amber-500/60 bg-amber-950/40 ring-2 ring-amber-500/30'
        }`}>
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-xl bg-amber-500/20 p-2.5 text-amber-400"><ShieldAlert className="h-6 w-6 animate-pulse" /></div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-amber-200">Privacy Protection Protocol Triggered</h3>
                <p className="text-xs leading-relaxed text-amber-300/90">{scanResult.privacyAlertMessage}</p>
                <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-300">
                  <Ear className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Bluetooth Audio Status: {hearingAidConnected ? 'Connected (Safe Private Listening)' : 'Not Connected'}</span>
                </div>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              {!hearingAidConnected && (
                <button type="button" onClick={onOpenBluetoothModal} className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-cyan-500">
                  <Ear className="h-3.5 w-3.5" /> Connect Earpiece
                </button>
              )}
              <button type="button" onClick={() => { triggerHaptic(HAPTIC_PATTERNS.CLICK); setPrivacyConfirmed(true); }} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700">
                I am in a Private Location
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-6">
          <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800/50 p-5">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <span className="flex items-center gap-1.5 font-mono text-xs text-cyan-400">
                <FileCheck className="h-4 w-4" /> Classification: {scanResult.documentType}
              </span>
              <button type="button" onClick={handleReadAloud} className="flex items-center gap-1.5 text-xs font-bold text-cyan-300 hover:text-cyan-200">
                <Volume2 className="h-4 w-4" /><span>{t('speakText')}</span>
              </button>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase text-slate-400">Easy-Read Summary</span>
              <p className="text-sm font-semibold leading-relaxed text-white" dangerouslySetInnerHTML={{ __html: formatBionic(scanResult.summary, settings.bionicReading) }} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase text-slate-400">Full Extracted Text (OCR)</span>
              <div className={`max-h-40 overflow-y-auto rounded-xl border bg-slate-900 p-3 font-mono text-xs leading-relaxed transition-all ${
                scanResult.isPrivacyRisk && !privacyConfirmed && !hearingAidConnected
                  ? 'select-none border-amber-800 blur-sm'
                  : 'border-slate-800 text-slate-200'
              }`}>{scanResult.extractedText}</div>
            </div>
            {scanResult.keyActions && scanResult.keyActions.length > 0 && (
              <div className="space-y-1 pt-1">
                <span className="block text-[11px] font-semibold uppercase text-slate-400">Next Recommended Steps</span>
                <div className="space-y-1">
                  {scanResult.keyActions.map((action, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs text-slate-200">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" /><span>{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-6">
          <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800/50 p-5">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white sm:text-sm">Sign Language Video & Avatar Conversion</h3>
              </div>
              <button type="button" onClick={playSignSequence} disabled={isPlayingSignAnimation} className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-50">
                <Play className="h-3 w-3 fill-white" /><span>{isPlayingSignAnimation ? 'Playing…' : 'Play Sign Sequence'}</span>
              </button>
            </div>
            <div className="relative flex aspect-[16/9] flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-4 text-center">
              <svg className="h-32 w-32 text-cyan-400" viewBox="0 0 100 100" fill="none" aria-label="Sign avatar illustration">
                <path d="M 35 90 L 35 55 Q 50 50 65 55 L 65 90 Z" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                <circle cx="50" cy="30" r="16" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                <circle cx="45" cy="28" r="2" fill="#38bdf8" /><circle cx="55" cy="28" r="2" fill="#38bdf8" />
                <path d="M 44 35 Q 50 39 56 35" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
                {activeSignIdx % 2 === 0 ? (
                  <><path d="M 35 60 L 20 50 L 30 35" stroke="#facc15" strokeWidth="4" strokeLinecap="round" /><circle cx="30" cy="35" r="4" fill="#facc15" /><path d="M 65 60 L 80 50 L 70 35" stroke="#facc15" strokeWidth="4" strokeLinecap="round" /><circle cx="70" cy="35" r="4" fill="#facc15" /></>
                ) : (
                  <><path d="M 35 60 L 25 70 L 35 80" stroke="#facc15" strokeWidth="4" strokeLinecap="round" /><circle cx="35" cy="80" r="4" fill="#facc15" /><path d="M 65 60 L 75 40 L 85 25" stroke="#facc15" strokeWidth="4" strokeLinecap="round" /><circle cx="85" cy="25" r="5" fill="#facc15" /></>
                )}
              </svg>
              <div className="mt-2 space-y-0.5">
                <span className="font-mono text-[10px] uppercase text-cyan-400">Current Sign Gloss ({activeSignIdx + 1} of {scanResult.signLanguageGloss.length})</span>
                <div className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-1 text-base font-extrabold tracking-widest text-white">
                  {scanResult.signLanguageGloss[activeSignIdx] || 'READY'}
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="block text-[11px] font-semibold text-slate-400">Sign Language Phrase Tokens:</span>
              <div className="flex flex-wrap gap-1.5">
                {scanResult.signLanguageGloss.map((token, index) => (
                  <button type="button" key={`${token}-${index}`} onClick={() => { triggerHaptic(HAPTIC_PATTERNS.CLICK); setActiveSignIdx(index); }} className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-bold transition-all ${
                    activeSignIdx === index ? 'scale-105 border-cyan-400 bg-cyan-500 text-slate-950' : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                  }`}>{token}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
