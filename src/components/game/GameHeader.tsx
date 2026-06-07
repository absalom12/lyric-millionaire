import { TranslationDictionary } from "../../i18n/translations";
import { cn, getAccentText, getMutedText } from "../../theme/styles";
import { formatMoney } from "../../utils/money";

type GameHeaderProps = {
  currentQuestionIndex: number;
  totalQuestions: number;
  currentMoney: number;
  isLight: boolean;
  t: TranslationDictionary;
};

export default function GameHeader({
  currentQuestionIndex,
  totalQuestions,
  currentMoney,
  isLight,
  t,
}: GameHeaderProps) {
  return (
    <div
      className={cn(
        "mb-3 rounded-[1.75rem] border px-4 py-4 shadow-xl backdrop-blur md:px-6 md:py-5",
        isLight
          ? "border-orange-200 bg-white/75 shadow-orange-100/70"
          : "border-white/10 bg-white/[0.055] shadow-black/30"
      )}
    >
      <div className="flex flex-col gap-2">
        <p className={cn("text-[11px] font-black uppercase tracking-[0.26em]", getAccentText(isLight))}>
          🎵 {t.game.question} {currentQuestionIndex + 1}/{totalQuestions}
        </p>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className={cn("text-xs font-extrabold uppercase tracking-[0.18em]", getMutedText(isLight))}>
              {t.result.moneyReached}
            </p>
            <h1 className="mt-1 text-4xl font-black leading-none tracking-tight sm:text-5xl">
              {formatMoney(currentMoney)}
            </h1>
          </div>
        </div>

        <p className={cn("text-sm font-bold", getMutedText(isLight))}>{t.game.ladderHint}</p>
      </div>
    </div>
  );
}
