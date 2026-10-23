/**
 * Tactile Haptic Vibration Engine for Divyang & Deaf-Blind users.
 * Supports standard vibration patterns for spatial navigation, hazard alarms, and confirmations.
 */

export const HAPTIC_PATTERNS = {
  // Navigation turns
  TURN_LEFT: [120, 60, 120],
  TURN_RIGHT: [80, 40, 80, 40, 80],
  STRAIGHT: [150],
  SLIGHT_TURN: [80, 60, 80],
  ARRIVED: [150, 80, 150, 80, 300],

  // Hazard & Warning
  OBSTACLE_DANGER: [400, 100, 400, 100, 400],
  STEP_HAZARD: [250, 80, 250],
  EMERGENCY_SOS: [500, 150, 500, 150, 500, 150, 1000],

  // Confirmations
  SUCCESS: [100, 50, 100],
  CURRENCY_DETECTED: [200, 80, 200],
  CLICK: [40],
  PRIVACY_ALERT: [200, 100, 200, 100, 300],
};

export function triggerHaptic(pattern: number[] | number): boolean {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      return navigator.vibrate(pattern);
    } catch {
      return false;
    }
  }
  return false;
}
