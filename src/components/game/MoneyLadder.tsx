import { TranslationDictionary } from "../../i18n/translations";
import { cn } from "../../theme/styles";
import { MONEY_LADDER, formatMoney } from "../../utils/money";

 type MoneyLadderProps = {
  currentIndex: number;
  celebrateIndex: number | null;
  isBreaking: boolean;
  isLight: boolean;
  t: TranslationDictionary;
};

export default function MoneyLadder({ currentIndex, celebrateIndex, isBreaking, isLight, t }: MoneyLadderProps) {
  const currentAmount = MONEY_LADDER[currentIndex] ?? MONEY_LADDER[0];
  const nextAmount = MONEY_LADDER[currentIndex + 1];
  const jackpotProgress = ((currentIndex + 1) / MONEY_LADDER.length) * 100;

  return (
    <>
      <div className={cn("mt-3 rounded-[1.5rem] border p-3 shadow-xl backdrop-blur-xl lg:hidden", isLight ? "border-orange-200 bg-white/85 shadow-orange-100/70" : "border-white/10 bg-white/[0.045] shadow-black/30")}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className={cn("text-[10px] font-black uppercase tracking-[0.22em]", isLight ? "text-orange-700" : "text-yellow-400")}>💰 {t.game.moneyLadder}</p>
          <p className="text-sm font-black">{formatMoney(currentAmount)}</p>
        </div>
        <div className={cn("h-2 overflow-hidden rounded-full", isLight ? "bg-orange-100" : "bg-white/10")}>
          <div className={cn("h-full rounded-full", isLight ? "bg-orange-500" : "bg-yellow-400")} style={{ width: `${jackpotProgress}%` }} />
        </div>
        {nextAmount && (
          <p className={cn("mt-2 text-xs font-bold", isLight ? "text-slate-500" : "text-gray-400")}>Next: {formatMoney(nextAmount)}</p>
        )}
      </div>

      <aside className={cn("relative hidden w-full overflow-hidden rounded-[2rem] border p-5 shadow-2xl backdrop-blur-xl transition-all lg:block", isLight ? "border-orange-200 bg-white/85 shadow-orange-200/50" : "border-white/10 bg-gray-950/80 shadow-black/50", isBreaking ? "ladder-breaking" : "") }>
        {isBreaking && <div className="absolute inset-0 bg-red-500/10" />}

        <div className="relative mb-5">
          <p className={cn("text-[11px] font-black uppercase tracking-[0.25em]", isLight ? "text-orange-700" : "text-yellow-400")}>{t.game.moneyLadder}</p>
          <p className={cn("mt-2 text-sm font-bold", isLight ? "text-slate-500" : "text-gray-500")}>{t.game.ladderHint}</p>
        </div>

        <div className="relative flex flex-col-reverse gap-2.5">
          {MONEY_LADDER.map((amount, index) => {
            const isCurrent = index === currentIndex;
            const isPassed = index < currentIndex;
            const shouldCelebrate = celebrateIndex === index;
            const widthPercent = 70 + index * 3;
            const scale = 1 + index * 0.014;

            return (
              <div
                key={amount}
                className={cn(
                  "relative flex items-center justify-center rounded-2xl border px-4 py-3 text-sm transition-all duration-500",
                  isCurrent
                    ? isLight
                      ? "border-orange-500 bg-orange-500 text-black shadow-xl shadow-orange-300/50"
                      : "border-yellow-400 bg-yellow-400 text-black shadow-xl shadow-yellow-400/30"
                    : isPassed
                    ? isLight
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-green-500/30 bg-green-500/10 text-green-300"
                    : isLight
                    ? "border-orange-100 bg-white/60 text-slate-500"
                    : "border-white/10 bg-white/[0.035] text-gray-400",
                  amount === 1_000_000 ? "million-glow" : "",
                  shouldCelebrate ? "ladder-correct-pulse ladder-unlock-glow" : "",
                  isBreaking && !isPassed && !isCurrent ? "opacity-30 blur-[1px]" : ""
                )}
                style={{ width: `${widthPercent}%`, transform: `scale(${scale})`, alignSelf: "center" }}
              >
                {shouldCelebrate && <span className="ladderCoinBurst absolute -top-3 left-1/2 -translate-x-1/2 text-xl">🪙</span>}
                <span className="font-black">{formatMoney(amount)}</span>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
