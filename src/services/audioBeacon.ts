/**
 * Web Audio API Acoustic Radar & Spatial Soundscape Engine
 * Provides audio beacons for blind navigation and binaural soundscapes for the VR travel mode.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays an obstacle proximity beacon tone.
 * High pitch and rapid frequency indicates an obstacle very close.
 */
export function playObstacleBeacon(distanceMeters: number, position: 'left' | 'center' | 'right' = 'center') {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    // Distance mapping: Closer = Higher frequency (more urgent)
    const normalizedDist = Math.max(0.3, Math.min(5, distanceMeters));
    const frequency = 880 - (normalizedDist * 80); // ~480Hz at 5m up to 850Hz at 0.3m
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Pan audio left or right
    if (pan) {
      if (position === 'left') pan.pan.setValueAtTime(-0.8, ctx.currentTime);
      else if (position === 'right') pan.pan.setValueAtTime(0.8, ctx.currentTime);
      else pan.pan.setValueAtTime(0, ctx.currentTime);
      osc.connect(pan);
      pan.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(ctx.destination);

    // Short tactile acoustic beep
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {
    console.warn('Audio beacon error', e);
  }
}

/**
 * Plays directional turn navigation cue (Left low-to-high swoop, Right high-to-low swoop, Danger buzzer).
 */
export function playTurnCue(direction: 'left' | 'right' | 'straight' | 'stop') {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (direction === 'left') {
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.25);
    } else if (direction === 'right') {
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.25);
    } else if (direction === 'stop') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
    } else {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5 clean chime
    }

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  } catch {
    // Ignore if audio is restricted
  }
}

/**
 * Synthesizes ambient VR soundscapes for "Close Your Eyes and Travel Anywhere"
 */
let ambientNodes: { osc?: OscillatorNode; gain?: GainNode; noiseSource?: AudioNode }[] = [];

export function stopAmbientSoundscape() {
  ambientNodes.forEach(node => {
    try {
      if (node.osc) node.osc.stop();
    } catch {}
  });
  ambientNodes = [];
}

export function playAmbientSoundscape(type: 'metro' | 'airport' | 'garden' | 'market' | 'temple') {
  stopAmbientSoundscape();
  try {
    const ctx = getAudioContext();

    if (type === 'metro') {
      // Sub-bass train rumble + platform hum
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(65, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      ambientNodes.push({ osc, gain });

      // Subtle track rhythmic click
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.frequency.setValueAtTime(120, ctx.currentTime);
      clickGain.gain.setValueAtTime(0.02, ctx.currentTime);
      clickOsc.connect(clickGain);
      clickGain.connect(ctx.destination);
      clickOsc.start();
      ambientNodes.push({ osc: clickOsc, gain: clickGain });
    } else if (type === 'garden') {
      // Gentle wind breeze / nature harmonics
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(432, ctx.currentTime); // 432 Hz healing tone
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      ambientNodes.push({ osc, gain });
    } else if (type === 'temple') {
      // Singing bowl / serene harmonic chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(528, ctx.currentTime); // 528 Hz resonant bell
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      ambientNodes.push({ osc, gain });
    } else {
      // General urban air ambient
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(110, ctx.currentTime);
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      ambientNodes.push({ osc, gain });
    }
  } catch (e) {
    console.warn('Could not start ambient audio', e);
  }
}
