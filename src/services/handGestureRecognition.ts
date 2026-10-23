import { useEffect, useRef, useState, RefObject } from 'react';
import { FilesetResolver, HandLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';

export type HandGestureResult = { label: string; confidence: number; landmarks: NormalizedLandmark[] };

function classifyHand(p: NormalizedLandmark[]): { label: string; confidence: number } {
  if (p.length < 21) return { label: 'Possible hand pose', confidence: 0.3 };
  // Approximate finger extension using fingertip distance from the wrist and PIP joints.
  const wrist = p[0];
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  const extended = tips.map((tip, i) => Math.hypot(p[tip].x-wrist.x,p[tip].y-wrist.y) > Math.hypot(p[pips[i]].x-wrist.x,p[pips[i]].y-wrist.y)*1.12);
  const thumbOut = Math.abs(p[4].x-p[2].x) > 0.07;
  const count = extended.filter(Boolean).length;
  if (count >= 4 && thumbOut) return { label: 'Possible hand pose: open palm', confidence: 0.55 };
  if (count === 0 && !thumbOut) return { label: 'Possible hand pose: closed fist', confidence: 0.55 };
  if (extended[0] && extended[1] && !extended[2] && !extended[3]) return { label: 'Possible hand pose: two fingers raised', confidence: 0.55 };
  if (extended[0] && !extended[1] && !extended[2] && !extended[3]) return { label: 'Possible hand pose: one finger raised', confidence: 0.5 };
  const thumbUp = p[4].y < p[3].y && p[3].y < p[2].y && count <= 1;
  if (thumbUp) return { label: 'Possible hand pose: thumb raised', confidence: 0.5 };
  return { label: 'Hand detected — sign not identified', confidence: 0.3 };
}

export function useHandGestureRecognition(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean) {
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const [result, setResult] = useState<HandGestureResult | null>(null);
  const [status, setStatus] = useState('Camera off');

  // Speak each newly detected pose once, rather than on every video frame.
  useEffect(() => {
    if (!enabled || !result?.label || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(result.label);
    utterance.lang = 'en-IN';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return () => {
      // Cancel queued speech when the recognized label changes or tracking stops.
      window.speechSynthesis.cancel();
    };
  }, [enabled, result?.label]);

  useEffect(() => {
    if (!enabled) { setStatus('Camera off'); setResult(null); return; }
    let cancelled = false;
    const run = async () => {
      try {
        setStatus('Loading hand-tracking model…');
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm');
        const modelAssetPath = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
        const options = {
          baseOptions: { modelAssetPath },
          runningMode: 'VIDEO' as const,
          numHands: 2,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        };
        // Try GPU first, then CPU in case the browser/GPU backend is unavailable.
        let landmarker: HandLandmarker;
        try {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            ...options, baseOptions: { ...options.baseOptions, delegate: 'GPU' },
          });
        } catch (gpuError) {
          console.warn('MediaPipe GPU initialization failed; retrying with CPU.', gpuError);
          landmarker = await HandLandmarker.createFromOptions(vision, {
            ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' },
          });
        }
        if (cancelled) { landmarker.close(); return; }
        landmarkerRef.current = landmarker;
        setStatus('Looking for hands…');
        const tick = () => {
          if (cancelled) return;
          const video = videoRef.current;
          const model = landmarkerRef.current;
          if (video && model && video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;
            try {
              const output = model.detectForVideo(video, performance.now());
              const points = output.landmarks?.[0];
              if (points) {
                const gesture = classifyHand(points);
                setResult({ ...gesture, landmarks: points });
                setStatus(`${gesture.label} — pose estimate only, not sign-language translation`);
              } else {
                setResult(null); setStatus('No hand detected — keep your hand fully visible in the frame');
              }
            } catch (e) { console.warn('Hand tracking frame failed', e); }
          }
          frameRef.current = requestAnimationFrame(tick);
        };
        frameRef.current = requestAnimationFrame(tick);
      } catch (error) {
        console.error('MediaPipe hand tracking failed to load:', error);
        setStatus('Hand model failed to load. Check the browser Network tab for blocked CDN/model requests, then reload.');
      }
    };
    void run();
    return () => {
      cancelled = true;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      landmarkerRef.current?.close(); landmarkerRef.current = null;
    };
  }, [enabled, videoRef]);

  return { result, status };
}
