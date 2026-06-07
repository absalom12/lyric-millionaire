import { TranslationDictionary } from "../../i18n/translations";
import StatCard from "../ui/StatCard";

export type RunStats = {
  correct: number;
  total: number;
  pct: number;
  averageDifficulty: number;
  totalStreams: number;
  averageStreams: number;
};

type ResultStatsProps = {
  stats: RunStats;
  jokersUsed: number;
  duration: string;
  modeLabel: string;
  modeValue: string;
  isLight: boolean;
  t: TranslationDictionary;
};

function formatAverageDifficulty(value: number) {
  if (!value) return "—";
  return `${value.toFixed(1)}/5`;
}

export default function ResultStats({
  stats,
  jokersUsed,
  duration,
  modeLabel,
  modeValue,
  isLight,
  t,
}: ResultStatsProps) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label={t.result.jokers} value={jokersUsed} isLight={isLight} />
      <StatCard label={t.result.time} value={duration} isLight={isLight} />
      <StatCard label={modeLabel} value={modeValue} isLight={isLight} />
      <StatCard
        label={t.result.avgDifficulty}
        value={formatAverageDifficulty(stats.averageDifficulty)}
        isLight={isLight}
      />
    </div>
  );
}
