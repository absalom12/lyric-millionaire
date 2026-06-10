import { TranslationDictionary } from "../../i18n/translations";
import { cn, getCardStyle, getMutedText } from "../../theme/styles";
import { displayFontClass } from "../../theme/fonts";
import MoneyBadge from "../ui/MoneyBadge";
import ResultStats, { RunStats } from "./ResultStats";
import FunnyComment from "./FunnyComment";

type ResultTone = "win" | "lost" | "neutral";

export type ResultStatusView = {
  label: string;
  title: string;
  emoji: string;
  description: string;
  tone: ResultTone;
};

type ResultHeroProps = {
  result: ResultStatusView;
  moneyReached: number;
  stats: RunStats;
  modeLabel: string;
  modeValue: string;
  contentLabel: string;
  contentValue: string;
  duration: string;
  funnyComment: string;
  isLight: boolean;
  t: TranslationDictionary;
};

function getMoneyTone(money: number) {
  if (money <= 1_000) return "low";
  if (money <= 50_000) return "mid";
  return "high";
}

function getMoneyToneClass(money: number, isLight: boolean) {
  const tone = getMoneyTone(money);

  if (tone === "low") {
    return isLight ? "text-red-600" : "text-red-300";
  }

  if (tone === "mid") {
    return isLight ? "text-orange-600" : "text-orange-300";
  }

  return isLight ? "text-yellow-600" : "text-yellow-300";
}

function getMoneyGlowClass(money: number) {
  const tone = getMoneyTone(money);

  if (tone === "low") return "bg-red-500/15";
  if (tone === "mid") return "bg-orange-400/20";
  return "bg-yellow-400/25";
}

export default function ResultHero({
  result,
  moneyReached,
  stats,
  duration,
  modeLabel,
  modeValue,
  contentLabel,
  contentValue,
  funnyComment,
  isLight,
  t,
}: ResultHeroProps) {
  const moneyToneClass = getMoneyToneClass(moneyReached, isLight);
  const isWin = result.tone === "win";

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[2rem] border p-6 shadow-2xl backdrop-blur-xl sm:p-8",
        getCardStyle(isLight)
      )}
    >
      <div className={cn("pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl", getMoneyGlowClass(moneyReached))} />
      <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />

      <div className="relative grid gap-7 lg:grid-cols-[1fr_230px] lg:items-center">
        <div>
          <p
            className={cn(
              "inline-flex rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.24em]",
              isWin
                ? isLight
                  ? "border-yellow-300 bg-yellow-50 text-yellow-700"
                  : "border-yellow-400/20 bg-yellow-400/10 text-yellow-300"
                : isLight
                ? "border-orange-200 bg-orange-50 text-orange-700"
                : "border-orange-400/20 bg-orange-400/10 text-orange-300"
            )}
          >
            {result.label}
          </p>

          <div className="mt-7">
            <p className={cn("text-xs font-black uppercase tracking-[0.25em]", getMutedText(isLight))}>
              {t.result.moneyReached}
            </p>

            <div className="mt-2">
              <MoneyBadge amount={moneyReached} isLight={isLight} className={moneyToneClass} />
            </div>

            <FunnyComment comment={funnyComment} tone={result.tone} isLight={isLight} className={moneyToneClass} />
          </div>
        </div>

        <div className="relative mx-auto grid h-52 w-52 place-items-center rounded-full border border-white/10 bg-black/10 shadow-2xl lg:mx-0">
          <div className={cn("absolute inset-3 rounded-full border", isWin ? "border-yellow-400/40" : "border-orange-400/30")} />
          <div className={cn("absolute inset-8 rounded-full blur-2xl", getMoneyGlowClass(moneyReached))} />
          <div
            className={cn(
              "relative grid h-32 w-32 place-items-center rounded-full border text-7xl shadow-inner",
              isWin
                ? "border-yellow-300/50 bg-yellow-400/15"
                : "border-orange-300/40 bg-orange-400/10"
            )}
          >
            {result.emoji}
          </div>
        </div>
      </div>

      <ResultStats
        stats={stats}
        duration={duration}
        modeLabel={modeLabel}
        modeValue={modeValue}
        contentLabel={contentLabel}
        contentValue={contentValue}
        isLight={isLight}
        t={t}
      />
    </section>
  );
}
