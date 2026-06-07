import { cn } from "../../theme/styles";

type TimerBarProps = {
  progress: number;
  timeLeft: number;
  isUrgent: boolean;
  isLight: boolean;
};

function normalizeProgress(progress: number) {
  if (!Number.isFinite(progress)) return 0;

  // Compatible with both formats:
  // - 1 → 0 from useQuestionTimer
  // - 100 → 0 from older patches
  const percent = progress <= 1 ? progress * 100 : progress;

  return Math.max(0, Math.min(100, percent));
}

export default function TimerBar({ progress, timeLeft, isUrgent, isLight }: TimerBarProps) {
  const percent = normalizeProgress(progress);

  return (
    <div className="mt-4">
      <div
        className={cn(
          "mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.22em]",
          isUrgent ? "text-red-400" : isLight ? "text-orange-700" : "text-yellow-400"
        )}
      >
        <span>Timer</span>
        <span>{timeLeft}s</span>
      </div>

      <div className={cn("h-3 overflow-hidden rounded-full", isLight ? "bg-orange-100" : "bg-white/10")}>
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-100 ease-linear",
            isUrgent ? "bg-red-500" : isLight ? "bg-orange-500" : "bg-yellow-400"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
