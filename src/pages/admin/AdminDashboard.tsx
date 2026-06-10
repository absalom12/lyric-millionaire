import { useEffect, useMemo, useState } from "react";
import { db, collection, getDocs } from "../../lib/firebase";
import { GameRun, GameQuestion } from "../../types/index";

type GameRunWithId = GameRun & {
  id: string;
  language?: string;
  shareClicks?: number;
  shareButtonClicks?: number;
};

type ModeFilter = "all" | "global-hits" | "artist-of-the-day";

type LanguageCode = "en" | "fr" | "pt" | "es" | "unknown";

type LanguageReachStats = {
  language: LanguageCode;
  label: string;
  runs: number;
  percentage: number;
  shareClicks: number;
  shareRate: number;
  last7Runs: number;
};

type DailyMetric = {
  date: string;
  label: string;
  launched: number;
  completed: number;
  stopped: number;
  averageTimeMs: number;
  shareClicks: number;
};

type ProblemQuestion = {
  key: string;
  snippetText: string;
  correctTitle: string;
  correctArtist: string;
  attempts: number;
  failures: number;
  successRate: number;
};

type ProblemSong = {
  key: string;
  title: string;
  artistName: string;
  attempts: number;
  failures: number;
  successRate: number;
};

function timestampToMillis(value: any): number {
  return value?.toMillis?.() ?? 0;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

function formatDuration(ms: number): string {
  if (!ms || !Number.isFinite(ms)) return "—";

  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes <= 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatDateTime(value: any): string {
  const millis = timestampToMillis(value);

  if (!millis) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(millis));
}

function getDateKeyFromMillis(ms: number): string {
  const date = new Date(ms);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getShortDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function getLastNDays(days: number): string[] {
  const result: string[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    result.push(getDateKeyFromMillis(date.getTime()));
  }

  return result;
}

function isCompletedRun(run: GameRun): boolean {
  return run.status !== "in_progress" || !!run.endedAt;
}

function isStoppedRun(run: GameRun): boolean {
  return !isCompletedRun(run);
}

function getAttemptedQuestions(run: GameRun): GameQuestion[] {
  return run.questions?.filter((question) => !!question.selectedSongId) ?? [];
}

function getCompletionTone(value: number): "green" | "yellow" | "red" {
  if (value >= 70) return "green";
  if (value >= 40) return "yellow";
  return "red";
}

function getAccuracyTone(value: number): "green" | "yellow" | "red" {
  if (value >= 70) return "green";
  if (value >= 45) return "yellow";
  return "red";
}

function getShareClicks(run: GameRunWithId): number {
  return Number(run.shareClicks ?? run.shareButtonClicks ?? 0);
}

function filterRunsByMode(runs: GameRunWithId[], modeFilter: ModeFilter) {
  if (modeFilter === "all") return runs;
  return runs.filter((run) => run.modeSlug === modeFilter);
}

function getModeLabel(mode: ModeFilter): string {
  if (mode === "global-hits") return "Global Hits";
  if (mode === "artist-of-the-day") return "Artist of the Day";
  return "Tous les modes";
}

function getRunLanguage(run: GameRunWithId): LanguageCode {
  const language = run.language;

  if (
    language === "en" ||
    language === "fr" ||
    language === "pt" ||
    language === "es"
  ) {
    return language;
  }

  return "unknown";
}

function getLanguageLabel(language: LanguageCode): string {
  if (language === "en") return "English";
  if (language === "fr") return "Français";
  if (language === "pt") return "Português";
  if (language === "es") return "Español";
  return "Unknown";
}

function getLanguageBadgeClass(language: LanguageCode): string {
  if (language === "en") return "bg-blue-500/15 text-blue-300 border-blue-500/25";
  if (language === "fr") return "bg-yellow-400/15 text-yellow-300 border-yellow-400/25";
  if (language === "pt") return "bg-green-500/15 text-green-300 border-green-500/25";
  if (language === "es") return "bg-purple-500/15 text-purple-300 border-purple-500/25";
  return "bg-white/[0.06] text-gray-300 border-white/10";
}

function getLanguageBarClass(language: LanguageCode): string {
  if (language === "en") return "bg-blue-500";
  if (language === "fr") return "bg-yellow-400";
  if (language === "pt") return "bg-green-500";
  if (language === "es") return "bg-purple-500";
  return "bg-gray-500";
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "green" | "yellow" | "red" | "purple";
}) {
  const valueClass =
    tone === "green"
      ? "text-green-400"
      : tone === "yellow"
      ? "text-yellow-400"
      : tone === "red"
      ? "text-red-400"
      : tone === "purple"
      ? "text-purple-400"
      : "text-white";

  return (
    <div className="bg-gray-950/70 border border-white/10 rounded-2xl p-5 shadow-lg shadow-black/20">
      <p className="text-gray-500 text-xs font-bold uppercase tracking-wide">
        {label}
      </p>

      <p className={`${valueClass} text-3xl font-black mt-2`}>
        {value}
      </p>

      {hint && (
        <p className="text-gray-600 text-xs mt-2">
          {hint}
        </p>
      )}
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h3 className="text-xl font-black text-white tracking-tight">
        {title}
      </h3>

      {subtitle && (
        <p className="text-sm text-gray-500 mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
      {label}
    </div>
  );
}

function LineChart({
  title,
  data,
  valueKey,
  formatter,
}: {
  title: string;
  data: DailyMetric[];
  valueKey: keyof DailyMetric;
  formatter: (value: number) => string;
}) {
  const values = data.map((item) => Number(item[valueKey] ?? 0));
  const maxValue = Math.max(...values, 1);

  const width = 720;
  const height = 260;
  const paddingX = 42;
  const paddingY = 36;

  const points = data.map((item, index) => {
    const x =
      paddingX +
      (index / Math.max(data.length - 1, 1)) * (width - paddingX * 2);

    const rawValue = Number(item[valueKey] ?? 0);
    const y =
      height -
      paddingY -
      (rawValue / maxValue) * (height - paddingY * 2);

    return {
      x,
      y,
      value: rawValue,
      label: item.label,
    };
  });

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const hasData = values.some((value) => value > 0);

  return (
    <div className="bg-gray-950/70 border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/20 flex flex-col gap-4">
      <SectionTitle title={title} />

      {!hasData ? (
        <EmptyChartState label="Pas encore assez de données pour afficher ce graphique." />
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="min-w-[720px] w-full h-72"
          >
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y =
                height -
                paddingY -
                ratio * (height - paddingY * 2);

              return (
                <g key={ratio}>
                  <line
                    x1={paddingX}
                    x2={width - paddingX}
                    y1={y}
                    y2={y}
                    stroke="rgba(255,255,255,0.08)"
                  />
                  <text
                    x={8}
                    y={y + 4}
                    fill="rgba(156,163,175,0.7)"
                    fontSize="10"
                  >
                    {formatter(maxValue * ratio)}
                  </text>
                </g>
              );
            })}

            <path
              d={path}
              fill="none"
              stroke="#facc15"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {points.map((point) => (
              <g key={`${point.label}-${point.x}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="5"
                  fill="#facc15"
                />

                <text
                  x={point.x}
                  y={height - 10}
                  textAnchor="middle"
                  fill="rgba(156,163,175,0.75)"
                  fontSize="10"
                >
                  {point.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}

function MultiBarChart({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle?: string;
  data: DailyMetric[];
}) {
  const maxValue = Math.max(
    ...data.map((item) => Math.max(item.launched, item.completed, item.stopped)),
    1
  );

  const hasData = data.some(
    (item) => item.launched > 0 || item.completed > 0 || item.stopped > 0
  );

  return (
    <div className="bg-gray-950/70 border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/20 flex flex-col gap-4">
      <SectionTitle title={title} subtitle={subtitle} />

      {!hasData ? (
        <EmptyChartState label="Aucune partie créée sur la période sélectionnée." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <span className="bg-yellow-400/15 text-yellow-300 border border-yellow-400/25 rounded-full px-3 py-1 text-xs font-bold">
              Lancées
            </span>
            <span className="bg-green-500/15 text-green-300 border border-green-500/25 rounded-full px-3 py-1 text-xs font-bold">
              Terminées
            </span>
            <span className="bg-red-500/15 text-red-300 border border-red-500/25 rounded-full px-3 py-1 text-xs font-bold">
              Arrêtées
            </span>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[720px] h-72 flex items-end gap-3 border-b border-white/10 pt-8">
              {data.map((item) => {
                const launchedHeight = (item.launched / maxValue) * 210;
                const completedHeight = (item.completed / maxValue) * 210;
                const stoppedHeight = (item.stopped / maxValue) * 210;

                return (
                  <div
                    key={item.date}
                    className="flex-1 flex flex-col items-center justify-end gap-2"
                  >
                    <div className="h-[220px] flex items-end gap-1">
                      <div
                        title={`Lancées : ${item.launched}`}
                        className="w-3 rounded-t-lg bg-yellow-400/80"
                        style={{ height: `${Math.max(launchedHeight, item.launched ? 6 : 0)}px` }}
                      />
                      <div
                        title={`Terminées : ${item.completed}`}
                        className="w-3 rounded-t-lg bg-green-500/80"
                        style={{ height: `${Math.max(completedHeight, item.completed ? 6 : 0)}px` }}
                      />
                      <div
                        title={`Arrêtées : ${item.stopped}`}
                        className="w-3 rounded-t-lg bg-red-500/80"
                        style={{ height: `${Math.max(stoppedHeight, item.stopped ? 6 : 0)}px` }}
                      />
                    </div>

                    <p className="text-[10px] text-gray-500">
                      {item.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [gameRuns, setGameRuns] = useState<GameRunWithId[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [daysRange, setDaysRange] = useState(14);

  const loadDashboardData = async () => {
    setLoading(true);
    setErrors([]);

    try {
      const gameRunsSnap = await getDocs(collection(db, "gameRuns"));

      const runs = gameRunsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as GameRunWithId[];

      runs.sort(
        (a, b) => timestampToMillis(b.startedAt) - timestampToMillis(a.startedAt)
      );

      setGameRuns(runs);
    } catch (err) {
      setErrors([`Erreur chargement dashboard : ${String(err)}`]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const filteredRuns = useMemo(() => {
    return filterRunsByMode(gameRuns, modeFilter);
  }, [gameRuns, modeFilter]);

  const dailyMetrics = useMemo<DailyMetric[]>(() => {
    const days = getLastNDays(daysRange);

    return days.map((date) => {
      const runsForDay = filteredRuns.filter((run) => {
        const startedAtMillis = timestampToMillis(run.startedAt);
        if (!startedAtMillis) return false;

        return getDateKeyFromMillis(startedAtMillis) === date;
      });

      const completedRuns = runsForDay.filter(isCompletedRun);
      const stoppedRuns = runsForDay.filter(isStoppedRun);

      const runsWithTime = completedRuns.filter((run) => !!run.totalTimeMs);
      const totalTimeMs = runsWithTime.reduce(
        (sum, run) => sum + (run.totalTimeMs ?? 0),
        0
      );

      const shareClicks = runsForDay.reduce(
        (sum, run) => sum + getShareClicks(run),
        0
      );

      return {
        date,
        label: getShortDateLabel(date),
        launched: runsForDay.length,
        completed: completedRuns.length,
        stopped: stoppedRuns.length,
        averageTimeMs: runsWithTime.length ? totalTimeMs / runsWithTime.length : 0,
        shareClicks,
      };
    });
  }, [filteredRuns, daysRange]);

  const gameplayStats = useMemo(() => {
    const completedRuns = filteredRuns.filter(isCompletedRun);
    const stoppedRuns = filteredRuns.filter(isStoppedRun);

    const totalScore = completedRuns.reduce(
      (sum, run) => sum + (run.score ?? 0),
      0
    );

    const averageScore = completedRuns.length
      ? totalScore / completedRuns.length
      : 0;

    const attemptedQuestions = completedRuns.flatMap(getAttemptedQuestions);

    const correctAnswers = attemptedQuestions.filter(
      (question) => question.isCorrect
    ).length;

    const averageAccuracy = attemptedQuestions.length
      ? (correctAnswers / attemptedQuestions.length) * 100
      : 0;

    const completionRate = filteredRuns.length
      ? (completedRuns.length / filteredRuns.length) * 100
      : 0;

    const totalTimeMs = completedRuns.reduce(
      (sum, run) => sum + (run.totalTimeMs ?? 0),
      0
    );

    const runsWithTime = completedRuns.filter((run) => !!run.totalTimeMs);

    const averageTimeMs = runsWithTime.length
      ? totalTimeMs / runsWithTime.length
      : 0;

    const totalShareClicks = filteredRuns.reduce(
      (sum, run) => sum + getShareClicks(run),
      0
    );

    return {
      totalRuns: filteredRuns.length,
      completedRuns: completedRuns.length,
      stoppedRuns: stoppedRuns.length,
      averageScore,
      averageAccuracy,
      completionRate,
      averageTimeMs,
      attemptedQuestions: attemptedQuestions.length,
      correctAnswers,
      totalShareClicks,
    };
  }, [filteredRuns]);

  const modeStats = useMemo(() => {
    const globalHitsRuns = gameRuns.filter(
      (run) => run.modeSlug === "global-hits"
    );

    const dailyRuns = gameRuns.filter(
      (run) => run.modeSlug === "artist-of-the-day"
    );

    const total = gameRuns.length;

    return {
      globalHitsRuns: globalHitsRuns.length,
      dailyRuns: dailyRuns.length,
      globalHitsShare: total ? (globalHitsRuns.length / total) * 100 : 0,
      dailyShare: total ? (dailyRuns.length / total) * 100 : 0,
    };
  }, [gameRuns]);


  const languageReachStats = useMemo<LanguageReachStats[]>(() => {
    const languages: LanguageCode[] = ["en", "fr", "pt", "es", "unknown"];
    const totalRuns = filteredRuns.length;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoMillis = sevenDaysAgo.getTime();

    return languages
      .map((language) => {
        const runs = filteredRuns.filter(
          (run) => getRunLanguage(run) === language
        );

        const shareClicks = runs.reduce(
          (sum, run) => sum + getShareClicks(run),
          0
        );

        const last7Runs = runs.filter((run) => {
          const startedAtMillis = timestampToMillis(run.startedAt);
          return startedAtMillis >= sevenDaysAgoMillis;
        }).length;

        return {
          language,
          label: getLanguageLabel(language),
          runs: runs.length,
          percentage: totalRuns ? (runs.length / totalRuns) * 100 : 0,
          shareClicks,
          shareRate: runs.length ? (shareClicks / runs.length) * 100 : 0,
          last7Runs,
        };
      })
      .filter((item) => item.runs > 0)
      .sort((a, b) => b.runs - a.runs);
  }, [filteredRuns]);

  const dailyLanguageReach = useMemo(() => {
    const days = getLastNDays(daysRange);
    const languages: LanguageCode[] = ["en", "fr", "pt", "es", "unknown"];

    return days.map((date) => {
      const runsForDay = filteredRuns.filter((run) => {
        const startedAtMillis = timestampToMillis(run.startedAt);
        if (!startedAtMillis) return false;

        return getDateKeyFromMillis(startedAtMillis) === date;
      });

      const counts = languages.reduce((acc, language) => {
        acc[language] = runsForDay.filter(
          (run) => getRunLanguage(run) === language
        ).length;

        return acc;
      }, {} as Record<LanguageCode, number>);

      return {
        date,
        label: getShortDateLabel(date),
        total: runsForDay.length,
        counts,
      };
    });
  }, [filteredRuns, daysRange]);

  const difficultQuestions = useMemo<ProblemQuestion[]>(() => {
    const map = new Map<string, ProblemQuestion>();

    filteredRuns.filter(isCompletedRun).forEach((run) => {
      run.questions?.forEach((question) => {
        if (!question.selectedSongId) return;

        const key = question.snippetId;

        if (!map.has(key)) {
          map.set(key, {
            key,
            snippetText: question.snippetText,
            correctTitle: question.correctTitle,
            correctArtist: question.correctArtist,
            attempts: 0,
            failures: 0,
            successRate: 0,
          });
        }

        const item = map.get(key)!;
        item.attempts += 1;

        if (!question.isCorrect) {
          item.failures += 1;
        }

        item.successRate =
          item.attempts > 0
            ? ((item.attempts - item.failures) / item.attempts) * 100
            : 0;
      });
    });

    return Array.from(map.values())
      .filter((item) => item.attempts >= 1)
      .sort((a, b) => {
        if (b.failures !== a.failures) return b.failures - a.failures;
        return a.successRate - b.successRate;
      })
      .slice(0, 8);
  }, [filteredRuns]);

  const difficultSongs = useMemo<ProblemSong[]>(() => {
    const map = new Map<string, ProblemSong>();

    filteredRuns.filter(isCompletedRun).forEach((run) => {
      run.questions?.forEach((question) => {
        if (!question.selectedSongId) return;

        const key = question.correctSongId;

        if (!map.has(key)) {
          map.set(key, {
            key,
            title: question.correctTitle,
            artistName: question.correctArtist,
            attempts: 0,
            failures: 0,
            successRate: 0,
          });
        }

        const item = map.get(key)!;
        item.attempts += 1;

        if (!question.isCorrect) {
          item.failures += 1;
        }

        item.successRate =
          item.attempts > 0
            ? ((item.attempts - item.failures) / item.attempts) * 100
            : 0;
      });
    });

    return Array.from(map.values())
      .filter((item) => item.attempts >= 1)
      .sort((a, b) => {
        if (b.failures !== a.failures) return b.failures - a.failures;
        return a.successRate - b.successRate;
      })
      .slice(0, 8);
  }, [filteredRuns]);

  const latestRuns = useMemo(() => {
    return filteredRuns.slice(0, 8);
  }, [filteredRuns]);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-yellow-400 font-black">
            Analytics
          </p>

          <h2 className="text-3xl font-black tracking-tight mt-1">
            Dashboard gameplay
          </h2>

          <p className="text-gray-500 text-sm mt-2 max-w-2xl">
            Suivi visuel des parties, de la complétion, du temps de jeu et des premiers signaux de partage.
          </p>
        </div>

        <button
          onClick={loadDashboardData}
          disabled={loading}
          className="bg-white/[0.04] text-gray-300 border border-white/10 rounded-2xl px-5 py-3 text-sm font-bold hover:bg-white/[0.08] hover:text-white disabled:opacity-50 transition"
        >
          {loading ? "Chargement…" : "Rafraîchir"}
        </button>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-4 flex flex-col gap-1">
          <p className="text-red-400 text-sm font-bold">
            {errors.length} erreur(s)
          </p>

          {errors.map((error, index) => (
            <p key={index} className="text-red-300 text-xs">
              {error}
            </p>
          ))}
        </div>
      )}

{/* Compact filters */}
<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 -mt-2">
  <div className="flex items-center gap-2 text-xs text-gray-500">
    <span className="font-bold uppercase tracking-wide text-gray-600">
      Vue
    </span>

    <span className="text-gray-400">
      {getModeLabel(modeFilter)}
    </span>

    <span className="text-gray-700">·</span>

    <span className="text-gray-400">
      {daysRange} jours
    </span>
  </div>

  <div className="flex flex-wrap items-center gap-2">
    <button
      onClick={() => setModeFilter("all")}
      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
        modeFilter === "all"
          ? "bg-yellow-400/15 text-yellow-300 border-yellow-400/30"
          : "bg-white/[0.03] text-gray-500 border-white/10 hover:text-gray-300 hover:bg-white/[0.06]"
      }`}
    >
      Tous
    </button>

    <button
      onClick={() => setModeFilter("global-hits")}
      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
        modeFilter === "global-hits"
          ? "bg-yellow-400/15 text-yellow-300 border-yellow-400/30"
          : "bg-white/[0.03] text-gray-500 border-white/10 hover:text-gray-300 hover:bg-white/[0.06]"
      }`}
    >
      Global Hits
    </button>

    <button
      onClick={() => setModeFilter("artist-of-the-day")}
      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
        modeFilter === "artist-of-the-day"
          ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
          : "bg-white/[0.03] text-gray-500 border-white/10 hover:text-gray-300 hover:bg-white/[0.06]"
      }`}
    >
      Daily
    </button>

    <span className="hidden sm:block h-5 w-px bg-white/10 mx-1" />

    {[7, 14, 30].map((days) => (
      <button
        key={days}
        onClick={() => setDaysRange(days)}
        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
          daysRange === days
            ? "bg-white/10 text-white border-white/20"
            : "bg-white/[0.03] text-gray-500 border-white/10 hover:text-gray-300 hover:bg-white/[0.06]"
        }`}
      >
        {days}j
      </button>
    ))}
  </div>
</div>

      {/* Gameplay KPIs */}
      <section className="flex flex-col gap-4">
        <SectionTitle
          title="Performance gameplay"
          subtitle="Résumé global du mode sélectionné."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Parties lancées"
            value={gameplayStats.totalRuns}
            hint="Nombre total de gameRuns créés"
          />

          <StatCard
            label="Parties terminées"
            value={gameplayStats.completedRuns}
            hint={`${gameplayStats.stoppedRuns} arrêtée(s) / non terminée(s)`}
            tone="green"
          />

          <StatCard
            label="Taux de complétion"
            value={formatPercent(gameplayStats.completionRate)}
            hint="Terminées / lancées"
            tone={getCompletionTone(gameplayStats.completionRate)}
          />

          <StatCard
            label="Clics partage"
            value={gameplayStats.totalShareClicks}
            hint="Bouton de partage en fin de partie"
            tone="yellow"
          />

          <StatCard
            label="Score moyen"
            value={gameplayStats.averageScore.toFixed(1)}
            hint="Sur les parties terminées"
            tone="purple"
          />

          <StatCard
            label="Réussite moyenne"
            value={formatPercent(gameplayStats.averageAccuracy)}
            hint={`${gameplayStats.correctAnswers}/${gameplayStats.attemptedQuestions} réponses correctes`}
            tone={getAccuracyTone(gameplayStats.averageAccuracy)}
          />

          <StatCard
            label="Temps moyen"
            value={formatDuration(gameplayStats.averageTimeMs)}
            hint="Sur les parties terminées"
          />
        </div>
      </section>

      {/* Visual charts */}
      <section className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        <MultiBarChart
          title="Parties lancées / terminées / arrêtées"
          subtitle="Vue par jour sur la période sélectionnée."
          data={dailyMetrics}
        />

        <LineChart
          title="Temps moyen par jour"
          data={dailyMetrics}
          valueKey="averageTimeMs"
          formatter={formatDuration}
        />

        <LineChart
          title="Clics partage par jour"
          data={dailyMetrics}
          valueKey="shareClicks"
          formatter={(value) => String(Math.round(value))}
        />
      </section>

      {/* Modes */}
      <section className="bg-gray-950/70 border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/20 flex flex-col gap-4">
        <SectionTitle
          title="Répartition globale des modes"
          subtitle="Cette section n’est pas filtrée, elle montre la distribution globale."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-black/30 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wide">
                  Global Hits
                </p>
                <p className="text-3xl font-black text-white mt-2">
                  {modeStats.globalHitsRuns}
                </p>
              </div>

              <span className="bg-yellow-400/15 text-yellow-300 border border-yellow-400/25 rounded-full px-3 py-1 text-xs font-bold">
                {formatPercent(modeStats.globalHitsShare)}
              </span>
            </div>

            <div className="w-full bg-white/10 rounded-full h-2 mt-5">
              <div
                className="bg-yellow-400 h-2 rounded-full"
                style={{ width: `${modeStats.globalHitsShare}%` }}
              />
            </div>
          </div>

          <div className="bg-black/30 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wide">
                  Artist of the Day
                </p>
                <p className="text-3xl font-black text-white mt-2">
                  {modeStats.dailyRuns}
                </p>
              </div>

              <span className="bg-purple-500/15 text-purple-300 border border-purple-500/25 rounded-full px-3 py-1 text-xs font-bold">
                {formatPercent(modeStats.dailyShare)}
              </span>
            </div>

            <div className="w-full bg-white/10 rounded-full h-2 mt-5">
              <div
                className="bg-purple-500 h-2 rounded-full"
                style={{ width: `${modeStats.dailyShare}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Language reach */}
      <section className="bg-gray-950/70 border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/20 flex flex-col gap-5">
        <div>
          <h3 className="text-xl font-black text-white tracking-tight">
            Répartition des joueurs par langue
          </h3>

          <p className="text-sm text-gray-500 mt-1">
            Suivi de la portée du jeu par langue sélectionnée : volume de parties,
            évolution quotidienne et potentiel de viralité via les partages.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {languageReachStats.length === 0 && (
            <div className="md:col-span-2 xl:col-span-5 bg-black/25 border border-white/10 rounded-2xl p-6 text-center text-gray-500 text-sm">
              Aucune donnée de langue disponible pour le moment.
            </div>
          )}

          {languageReachStats.map((item) => (
            <div
              key={item.language}
              className="bg-black/25 border border-white/10 rounded-2xl p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-black",
                    getLanguageBadgeClass(item.language),
                  ].join(" ")}
                >
                  {item.label}
                </span>

                <span className="text-xs text-gray-500 font-bold">
                  {Math.round(item.percentage)}%
                </span>
              </div>

              <p className="mt-4 text-3xl font-black text-white">
                {item.runs}
              </p>

              <p className="text-xs text-gray-500 mt-1">
                partie(s) lancée(s)
              </p>

              <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={[
                    "h-full rounded-full",
                    getLanguageBarClass(item.language),
                  ].join(" ")}
                  style={{ width: `${Math.max(item.percentage, 4)}%` }}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2">
                  <p className="text-gray-500">7 derniers jours</p>
                  <p className="text-white font-black mt-1">
                    {item.last7Runs}
                  </p>
                </div>

                <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2">
                  <p className="text-gray-500">Partages</p>
                  <p className="text-white font-black mt-1">
                    {item.shareClicks}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {languageReachStats.length > 0 && (
          <div className="bg-black/25 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-4 mb-3">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-gray-500">
                Distribution globale
              </p>

              <p className="text-xs text-gray-600">
                {filteredRuns.length} partie(s)
              </p>
            </div>

            <div className="flex h-5 overflow-hidden rounded-full bg-white/10">
              {languageReachStats.map((item) => (
                <div
                  key={item.language}
                  className={getLanguageBarClass(item.language)}
                  style={{ width: `${item.percentage}%` }}
                  title={`${item.label} — ${Math.round(item.percentage)}%`}
                />
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {languageReachStats.map((item) => (
                <span
                  key={item.language}
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-bold",
                    getLanguageBadgeClass(item.language),
                  ].join(" ")}
                >
                  {item.label} · {Math.round(item.percentage)}%
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="bg-black/25 border border-white/10 rounded-2xl p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-gray-500">
                Évolution par jour
              </p>

              <p className="text-sm text-gray-500 mt-1">
                Nombre de parties lancées par langue sur la période sélectionnée.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["en", "fr", "pt", "es", "unknown"] as LanguageCode[]).map(
                (language) => (
                  <span
                    key={language}
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-bold",
                      getLanguageBadgeClass(language),
                    ].join(" ")}
                  >
                    {getLanguageLabel(language)}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[720px] h-72 flex items-end gap-3 border-b border-white/10 pt-8">
              {dailyLanguageReach.map((day) => {
                const maxDailyTotal = Math.max(
                  ...dailyLanguageReach.map((item) => item.total),
                  1
                );

                const totalHeight = day.total
                  ? Math.max((day.total / maxDailyTotal) * 220, 8)
                  : 0;

                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center justify-end gap-2"
                  >
                    <div
                      className="w-8 rounded-t-xl overflow-hidden bg-white/10 flex flex-col-reverse"
                      style={{ height: `${totalHeight}px` }}
                      title={`${day.label} — ${day.total} partie(s)`}
                    >
                      {(["en", "fr", "pt", "es", "unknown"] as LanguageCode[]).map(
                        (language) => {
                          const count = day.counts[language];
                          const heightPercent = day.total
                            ? (count / day.total) * 100
                            : 0;

                          if (!count) return null;

                          return (
                            <div
                              key={language}
                              className={getLanguageBarClass(language)}
                              style={{ height: `${heightPercent}%` }}
                              title={`${getLanguageLabel(language)} — ${count}`}
                            />
                          );
                        }
                      )}
                    </div>

                    <p className="text-[10px] text-gray-500">
                      {day.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Difficult content */}
      <section className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        <div className="bg-gray-950/70 border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/20 flex flex-col gap-4">
          <SectionTitle
            title="Snippets les plus ratés"
            subtitle="À utiliser pour détecter les extraits ambigus ou trop difficiles."
          />

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
            <table className="w-full min-w-[900px] text-xs text-gray-300">
              <thead className="bg-white/[0.04] text-gray-400">
                <tr>
                  <th className="px-4 py-4 text-left">Snippet</th>
                  <th className="px-4 py-4 text-left">Réponse</th>
                  <th className="px-4 py-4 text-left">Tentatives</th>
                  <th className="px-4 py-4 text-left">Échecs</th>
                  <th className="px-4 py-4 text-left">Réussite</th>
                </tr>
              </thead>

              <tbody>
                {difficultQuestions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Pas encore assez de parties terminées.
                    </td>
                  </tr>
                )}

                {difficultQuestions.map((item) => (
                  <tr key={item.key} className="border-t border-white/10 hover:bg-white/[0.03] transition">
                    <td className="px-4 py-4 max-w-[320px]">
                      <p className="line-clamp-2">
                        {item.snippetText}
                      </p>
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="font-bold text-white">
                        {item.correctTitle}
                      </span>
                      <span className="block text-gray-500">
                        {item.correctArtist}
                      </span>
                    </td>

                    <td className="px-4 py-4">{item.attempts}</td>

                    <td className="px-4 py-4 text-red-400 font-bold">
                      {item.failures}
                    </td>

                    <td className="px-4 py-4">
                      {formatPercent(item.successRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-gray-950/70 border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/20 flex flex-col gap-4">
          <SectionTitle
            title="Chansons les plus difficiles"
            subtitle="Permet de voir quelles bonnes réponses sont le plus souvent manquées."
          />

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
            <table className="w-full min-w-[760px] text-xs text-gray-300">
              <thead className="bg-white/[0.04] text-gray-400">
                <tr>
                  <th className="px-4 py-4 text-left">Chanson</th>
                  <th className="px-4 py-4 text-left">Artiste</th>
                  <th className="px-4 py-4 text-left">Tentatives</th>
                  <th className="px-4 py-4 text-left">Échecs</th>
                  <th className="px-4 py-4 text-left">Réussite</th>
                </tr>
              </thead>

              <tbody>
                {difficultSongs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Pas encore assez de parties terminées.
                    </td>
                  </tr>
                )}

                {difficultSongs.map((item) => (
                  <tr key={item.key} className="border-t border-white/10 hover:bg-white/[0.03] transition">
                    <td className="px-4 py-4 font-bold text-white">
                      {item.title}
                    </td>

                    <td className="px-4 py-4">{item.artistName}</td>

                    <td className="px-4 py-4">{item.attempts}</td>

                    <td className="px-4 py-4 text-red-400 font-bold">
                      {item.failures}
                    </td>

                    <td className="px-4 py-4">
                      {formatPercent(item.successRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Latest runs */}
      <section className="bg-gray-950/70 border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/20 flex flex-col gap-4">
        <SectionTitle
          title="Dernières parties"
          subtitle="Vue rapide des dernières sessions créées selon le filtre actuel."
        />

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
          <table className="w-full min-w-[980px] text-xs text-gray-300">
            <thead className="bg-white/[0.04] text-gray-400">
              <tr>
                <th className="px-4 py-4 text-left">Mode</th>
                <th className="px-4 py-4 text-left">Statut</th>
                <th className="px-4 py-4 text-left">Score</th>
                <th className="px-4 py-4 text-left">Partages</th>
                <th className="px-4 py-4 text-left">Date</th>
              </tr>
            </thead>

            <tbody>
              {latestRuns.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Aucune partie créée pour le moment.
                  </td>
                </tr>
              )}

              {latestRuns.map((run) => (
                <tr key={run.id} className="border-t border-white/10 hover:bg-white/[0.03] transition">
                  <td className="px-4 py-4">
                    {run.modeSlug === "artist-of-the-day" ? (
                      <span className="bg-purple-500/15 text-purple-300 border border-purple-500/25 rounded-full px-3 py-1 text-xs font-bold">
                        Artist of the Day
                      </span>
                    ) : (
                      <span className="bg-yellow-400/15 text-yellow-300 border border-yellow-400/25 rounded-full px-3 py-1 text-xs font-bold">
                        Global Hits
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-4">
                    {isCompletedRun(run) ? (
                      <span className="bg-green-500/15 text-green-300 border border-green-500/25 rounded-full px-3 py-1 text-xs font-bold">
                        Terminée
                      </span>
                    ) : (
                      <span className="bg-red-500/15 text-red-300 border border-red-500/25 rounded-full px-3 py-1 text-xs font-bold">
                        Arrêtée
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-4 font-bold text-white">
                    {run.score ?? 0}
                  </td>

                  <td className="px-4 py-4">
                    {getShareClicks(run)}
                  </td>

                  <td className="px-4 py-4 text-gray-500">
                    {formatDateTime(run.startedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}