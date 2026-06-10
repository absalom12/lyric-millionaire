import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getGameRun } from "../lib/gameEngine";
import { GameQuestion, GameRun } from "../types";
import { updateDocument, serverTimestamp } from "../lib/firebase";
import ThemeToggle, { useAppTheme } from "../components/ThemeToggle";
import LanguageSelector from "../components/LanguageSelector";
import { useLanguage } from "../i18n/LanguageContext";
import { TranslationDictionary } from "../i18n/translations";
import { useQuestionTimer } from "../hooks/useQuestionTimer";
import { Sounds } from "../lib/sounds";

const MONEY_LADDER = [100, 500, 1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 500_000, 1_000_000];
const QUESTION_DURATION = 30;

type GameQuestionWithMeta = GameQuestion & {
  difficulty?: number;
  spotifyStreams?: number;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

// ── Money Ladder (compact sidebar on mobile = bottom drawer toggle) ──────────
function MiniLadder({
  currentIndex,
  isLight,
}: {
  currentIndex: number;
  isLight: boolean;
}) {
  const current = MONEY_LADDER[currentIndex];
  const next = MONEY_LADDER[currentIndex + 1];

  return (
    <div className={[
      "flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black",
      isLight
        ? "border-orange-200 bg-white/80 text-slate-900"
        : "border-white/10 bg-gray-950/80 text-white",
    ].join(" ")}>
      <span className={isLight ? "text-orange-700" : "text-yellow-400"}>💰</span>
      <span>{formatMoney(current)}</span>
      {next && (
        <>
          <span className={isLight ? "text-slate-300" : "text-gray-600"}>→</span>
          <span className={isLight ? "text-slate-400" : "text-gray-500"}>{formatMoney(next)}</span>
        </>
      )}
    </div>
  );
}

// ── Full ladder drawer ────────────────────────────────────────────────────────
function LadderDrawer({
  open,
  onClose,
  currentIndex,
  celebrateIndex,
  isBreaking,
  isLight,
  t,
}: {
  open: boolean;
  onClose: () => void;
  currentIndex: number;
  celebrateIndex: number | null;
  isBreaking: boolean;
  isLight: boolean;
  t: TranslationDictionary;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div
        className={[
          "relative mx-2 mb-2 rounded-[2rem] border p-5 shadow-2xl backdrop-blur-xl",
          isLight
            ? "border-orange-200 bg-white/95 shadow-orange-200/50"
            : "border-white/10 bg-gray-950/95 shadow-black/60",
          isBreaking ? "ring-2 ring-red-500/40" : "",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className={["text-[11px] font-black uppercase tracking-[0.25em]", isLight ? "text-orange-700" : "text-yellow-400"].join(" ")}>
            {t.game.moneyLadder}
          </p>
          <button
            onClick={onClose}
            className={["rounded-xl px-3 py-1 text-xs font-black", isLight ? "bg-orange-100 text-orange-700" : "bg-white/10 text-gray-300"].join(" ")}
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col-reverse gap-2">
          {MONEY_LADDER.map((amount, index) => {
            const isCurrent = index === currentIndex;
            const isPassed = index < currentIndex;
            const isMillion = amount === 1_000_000;
            const shouldCelebrate = celebrateIndex === index;

            return (
              <div
                key={amount}
                className={[
                  "flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition-all",
                  isCurrent
                    ? isLight
                      ? "border-blue-400 bg-orange-500 text-white font-black shadow-lg"
                      : "border-yellow-400 bg-yellow-400 text-black font-black shadow-lg shadow-yellow-400/20"
                    : isPassed
                    ? isLight
                      ? "border-green-200 bg-green-50 text-green-700 font-bold"
                      : "border-green-500/30 bg-green-500/10 text-green-300 font-bold"
                    : isLight
                    ? "border-orange-100 bg-white/60 text-slate-400"
                    : "border-white/10 bg-white/[0.03] text-gray-500",
                  shouldCelebrate ? "ladder-correct-pulse" : "",
                ].join(" ")}
              >
                <span>{isMillion ? "👑 " : isPassed ? "✅ " : ""}{formatMoney(amount)}</span>
                {isCurrent && <span className="text-xs opacity-70">← now</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Desktop sidebar ladder (lg+) ──────────────────────────────────────────────
function DesktopLadder({
  currentIndex,
  celebrateIndex,
  isBreaking,
  isLight,
  t,
}: {
  currentIndex: number;
  celebrateIndex: number | null;
  isBreaking: boolean;
  isLight: boolean;
  t: TranslationDictionary;
}) {
  return (
    <aside
      className={[
        "relative hidden lg:flex flex-col overflow-hidden rounded-[2rem] border p-5 shadow-2xl backdrop-blur-xl",
        isLight ? "border-orange-200 bg-white/85 shadow-orange-200/50" : "border-white/10 bg-gray-950/80 shadow-black/50",
        isBreaking ? "ring-2 ring-red-500/40" : "",
      ].join(" ")}
    >
      <p className={["mb-4 text-[11px] font-black uppercase tracking-[0.25em]", isLight ? "text-orange-700" : "text-yellow-400"].join(" ")}>
        {t.game.moneyLadder}
      </p>
      <div className="flex flex-col-reverse gap-2 flex-1">
        {MONEY_LADDER.map((amount, index) => {
          const isCurrent = index === currentIndex;
          const isPassed = index < currentIndex;
          const isMillion = amount === 1_000_000;
          const shouldCelebrate = celebrateIndex === index;
          const widthPercent = 72 + index * 2.8;

          return (
            <div
              key={amount}
              className={[
                "flex items-center justify-center rounded-2xl border px-3 py-2.5 text-sm transition-all duration-500",
                isCurrent
                  ? isLight
                    ? "border-blue-500 bg-orange-500 text-white shadow-xl shadow-orange-300/50 font-black"
                    : "border-yellow-400 bg-yellow-400 text-black shadow-xl shadow-yellow-400/30 font-black"
                  : isPassed
                  ? isLight
                    ? "border-green-200 bg-green-50 text-green-700 font-bold"
                    : "border-green-500/30 bg-green-500/10 text-green-300 font-bold"
                  : isLight
                  ? "border-orange-100 bg-white/60 text-slate-500"
                  : "border-white/10 bg-white/[0.035] text-gray-400",
                isMillion ? "million-glow" : "",
                shouldCelebrate ? "ladder-correct-pulse ladder-unlock-glow" : "",
                isBreaking && !isPassed && !isCurrent ? "opacity-30 blur-[1px]" : "",
              ].join(" ")}
              style={{ width: `${widthPercent}%`, alignSelf: "center" }}
            >
              {isMillion ? "👑 " : ""}{formatMoney(amount)}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ── Joker row (compact) ───────────────────────────────────────────────────────
function JokerBar({
  left,
  used,
  disabled,
  releaseYear,
  onUse,
  isLight,
  t,
}: {
  left: number;
  used?: boolean;
  disabled: boolean;
  releaseYear?: number;
  onUse: () => void;
  isLight: boolean;
  t: TranslationDictionary;
}) {
  return (
    <div className={[
      "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3",
      isLight ? "border-orange-200 bg-white/80" : "border-white/10 bg-gray-950/70",
    ].join(" ")}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-lg shrink-0">🕵️</span>
        <div className="min-w-0">
          <p className={["text-[11px] font-black uppercase tracking-[0.18em] truncate", isLight ? "text-orange-700" : "text-yellow-400"].join(" ")}>
            {t.game.jokerTitle}
          </p>
          <p className={["text-xs truncate", isLight ? "text-slate-500" : "text-gray-400"].join(" ")}>
            {t.game.jokerDescription}
          </p>
        </div>
      </div>

      {used && releaseYear ? (
        <div className={["rounded-xl border px-4 py-2 text-center shrink-0", isLight ? "border-orange-200 bg-orange-50 text-orange-700" : "border-yellow-400/30 bg-yellow-400/10 text-yellow-300"].join(" ")}>
          <p className="text-[9px] font-black uppercase tracking-widest opacity-70">{t.game.revealed}</p>
          <p className="text-xl font-black leading-none mt-0.5">{releaseYear}</p>
        </div>
      ) : (
        <button
          onClick={onUse}
          disabled={disabled}
          className={[
            "shrink-0 rounded-xl px-4 py-2 text-xs font-black transition active:scale-[0.97] disabled:opacity-40",
            isLight ? "bg-orange-500 text-white hover:bg-orange-400" : "bg-yellow-400 text-black hover:bg-yellow-300",
          ].join(" ")}
        >
          {t.game.useJoker} · {left}
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Game() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { theme, isLight, toggleTheme } = useAppTheme();
  const { t } = useLanguage();

  const [run, setRun] = useState<(GameRun & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState(false);
  const [gameOverMessage, setGameOverMessage] = useState("");
  const [celebrateIndex, setCelebrateIndex] = useState<number | null>(null);
  const [showCorrectMessage, setShowCorrectMessage] = useState(false);
  const [isLadderBreaking, setIsLadderBreaking] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [ladderOpen, setLadderOpen] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const answeringRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!runId) return;
    getGameRun(runId).then((gameRun) => {
      setRun(gameRun);
      setLoading(false);
      setTimerEnabled(true);
    });
  }, [runId]);

  const question = run ? (run.questions[run.currentQuestionIndex] as GameQuestionWithMeta) : null;
  const playMode = (run?.playMode ?? "lyrics") as "lyrics" | "blindtest";
  const isLastQuestion = run ? run.currentQuestionIndex === run.questions.length - 1 : false;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setAudioPlaying(false);

    if (playMode === "blindtest" && question?.previewUrl) {
      audio.src = question.previewUrl;
      audio.play()
        .then(() => setAudioPlaying(true))
        .catch(() => {});
    }

    return () => {
      audio.pause();
      setAudioPlaying(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.snippetId, playMode]);
  const currentMoney = run ? MONEY_LADDER[run.currentQuestionIndex] ?? MONEY_LADDER[MONEY_LADDER.length - 1] : 0;
  const securedMoney = run && run.currentQuestionIndex > 0 ? MONEY_LADDER[run.currentQuestionIndex - 1] : 0;

  const handleAnswer = async (songId: string, fromTimer = false) => {
    if (answeringRef.current || !run || !question) return;
    if (!fromTimer && question.selectedSongId) return;

    answeringRef.current = true;
    setAnswering(true);
    setTimerEnabled(false);

    if (audioRef.current) {
      audioRef.current.pause();
      setAudioPlaying(false);
    }

    const isCorrect = !fromTimer && songId === question.correctSongId;
    const updatedQuestions = run.questions.map((q, i) =>
      i === run.currentQuestionIndex ? { ...q, selectedSongId: songId, isCorrect } : q
    );

    if (fromTimer) Sounds.timeout();
    else if (isCorrect) Sounds.correct();
    else Sounds.wrong();

    if (!isCorrect) {
      const updatedRun: GameRun & { id: string } = {
        ...run,
        questions: updatedQuestions,
        status: "lost",
        score: securedMoney,
        moneyReached: securedMoney,
        completedQuestionCount: run.currentQuestionIndex + 1,
        lostAtQuestionIndex: run.currentQuestionIndex,
      };
      setRun(updatedRun);
      setGameOverMessage(t.game.gameOver);
      setIsLadderBreaking(true);

      await updateDocument("gameRuns", run.id, {
        questions: updatedQuestions,
        status: "lost",
        score: securedMoney,
        moneyReached: securedMoney,
        completedQuestionCount: run.currentQuestionIndex + 1,
        lostAtQuestionIndex: run.currentQuestionIndex,
        endedAt: serverTimestamp(),
        totalTimeMs: Date.now() - run.startedAt.toMillis(),
      });

      setTimeout(() => navigate(`/result/${run.id}`), 1700);
      return;
    }

    setShowCorrectMessage(true);
    setCelebrateIndex(run.currentQuestionIndex);

    const newScore = currentMoney;
    const newStatus = isLastQuestion ? "won" : "in_progress";
    const updatedRun: GameRun & { id: string } = {
      ...run,
      score: newScore,
      moneyReached: newScore,
      completedQuestionCount: run.currentQuestionIndex + 1,
      questions: updatedQuestions,
      status: newStatus as any,
    };
    setRun(updatedRun);

    await updateDocument("gameRuns", run.id, {
      score: newScore,
      moneyReached: newScore,
      completedQuestionCount: run.currentQuestionIndex + 1,
      questions: updatedQuestions,
      status: newStatus,
      ...(isLastQuestion ? { endedAt: serverTimestamp(), totalTimeMs: Date.now() - run.startedAt.toMillis() } : {}),
    });

    setTimeout(async () => {
      if (isLastQuestion) {
        navigate(`/result/${run.id}`);
      } else {
        const next = run.currentQuestionIndex + 1;
        await updateDocument("gameRuns", run.id, { currentQuestionIndex: next });
        setRun((prev) => (prev ? { ...prev, currentQuestionIndex: next } : prev));
        answeringRef.current = false;
        setAnswering(false);
        setCelebrateIndex(null);
        setShowCorrectMessage(false);
        setTimerEnabled(true);
      }
    }, 1400);
  };

  const handleTimerExpire = () => {
    if (answeringRef.current || !question || question.selectedSongId) return;
    handleAnswer("__timeout__", true);
  };

  const { timeLeft, progress, isUrgent } = useQuestionTimer({
    duration: QUESTION_DURATION,
    enabled: timerEnabled && !answering && !!question && !question.selectedSongId,
    onExpire: handleTimerExpire,
  });

  const handleJoker = async () => {
    if (!run || !question) return;
    if (run.jokerYearLeft <= 0 || question.usedJokerYear || question.selectedSongId) return;

    Sounds.joker();

    const updatedQuestions = run.questions.map((q, i) =>
      i === run.currentQuestionIndex ? { ...q, usedJokerYear: true } : q
    );
    const updatedRun: GameRun & { id: string } = {
      ...run,
      jokerYearLeft: run.jokerYearLeft - 1,
      jokerYearUsed: run.jokerYearUsed + 1,
      questions: updatedQuestions,
    };
    setRun(updatedRun);
    await updateDocument("gameRuns", run.id, {
      jokerYearLeft: run.jokerYearLeft - 1,
      jokerYearUsed: run.jokerYearUsed + 1,
      questions: updatedQuestions,
    });
  };

  const getAnswerStyle = (songId: string) => {
    if (!question?.selectedSongId) {
      return isLight
        ? "border-orange-100 bg-white/85 text-slate-900 hover:border-orange-300 hover:bg-orange-50 active:scale-[0.98]"
        : "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] active:scale-[0.98]";
    }
    if (songId === question.correctSongId)
      return isLight
        ? "border-green-400 bg-green-50 text-green-800"
        : "border-green-400/60 bg-green-500/20 text-green-100";
    if (songId === question.selectedSongId)
      return isLight
        ? "border-red-400 bg-red-50 text-red-800"
        : "border-red-400/60 bg-red-500/20 text-red-100";
    return isLight
      ? "border-orange-100 bg-white/50 text-slate-300 opacity-50"
      : "border-white/10 bg-white/[0.02] text-gray-600 opacity-50";
  };

  const pageBg = isLight
    ? "bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-100 text-slate-950"
    : "bg-[#050509] text-white";

  // ── Loading ──
  if (loading) {
    return (
      <div className={`flex h-screen items-center justify-center ${pageBg}`}>
        <div className="text-center">
          <div className={["mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4", isLight ? "border-orange-100 border-t-orange-500" : "border-white/10 border-t-yellow-400"].join(" ")} />
          <p className={isLight ? "text-sm font-bold text-slate-500" : "text-sm font-bold text-gray-400"}>{t.common.loadingGame}</p>
        </div>
      </div>
    );
  }

  if (!run || !question) {
    return (
      <div className={`flex h-screen items-center justify-center px-5 text-center ${pageBg}`}>
        <div>
          <p className="text-3xl font-black">{t.game.gameNotFound}</p>
          <button onClick={() => navigate("/")} className={["mt-5 rounded-2xl px-6 py-3 font-black", isLight ? "bg-orange-500 text-white" : "bg-yellow-400 text-black"].join(" ")}>
            {t.game.backHome}
          </button>
        </div>
      </div>
    );
  }

  return (
    // ── Full viewport, no scroll on mobile ──────────────────────────────────
    <div className={`h-[100dvh] overflow-hidden flex flex-col ${pageBg}`}>

      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 pt-3 pb-2 lg:px-8 lg:pt-5">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 transition hover:opacity-80">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl">
            <img src="/logo-mark.png" alt="Lyric Millionaire" className="h-full w-full object-contain" />
          </div>
          <div className="hidden sm:block">
            <p className={["text-base font-black leading-none", isLight ? "text-slate-950" : "text-white"].join(" ")}>{t.common.brand}</p>
            <p className={["text-xs font-bold", isLight ? "text-orange-700" : "text-yellow-400"].join(" ")}>{t.common.tagline}</p>
          </div>
        </button>

        {/* Progress pill */}
        <div className={["flex items-center gap-2 rounded-full border px-3 py-1.5", isLight ? "border-orange-200 bg-white/80" : "border-white/10 bg-gray-950/70"].join(" ")}>
          <span className={["text-xs font-black", isLight ? "text-orange-700" : "text-yellow-400"].join(" ")}>
            {run.currentQuestionIndex + 1}
          </span>
          <span className={["text-xs", isLight ? "text-slate-400" : "text-gray-600"].join(" ")}>/</span>
          <span className={["text-xs font-bold", isLight ? "text-slate-500" : "text-gray-400"].join(" ")}>
            {run.questions.length}
          </span>
          {/* Mini progress dots */}
          <div className="flex gap-0.5 ml-1">
            {run.questions.map((_, i) => (
              <div
                key={i}
                className={[
                  "h-1.5 w-1.5 rounded-full transition-all",
                  i < run.currentQuestionIndex
                    ? isLight ? "bg-green-500" : "bg-green-400"
                    : i === run.currentQuestionIndex
                    ? isLight ? "bg-orange-500" : "bg-yellow-400"
                    : isLight ? "bg-orange-200" : "bg-white/15",
                ].join(" ")}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mobile: money pill + ladder toggle */}
          <button
            onClick={() => setLadderOpen(true)}
            className="lg:hidden"
            aria-label="Open money ladder"
          >
            <MiniLadder currentIndex={run.currentQuestionIndex} isLight={isLight} />
          </button>

          <LanguageSelector isLight={isLight} />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      {/* ── Timer bar ───────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 px-4 lg:px-8">
        <div className={["relative flex-1 h-1.5 rounded-full overflow-hidden", isLight ? "bg-orange-100" : "bg-white/10"].join(" ")}>
          <div
            className={["absolute left-0 top-0 h-full rounded-full transition-colors", isUrgent ? "bg-red-500" : isLight ? "bg-orange-500" : "bg-yellow-400"].join(" ")}
            style={{ width: `${progress * 100}%`, transition: "width 1s linear" }}
          />
        </div>
        <span className={["w-5 text-right text-xs font-black tabular-nums", isUrgent ? "text-red-400" : isLight ? "text-orange-700" : "text-gray-400"].join(" ")}>
          {timeLeft}
        </span>
      </div>

      {/* ── Body — fills remaining height ───────────────────────────────── */}
      <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_370px] gap-4 px-4 py-3 lg:px-8 lg:py-5">

        {/* ── Left: game content ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 min-h-0">

          {/* Game-over banner */}
          {gameOverMessage && (
            <div className="shrink-0 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-center text-sm font-black text-red-300">
              {gameOverMessage}
            </div>
          )}

          {/* Joker bar */}
          <div className="shrink-0">
            <JokerBar
              left={run.jokerYearLeft}
              used={question.usedJokerYear}
              disabled={run.jokerYearLeft <= 0 || !!question.selectedSongId || !!question.usedJokerYear}
              releaseYear={question.releaseYear}
              onUse={handleJoker}
              isLight={isLight}
              t={t}
            />
          </div>

          {/* Main card — lyrics or blindtest */}
          <div
            key={`${run.currentQuestionIndex}-${question.snippetId}-${playMode}`}
            className={[
              "question-enter flex-1 min-h-0 flex flex-col justify-center rounded-[1.6rem] border px-5 py-4 shadow-2xl backdrop-blur-xl overflow-hidden",
              isLight ? "border-orange-200 bg-white/85 shadow-orange-200/40" : "border-white/10 bg-gray-950/75 shadow-black/40",
              showCorrectMessage ? "correct-flash" : "",
            ].join(" ")}
          >
            {playMode === "lyrics" ? (
              <>
                <p className={[
                  "font-black leading-snug tracking-tight",
                  "text-2xl sm:text-3xl lg:text-4xl xl:text-5xl",
                  isLight ? "text-slate-950" : "text-white",
                ].join(" ")}>
                  "{question.snippetText}"
                </p>

                {showCorrectMessage && (
                  <div className={["success-pop mt-4 inline-flex self-start rounded-full border px-3 py-1.5 text-xs font-black", isLight ? "border-green-300 bg-green-50 text-green-700" : "border-green-400/30 bg-green-500/10 text-green-300"].join(" ")}>
                    {t.game.correctAnswer} · {formatMoney(currentMoney)}
                  </div>
                )}
              </>
            ) : (
              /* ── Blindtest card ─────────────────────────────────────── */
              <div className="flex flex-col items-center justify-center gap-5 h-full">
                {question.previewUrl ? (
                  <>
                    {/* Waveform bars */}
                    <div className="flex items-end gap-1.5 h-16">
                      {[0.45, 0.75, 1, 0.6, 0.88, 0.5, 0.78, 0.62, 0.95, 0.42, 0.7, 0.55].map((h, i) => (
                        <div
                          key={i}
                          className={[
                            "rounded-full transition-opacity duration-300",
                            audioPlaying ? "wave-bar" : "",
                            isLight ? "bg-orange-500" : "bg-yellow-400",
                          ].join(" ")}
                          style={{
                            width: 5,
                            height: `${h * 48}px`,
                            opacity: audioPlaying ? 1 : 0.35,
                            animationDelay: `${i * 0.075}s`,
                          }}
                        />
                      ))}
                    </div>

                    {/* Play / Pause button */}
                    <button
                      onClick={() => {
                        const audio = audioRef.current;
                        if (!audio) return;
                        if (audioPlaying) {
                          audio.pause();
                        } else {
                          audio.play().then(() => setAudioPlaying(true)).catch(() => {});
                        }
                      }}
                      disabled={!!question.selectedSongId}
                      className={[
                        "flex items-center gap-2 rounded-2xl px-7 py-3 font-black text-sm transition active:scale-95 disabled:opacity-50",
                        isLight ? "bg-orange-500 text-white hover:bg-orange-400" : "bg-yellow-400 text-black hover:bg-yellow-300",
                      ].join(" ")}
                    >
                      {audioPlaying ? "⏸ Pause" : "▶ Jouer"}
                    </button>

                    {showCorrectMessage && (
                      <div className={["success-pop inline-flex rounded-full border px-3 py-1.5 text-xs font-black", isLight ? "border-green-300 bg-green-50 text-green-700" : "border-green-400/30 bg-green-500/10 text-green-300"].join(" ")}>
                        {t.game.correctAnswer} · {formatMoney(currentMoney)}
                      </div>
                    )}
                  </>
                ) : (
                  /* No preview available fallback */
                  <div className="text-center">
                    <p className="text-4xl mb-3">🎧</p>
                    <p className={["text-sm font-bold", isLight ? "text-slate-400" : "text-gray-500"].join(" ")}>
                      Aucun extrait disponible
                    </p>
                    <p className={["text-xs mt-1", isLight ? "text-slate-300" : "text-gray-600"].join(" ")}>
                      Passe en mode 🎵 pour voir les paroles
                    </p>
                    {showCorrectMessage && (
                      <div className={["success-pop mt-4 inline-flex rounded-full border px-3 py-1.5 text-xs font-black", isLight ? "border-green-300 bg-green-50 text-green-700" : "border-green-400/30 bg-green-500/10 text-green-300"].join(" ")}>
                        {t.game.correctAnswer} · {formatMoney(currentMoney)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Answer grid — always 2×2, no overflow */}
          <div className="shrink-0 grid grid-cols-2 gap-2">
            {question.answers.map((answer, index) => (
              <button
                key={answer.songId}
                onClick={() => handleAnswer(answer.songId)}
                disabled={!!question.selectedSongId || answering}
                className={[
                  "rounded-2xl border px-3 py-3 text-left shadow-md transition",
                  getAnswerStyle(answer.songId),
                ].join(" ")}
              >
                <div className="flex items-center gap-2.5">
                  <span className={["flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black", isLight ? "bg-orange-50 text-orange-700" : "bg-black/35 text-yellow-400"].join(" ")}>
                    {String.fromCharCode(65 + index)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black leading-tight">{answer.title}</p>
                    <p className={["truncate text-xs mt-0.5", isLight ? "text-slate-500" : "text-gray-400"].join(" ")}>
                      {answer.artistName}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Right: desktop ladder ─────────────────────────────────────── */}
        <DesktopLadder
          currentIndex={run.currentQuestionIndex}
          celebrateIndex={celebrateIndex}
          isBreaking={isLadderBreaking}
          isLight={isLight}
          t={t}
        />
      </div>

      {/* ── Mobile ladder drawer ─────────────────────────────────────────── */}
      <LadderDrawer
        open={ladderOpen}
        onClose={() => setLadderOpen(false)}
        currentIndex={run.currentQuestionIndex}
        celebrateIndex={celebrateIndex}
        isBreaking={isLadderBreaking}
        isLight={isLight}
        t={t}
      />

      {/* Hidden audio element — always mounted so the ref persists */}
      <audio
        ref={audioRef}
        onEnded={() => setAudioPlaying(false)}
        onPause={() => setAudioPlaying(false)}
        onPlay={() => setAudioPlaying(true)}
        className="hidden"
      />
    </div>
  );
}
