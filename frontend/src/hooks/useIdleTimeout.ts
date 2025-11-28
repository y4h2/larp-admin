import { useEffect, useRef, useCallback } from 'react';

const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Hook to detect user inactivity and trigger a callback after timeout.
 *
 * @param isActive - Whether the timeout monitoring is active (e.g., when editing)
 * @param onTimeout - Callback to execute when timeout occurs
 *
 * Behavior:
 * - When isActive is true, starts monitoring user activity
 * - Resets timer on mousemove, keydown events
 * - Immediately triggers onTimeout when page becomes hidden (tab switch)
 * - Triggers onTimeout after 2 minutes of inactivity
 */
export function useIdleTimeout(
  isActive: boolean,
  onTimeout: () => void
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTimeoutRef = useRef(onTimeout);

  // Keep onTimeoutRef up to date to avoid stale closures
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (isActive) {
      timeoutRef.current = setTimeout(() => {
        onTimeoutRef.current();
      }, IDLE_TIMEOUT_MS);
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Start timer
    resetTimer();

    // Listen for user activity
    const handleActivity = () => resetTimer();

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);

    // Page visibility change detection - immediate release on page switch
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page hidden - immediately trigger timeout
        onTimeoutRef.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive, resetTimer]);
}
