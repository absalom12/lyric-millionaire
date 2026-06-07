import { TranslationDictionary } from "../../i18n/translations";
import { cn, getCardStyle } from "../../theme/styles";
import { displayFontClass } from "../../theme/fonts";
import { formatMoney } from "../../utils/money";

type LyricCardProps = {
  snippetId: string;
  questionIndex: number;
  snippetText: string;
  currentMoney: number;
  showCorrectMessage: boolean;
  isLight: boolean;
  t: TranslationDictionary;
};

export default function LyricCard({ questionIndex, snippetText, currentMoney, showCorrectMessage, isLight, t }: LyricCardProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-[1.75rem] border p-4 shadow-2xl backdrop-blur-xl sm:p-5", getCardStyle(isLight))}>
      <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-yellow-400/10 blur-2xl" />

      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("text-[10px] font-black uppercase tracking-[0.22em] sm:text-xs", isLight ? "text-orange-700" : "text-yellow-400")}>
            Lyrics challenge
          </p>
          <p className={cn("mt-1 text-xs font-black uppercase tracking-[0.18em]", isLight ? "text-slate-400" : "text-gray-500")}>
            Round #{questionIndex + 1}
          </p>
        </div>

        <div className={cn("shrink-0 rounded-2xl px-3 py-2 text-xs font-black sm:px-4 sm:text-sm", isLight ? "bg-orange-100 text-orange-700" : "bg-yellow-400/10 text-yellow-300")}>
          {formatMoney(currentMoney)}
        </div>
      </div>

      <blockquote className={cn("relative mt-4 text-2xl font-black leading-tight sm:text-4xl", displayFontClass)}>
        “{snippetText}”
      </blockquote>

      {showCorrectMessage && (
        <div className={cn("mt-4 rounded-2xl border p-3 text-center text-base font-black sm:text-lg", isLight ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-green-500/30 bg-green-500/10 text-green-300")}>
          {t.game.correctAnswer} ✅
        </div>
      )}
    </div>
  );
}
