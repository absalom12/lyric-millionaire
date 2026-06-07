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

function FloatingGameBackground({ isLight }: { isLight: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className={["absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full blur-3xl soft-pulse", isLight ? "bg-orange-400/20" : "bg-yellow-400/10"].join(" ")} />
      <div className={["absolute bottom-[-8rem] right-[-8rem] h-96 w-96 rounded-full blur-3xl soft-pulse", isLight ? "bg-emerald-400/20" : "bg-green-400/10"].join(" ")} />
      <p className={["lyric-float absolute -left-10 top-32 text-6xl font-black", isLight ? "text-orange-700/10" : "text-white/10"].join(" ")}>"lyrics"</p>
      <p className={["lyric-float absolute -right-16 bottom-40 text-6xl font-black [animation-delay:1.4s]", isLight ? "text-emerald-600/10" : "text-yellow-400/10"].join(" ")}>"million"</p>
      <div className="mic-float absolute left-[7%] bottom-[18%] text-7xl opacity-10">🎙️</div>
    </div>
  );
}

function MoneyLadder({
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
        "relative overflow-hidden rounded-[2rem] border p-5 shadow-2xl backdrop-blur-xl transition-all",
        isLight ? "border-orange-200 bg-white/85 shadow-orange-200/50" : "border-white/10 bg-gray-950/80 shadow-black/50",
        isBreaking ? "ladder-breaking" : "",
      ].join(" ")}
    >
      {isBreaking && (
        <>
          <div className="ladder-crack absolute left-[28%] top-8 h-[78%] w-[2px] rotate-[11deg] bg-red-400/70" />
          <div className="ladder-crack absolute left-[55%] top-20 h-[62%] w-[2px] rotate-[-14deg] bg-red-400/60" />
          <div className="ladder-crack absolute left-[72%] top-14 h-[70%] w-[2px] rotate-[8deg] bg-red-400/50" />
          <div className="absolute inset-0 bg-red-500/10" />
        </>
      )}

      <div className="relative mb-5">
        <p className={["text-[11px] font-black uppercase tracking-[0.25em]", isLight ? "text-orange-700" : "text-yellow-400"].join(" ")}>{t.game.moneyLadder}</p>
        <p className={["mt-2 text-sm font-bold", isLight ? "text-slate-500" : "text-gray-500"].join(" ")}>{t.game.ladderHint}</p>
      </div>

      <div className="relative flex flex-col-reverse gap-2.5">
        {MONEY_LADDER.map((amount, index) => {
          const isCurrent = index === currentIndex;
          const isPassed = index < currentIndex;
          const isMillion = amount === 1_000_000;
          const shouldCelebrate = celebrateIndex === index;
          const widthPercent = 70 + index * 3;
          const scale = 1 + index * 0.014;

          return (
            <div
              key={amount}
              className={[
                "relative flex items-center justify-center rounded-2xl border px-4 py-3 text-sm transition-all duration-500",
                isCurrent
                  ? isLight
                    ? "border-blue-500 bg-orange-500 text-white shadow-xl shadow-orange-300/50"
                    : "border-yellow-400 bg-yellow-400 text-black shadow-xl shadow-yellow-400/30"
                  : isPassed
                  ? isLight
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-green-500/30 bg-green-500/10 text-green-300"
                  : isLight
                  ? "border-orange-100 bg-white/60 text-slate-500"
                  : "border-white/10 bg-white/[0.035] text-gray-400",
                isMillion ? "million-glow" : "",
                shouldCelebrate ? "ladder-correct-pulse ladder-unlock-glow" : "",
                isBreaking && !isPassed && !isCurrent ? "opacity-30 blur-[1px]" : "",
              ].join(" ")}
              style={{ width: `${widthPercent}%`, transform: `scale(${scale})`, alignSelf: "center" }}
            >
              {shouldCelebrate && (
                <>
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 ladderCoinBurst text-xl">🪙</span>
                  <span className="absolute -top-2 left-[35%] ladderCoinBurst text-sm [animation-delay:0.08s]">✨</span>
                  <span className="absolute -top-2 right-[30%] ladderCoinBurst text-sm [animation-delay:0.16s]">✨</span>
                </>
              )}
              <div className="flex items-center gap-2">
                <span className={["font-black", isMillion ? "text-base sm:text-lg" : ""].join(" ")}>{formatMoney(amount)}</span>
                {isMillion && <span className="text-lg">👑</span>}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function JokerPanel({
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
    <div className={["rounded-[1.5rem] border p-4 shadow-lg backdrop-blur-xl", isLight ? "border-orange-200 bg-white/80 shadow-orange-100/70" : "border-white/10 bg-gray-950/70 shadow-black/30"].join(" ")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={["text-xs font-black uppercase tracking-[0.2em]", isLight ? "text-orange-700" : "text-yellow-400"].join(" ")}>{t.game.jokerTitle}</p>
          <p className={["mt-1 text-sm font-bold", isLight ? "text-slate-500" : "text-gray-400"].join(" ")}>{t.game.jokerDescription}</p>
        </div>

        {used && releaseYear ? (
          <div className={["rounded-2xl border px-5 py-3 text-center", isLight ? "border-orange-200 bg-orange-50 text-orange-700" : "border-yellow-400/30 bg-yellow-400/10 text-yellow-300"].join(" ")}>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{t.game.revealed}</p>
            <p className="text-2xl font-black">{releaseYear}</p>
          </div>
        ) : (
          <button
            onClick={onUse}
            disabled={disabled}
            className={["rounded-2xl px-5 py-3 text-sm font-black transition active:scale-[0.98] disabled:opacity-40", isLight ? "bg-orange-500 text-white hover:bg-orange-400" : "bg-yellow-400 text-black hover:bg-yellow-300"].join(" ")}
          >
            {t.game.useJoker} · {left} {t.game.left}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Game() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { theme, isLight, toggleTheme } = useAppTheme();
  const { t } = useLanguage();

  // ── State — tous les hooks AVANT tout return conditionnel ──
  const [run, setRun] = useState<(GameRun & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState(false);
  const [gameOverMessage, setGameOverMessage] = useState("");
  const [celebrateIndex, setCelebrateIndex] = useState<number | null>(null);
  const [showCorrectMessage, setShowCorrectMessage] = useState(false);
  const [isLadderBreaking, setIsLadderBreaking] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const answeringRef = useRef(false);

  useEffect(() => {
    if (!runId) return;
    getGameRun(runId).then((gameRun) => {
      setRun(gameRun);
      setLoading(false);
      setTimerEnabled(true);
    });
  }, [runId]);

  // ── Dérivés — calculés avant les early returns ──
  const question = run
    ? (run.questions[run.currentQuestionIndex] as GameQuestionWithMeta)
    : null;
  const isLastQuestion = run
    ? run.currentQuestionIndex === run.questions.length - 1
    : false;
  const currentMoney = run
    ? MONEY_LADDER[run.currentQuestionIndex] ?? MONEY_LADDER[MONEY_LADDER.length - 1]
    : 0;
  const securedMoney =
    run && run.currentQuestionIndex > 0
      ? MONEY_LADDER[run.currentQuestionIndex - 1]
      : 0;

  // ── handleAnswer déclaré avant useQuestionTimer ──
  const handleAnswer = async (songId: string, fromTimer = false) => {
    if (answeringRef.current || !run || !question) return;
    if (!fromTimer && question.selectedSongId) return;

    answeringRef.current = true;
    setAnswering(true);
    setTimerEnabled(false);

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
      ...(isLastQuestion
        ? { endedAt: serverTimestamp(), totalTimeMs: Date.now() - run.startedAt.toMillis() }
        : {}),
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

  // ── Timer — hook appelé ici, après tous les useState/useRef/useEffect ──
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
        ? "border-orange-100 bg-white/85 text-slate-900 hover:border-orange-300 hover:bg-orange-50"
        : "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]";
    }
    if (songId === question.correctSongId) return "border-green-400/60 bg-green-500/20 text-green-100";
    if (songId === question.selectedSongId) return "border-red-400/60 bg-red-500/20 text-red-100";
    return isLight
      ? "border-orange-100 bg-white/50 text-slate-300 opacity-60"
      : "border-white/10 bg-white/[0.02] text-gray-600 opacity-60";
  };

  const pageBg = isLight
    ? "bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-100 text-slate-950"
    : "bg-[#050509] text-white";

  // ── Early returns APRÈS tous les hooks ──
  if (loading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${pageBg}`}>
        <div className="text-center">
          <div className={["mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4", isLight ? "border-orange-100 border-t-orange-500" : "border-white/10 border-t-yellow-400"].join(" ")} />
          <p className={isLight ? "text-sm font-bold text-slate-500" : "text-sm font-bold text-gray-400"}>{t.common.loadingGame}</p>
        </div>
      </div>
    );
  }

  if (!run || !question) {
    return (
      <div className={`flex min-h-screen items-center justify-center px-5 text-center ${pageBg}`}>
        <div>
          <p className="text-3xl font-black">{t.game.gameNotFound}</p>
          <button onClick={() => navigate("/")} className={["mt-5 rounded-2xl px-6 py-3 font-black", isLight ? "bg-orange-500 text-white" : "bg-yellow-400 text-black"].join(" ")}>{t.game.backHome}</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen overflow-hidden ${pageBg}`}>
      <FloatingGameBackground isLight={isLight} />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 lg:px-8">
        <header className="flex items-start justify-between gap-4">
          <button onClick={() => navigate("/")} className="flex items-center gap-3 text-left transition hover:opacity-80">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl"><img src="/logo-mark.png" alt="Lyric Millionaire" className="h-full w-full object-contain" /></div>
            <div>
              <p className={["text-xl font-black leading-none tracking-tight sm:text-2xl", isLight ? "text-slate-950" : "text-white"].join(" ")}>{t.common.brand}</p>
              <p className={["mt-1 text-sm font-bold", isLight ? "text-orange-700" : "text-yellow-400"].join(" ")}>{t.common.tagline}</p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <LanguageSelector isLight={isLight} />
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </header>

        {/* ── Timer ── */}
        <div className="mt-4 flex items-center gap-3">
          <div className={["relative flex-1 h-2 rounded-full overflow-hidden", isLight ? "bg-orange-100" : "bg-white/10"].join(" ")}>
            <div
              className={["absolute left-0 top-0 h-full rounded-full", isUrgent ? "bg-red-500" : isLight ? "bg-orange-500" : "bg-yellow-400"].join(" ")}
              style={{ width: `${progress * 100}%`, transition: "width 1s linear" }}
            />
          </div>
          <span className={["text-sm font-black w-6 text-right tabular-nums", isUrgent ? "text-red-400" : isLight ? "text-orange-700" : "text-gray-400"].join(" ")}>
            {timeLeft}
          </span>
        </div>

        <div className="mt-6 grid flex-1 gap-6 lg:grid-cols-[1fr_370px]">
          <section className="flex flex-col justify-center py-4">
            <div className="mb-5">
              <p className={["text-xs font-black uppercase tracking-[0.22em]", isLight ? "text-orange-700" : "text-yellow-400"].join(" ")}>
                {t.game.question} {run.currentQuestionIndex + 1}
                <span className={isLight ? "text-slate-400" : "text-gray-600"}> / {run.questions.length}</span>
              </p>

              <div className={["mt-4 h-2 rounded-full", isLight ? "bg-orange-100" : "bg-white/10"].join(" ")}>
                <div
                  className={["h-2 rounded-full transition-all duration-500", isLight ? "bg-orange-500" : "bg-yellow-400"].join(" ")}
                  style={{ width: `${((run.currentQuestionIndex + 1) / run.questions.length) * 100}%` }}
                />
              </div>
            </div>

            {gameOverMessage && (
              <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-center text-lg font-black text-red-300">
                {gameOverMessage}
              </div>
            )}

            <div className="mb-4">
              <JokerPanel
                left={run.jokerYearLeft}
                used={question.usedJokerYear}
                disabled={run.jokerYearLeft <= 0 || !!question.selectedSongId || !!question.usedJokerYear}
                releaseYear={question.releaseYear}
                onUse={handleJoker}
                isLight={isLight}
                t={t}
              />
            </div>

            <div
              key={`${run.currentQuestionIndex}-${question.snippetId}`}
              className={["question-enter rounded-[2rem] border p-7 shadow-2xl backdrop-blur-xl", isLight ? "border-orange-200 bg-white/85 shadow-orange-200/50" : "border-white/10 bg-gray-950/75 shadow-black/40", showCorrectMessage ? "correct-flash" : ""].join(" ")}
            >
              <p className={["text-4xl font-black leading-tight tracking-tight sm:text-6xl", isLight ? "text-slate-950" : "text-white"].join(" ")}>
                "{question.snippetText}"
              </p>

              {showCorrectMessage && (
                <div className={["success-pop mt-6 inline-flex rounded-full border px-4 py-2 text-sm font-black", isLight ? "border-green-300 bg-green-50 text-green-700" : "border-green-400/30 bg-green-500/10 text-green-300"].join(" ")}>
                  {t.game.correctAnswer} · {formatMoney(currentMoney)}
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {question.answers.map((answer, index) => (
                <button
                  key={answer.songId}
                  onClick={() => handleAnswer(answer.songId)}
                  disabled={!!question.selectedSongId || answering}
                  className={["group min-h-[108px] rounded-2xl border px-4 py-4 text-left shadow-lg shadow-black/10 transition active:scale-[0.98]", getAnswerStyle(answer.songId)].join(" ")}
                >
                  <div className="flex h-full items-center gap-4">
                    <span className={["flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black", isLight ? "bg-orange-50 text-orange-700" : "bg-black/35 text-yellow-400"].join(" ")}>
                      {String.fromCharCode(65 + index)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-black">{answer.title}</p>
                      <p className={["mt-1 truncate text-sm", isLight ? "text-slate-500" : "text-gray-400"].join(" ")}>{answer.artistName}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <div className="flex items-center">
            <MoneyLadder
              currentIndex={run.currentQuestionIndex}
              celebrateIndex={celebrateIndex}
              isBreaking={isLadderBreaking}
              isLight={isLight}
              t={t}
            />
          </div>
        </div>
      </main>
    </div>
  );
}