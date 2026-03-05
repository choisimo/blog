/**
 * Haptic Feedback Utility
 * Provides tactile feedback on supported mobile devices
 */

type HapticPattern = 'light' | 'medium' | 'success' | 'error' | 'warning';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 25,
  success: [10, 50, 10],
  error: [50, 100, 50],
  warning: [25, 50, 25],
};

/**
 * Check if the Vibration API is supported
 */
export function isHapticSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Trigger haptic feedback with the specified pattern
 * @param pattern - The haptic pattern to use
 * @returns true if vibration was triggered, false otherwise
 */
export function haptic(pattern: HapticPattern = 'light'): boolean {
  if (!isHapticSupported()) return false;
  
  try {
    const vibrationPattern = PATTERNS[pattern];
    return navigator.vibrate(vibrationPattern);
  } catch {
    return false;
  }
}

/**
 * Light tap feedback for button presses
 */
export function hapticLight(): boolean {
  return haptic('light');
}

/**
 * Medium feedback for significant actions
 */
export function hapticMedium(): boolean {
  return haptic('medium');
}

/**
 * Success feedback pattern
 */
export function hapticSuccess(): boolean {
  return haptic('success');
}

/**
 * Error feedback pattern
 */
export function hapticError(): boolean {
  return haptic('error');
}

/**
 * Warning feedback pattern
 */
export function hapticWarning(): boolean {
  return haptic('warning');
}

/**
 * Cancel any ongoing vibration
 */
export function hapticCancel(): boolean {
  if (!isHapticSupported()) return false;
  return navigator.vibrate(0);
}
