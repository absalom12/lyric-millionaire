import { TranslationDictionary } from "../../i18n/translations";
import StatCard from "../ui/StatCard";

export type RunStats = {
  correct: number;
  total: number;
  pct: number;
};

type ResultStatsProps = {
  stats: RunStats;
  duration: string;
  modeLabel: string;
  modeValue: string;
  contentLabel: string;
  contentValue: string;
  isLight: boolean;
  t: TranslationDictionary;
};

export default function ResultStats({
  stats: _stats,
  duration,
  modeLabel,
  modeValue,
  contentLabel,
  contentValue,
  isLight,
  t,
}: ResultStatsProps) {
  return (
    <div className="mt-5 grid grid-cols-3 gap-3">
      <StatCard label={t.result.time} value={duration} isLight={isLight} />
      <StatCard label={modeLabel} value={modeValue} isLight={isLight} />
      <StatCard label={contentLabel} value={contentValue} isLight={isLight} />
    </div>
  );
}
