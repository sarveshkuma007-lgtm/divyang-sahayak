
import { useEffect, useRef, useState, RefObject } from 'react';
import {
  FilesetResolver,
  GestureRecognizer,
  NormalizedLandmark,
} from '@mediapipe/tasks-vision';

export type HandGestureResult = {
  label: string;
  confidence: number;
  landmarks: NormalizedLandmark[];
};

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

const MIN_CONFIDENCE = 0.55;

function formatGestureName(name: string): string {
  const names: Record<string, string> = {
    Closed_Fist: 'Closed fist',
    Open_Palm: 'Open palm',
    Pointing_Up: 'Pointing up',
    Thumb_Down: 'Thumb down',
    Thumb_Up: 'Thumb up',
    Victory: 'Victory / two fingers',
    ILoveYou: 'I love you gesture',
    None: 'Hand detected — gesture not recognized',
  };

  return names[name] ?? name.replace(/_/g, ' ');
}

export function useHandGestureRecognition(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
) {
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);

  const [result, setResult] = useState<HandGestureResult | null>(null);
  const [status, setStatus] = useState('Camera off');

  useEffect(() => {
    if (!enabled) {
      setResult(null);
      setStatus('Camera off');

      if (
        typeof window !== 'undefined' &&
        'speechSynthesis' in window
      ) {
        window.speechSynthesis.cancel();
      }

      return;
    }

    let cancelled = false;
    let activeRecognizer: GestureRecognizer | null = null;

    const start = async () => {
      try {
        setStatus('Loading gesture recognition model...');

        const vision = await FilesetResolver.forVisionTasks(WASM_URL);

        const options = {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU' as const,
          },
          runningMode: 'VIDEO' as const,
          numHands: 2,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        };

        try {
          activeRecognizer =
            await GestureRecognizer.createFromOptions(vision, options);
        } catch (gpuError) {
          console.warn(
            'GPU initialization failed; trying CPU.',
            gpuError,
          );

          activeRecognizer =
            await GestureRecognizer.createFromOptions(vision, {
              ...options,
              baseOptions: {
                modelAssetPath: MODEL_URL,
                delegate: 'CPU',
              },
            });
        }

        if (cancelled) {
          activeRecognizer.close();
          activeRecognizer = null;
          return;
        }

        recognizerRef.current = activeRecognizer;
        setStatus('Ready — show your hand to the camera');

        const tick = () => {
          if (cancelled) return;

          const video = videoRef.current;
          const recognizer = recognizerRef.current;

          if (
            video &&
            recognizer &&
            video.readyState >= 2 &&
            video.videoWidth > 0 &&
            video.currentTime !== lastVideoTimeRef.current
          ) {
            lastVideoTimeRef.current = video.currentTime;

            try {
              const output = recognizer.recognizeForVideo(
                video,
                performance.now(),
              );

              const landmarks = output.landmarks?.[0];
              const categories = output.gestures?.[0] ?? [];
              const top = [...categories].sort(
                (a, b) => b.score - a.score,
              )[0];

              if (!landmarks || landmarks.length < 21) {
                setResult(null);
                setStatus(
                  'No hand detected — keep your hand fully visible',
                );
              } else if (
                top &&
                top.categoryName !== 'None' &&
                top.score >= MIN_CONFIDENCE
              ) {
                setResult({
                  label: formatGestureName(top.categoryName),
                  confidence: top.score,
                  landmarks,
                });

                setStatus(
                  `${formatGestureName(top.categoryName)} — basic gesture, not ISL translation`,
                );
              } else {
                setResult({
                  label: 'Hand detected — gesture uncertain',
                  confidence: top?.score ?? 0,
                  landmarks,
                });

                setStatus(
                  'Hand detected — no confident supported gesture',
                );
              }
            } catch (error) {
              console.warn('Gesture recognition frame failed:', error);
              setStatus('Frame recognition failed — check the console');
            }
          }

          frameRef.current = requestAnimationFrame(tick);
        };

        frameRef.current = requestAnimationFrame(tick);
      } catch (error) {
        console.error('Gesture recognizer failed to load:', error);

        if (!cancelled) {
          setStatus(
            'Model failed to load. Check internet access and the browser Network tab.',
          );
        }
      }
    };

    void start();

    return () => {
      cancelled = true;

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      recognizerRef.current = null;
      activeRecognizer?.close();
      activeRecognizer = null;
    };
  }, [enabled, videoRef]);

  return { result, status };
}
