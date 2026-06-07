import { useEffect, useRef, useState } from "react";

export function useQuestionTimer({
  duration,
  enabled,
  onExpire,
}: {
  duration: number;
  enabled: boolean;
  onExpire: () => void;
}) {
  const safeDuration = Math.max(1, duration);
  const [timeLeft, setTimeLeft] = useState(safeDuration);
  const [progress, setProgress] = useState(1); // 1 → 0

  const onExpireRef = useRef(onExpire);
  const expiredRef = useRef(false);

  onExpireRef.current = onExpire;

  useEffect(() => {
    setTimeLeft(safeDuration);
    setProgress(1);
    expiredRef.current = false;
  }, [safeDuration, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const startedAt = Date.now();
    const endsAt = startedAt + safeDuration * 1000;

    setTimeLeft(safeDuration);
    setProgress(1);
    expiredRef.current = false;

    const tick = () => {
      const now = Date.now();
      const remainingMs = Math.max(0, endsAt - now);
      const nextProgress = remainingMs / (safeDuration * 1000);
      const nextTimeLeft = Math.ceil(remainingMs / 1000);

      setProgress(Math.max(0, Math.min(1, nextProgress)));
      setTimeLeft(nextTimeLeft);

      if (remainingMs <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current();
      }
    };

    tick();
    const interval = window.setInterval(tick, 100);

    return () => window.clearInterval(interval);
  }, [enabled, safeDuration]);

  const isUrgent = timeLeft <= 5;

  return { timeLeft, progress, isUrgent };
}
