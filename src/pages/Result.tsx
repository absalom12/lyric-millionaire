import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getGameRun, generateGameRun } from "../lib/gameEngine";
import { updateDocument } from "../lib/firebase";
import { GameRun } from "../types";
import ThemeToggle, { useAppTheme } from "../components/ThemeToggle";
import LanguageSelector from "../components/LanguageSelector";
import { useLanguage } from "../i18n/LanguageContext";
import { TranslationDictionary } from "../i18n/translations";
import { Sounds } from "../lib/sounds";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDuration(ms?: number): string {
  if (!ms) return "—";
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes <= 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

function getFunnyComment(score: number, status: string, t: TranslationDictionary): string {
  const fc = t.funnyComments;
  if (status === "won" || score >= 1_000_000) return fc.winner;
  if (score >= 500_000) return fc.amazing;
  if (score >= 100_000) return fc.great;
  if (score >= 25_000) return fc.good;
  if (score >= 10_000) return fc.medium;
  if (score >= 500) return fc.small;
  if (score >= 100) return fc.tiny;
  return fc.zero;
}

function getResultStatus(run: GameRun, t: TranslationDictionary) {
  const status = String(run.status);
  if (status === "won") {
    return {
      label: t.result.youWon,
      title: t.result.winnerTitle,
      emoji: "👑",
      description: t.result.winnerDescription,
      tone: "win" as const,
    };
  }
  if (status === "lost") {
    return {
      label: t.result.gameOver,
      title: t.result.lostTitle,
      emoji: "💔",
      description: t.result.lostDescription,
      tone: "lost" as const,
    };
  }
  return {
    label: t.result.gameCompleted,
    title: t.result.neutralTitle,
    emoji: "🎵",
    description: t.result.neutralDescription,
    tone: "neutral" as const,
  };
}

function getMoneyReached(run: GameRun): number {
  return Number(run.score ?? 0);
}

function FloatingResultBackground({ isLight }: { isLight: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className={["absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full blur-3xl soft-pulse", isLight ? "bg-orange-400/20" : "bg-yellow-400/12"].join(" ")} />
      <div className={["absolute bottom-[-8rem] right-[-8rem] h-96 w-96 rounded-full blur-3xl soft-pulse", isLight ? "bg-emerald-400/20" : "bg-green-400/10"].join(" ")} />
      <p className={["lyric-float absolute -left-10 top-32 text-6xl font-black", isLight ? "text-orange-700/10" : "text-white/10"].join(" ")}>“millionaire”</p>
      <p className={["lyric-float absolute -right-16 bottom-40 text-6xl font-black [animation-delay:1.4s]", isLight ? "text-emerald-600/10" : "text-yellow-400/10"].join(" ")}>“final answer”</p>
      <div className="mic-float absolute left-[8%] bottom-[18%] text-7xl opacity-10">🎙️</div>
    </div>
  );
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

async function createResultImage({
  title,
  label,
  money,
  duration,
  playModeLabel,
  contentLabel,
  isWinner,
  t,
}: {
  title: string;
  label: string;
  money: number;
  duration: string;
  playModeLabel: string;
  contentLabel: string;
  isWinner: boolean;
  t: TranslationDictionary;
}): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");

  const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, "#050509");
  gradient.addColorStop(0.45, "#07120d");
  gradient.addColorStop(1, "#120b24");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1350);

  ctx.fillStyle = isWinner ? "rgba(250, 204, 21, 0.18)" : "rgba(239, 68, 68, 0.16)";
  ctx.beginPath();
  ctx.arc(180, 140, 220, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(34, 197, 94, 0.14)";
  ctx.beginPath();
  ctx.arc(930, 320, 260, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(124, 58, 237, 0.16)";
  ctx.beginPath();
  ctx.arc(560, 1250, 360, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  ctx.font = "900 72px Arial";
  ctx.fillText("“final answer”", 48, 250);
  ctx.fillText("“millionaire”", 520, 1150);

  drawRoundedRect(ctx, 90, 150, 900, 1050, 48);
  ctx.fillStyle = "rgba(5, 5, 9, 0.78)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = isWinner ? "#facc15" : "#fb7185";
  ctx.font = "900 34px Arial";
  ctx.fillText(t.common.brand.toUpperCase(), 150, 245);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 92px Arial";
  ctx.fillText(label.toUpperCase(), 150, 380);

  ctx.fillStyle = isWinner ? "#facc15" : "#fb7185";
  ctx.font = "900 118px Arial";
  ctx.fillText(formatMoney(money), 150, 560);

  ctx.fillStyle = "#9ca3af";
  ctx.font = "700 34px Arial";
  ctx.fillText(title, 150, 630);

  const statY = 760;
  const imageStats = [
    [t.result.time, duration],
    ["MODE", playModeLabel],
    ["CONTENU", contentLabel],
  ];

  imageStats.forEach(([statLabel, value], index) => {
    const x = 120 + index * 290;
    drawRoundedRect(ctx, x, statY, 260, 150, 28);
    ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
    ctx.fill();
    ctx.fillStyle = "#9ca3af";
    ctx.font = "800 18px Arial";
    ctx.fillText(String(statLabel).toUpperCase(), x + 18, statY + 48);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 28px Arial";
    ctx.fillText(String(value), x + 18, statY + 105);
  });

  ctx.fillStyle = "#facc15";
  ctx.font = "900 42px Arial";
  ctx.fillText(t.common.tagline, 150, 1050);
  ctx.fillStyle = "#9ca3af";
  ctx.font = "700 28px Arial";
  ctx.fillText(t.result.imageSubtitle, 150, 1100);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to generate image."));
        return;
      }
      resolve(new File([blob], "lyric-millionaire-result.png", { type: "image/png" }));
    }, "image/png");
  });
}

export default function Result() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { theme, isLight, toggleTheme } = useAppTheme();
  const { t, language } = useLanguage();

  const [run, setRun] = useState<(GameRun & { id: string; shareClicks?: number }) | null>(null);
  const [sharingImage, setSharingImage] = useState(false);
  const [sharingLink, setSharingLink] = useState(false);
  const [message, setMessage] = useState("");
  const [restartingGame, setRestartingGame] = useState(false);

  useEffect(() => {
    if (!runId) return;
    getGameRun(runId).then(r => {
      setRun(r as GameRun & { id: string; shareClicks?: number });
      if (r) Sounds.victory();
    });
  }, [runId]);

  const stats = useMemo(() => {
    if (!run) return { correct: 0, total: 0, pct: 0 };
    const correct = run.questions.filter((q) => q.isCorrect).length;
    const total = run.questions.length;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    return { correct, total, pct };
  }, [run]);

  function getContentLabel(gameRun: GameRun): string {
    if (gameRun.modeSlug === "artist-of-the-day") {
      const name = (gameRun as any).artistName ?? (gameRun as any).dailyArtistName;
      return name ? name : "Artiste du jour";
    }
    return "Global Hits";
  }

  function getPlayModeLabel(gameRun: GameRun): string {
    return gameRun.playMode === "blindtest" ? "🎧 Blindtest" : "🎵 Paroles";
  }

  const pageBg = isLight ? "bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-100 text-slate-950" : "bg-[#050509] text-white";

  if (!run) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${pageBg}`}>
        <div className="text-center">
          <div className={["mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4", isLight ? "border-orange-100 border-t-orange-500" : "border-white/10 border-t-yellow-400"].join(" ")} />
          <p className={isLight ? "text-sm font-bold text-slate-500" : "text-sm font-bold text-gray-400"}>{t.common.loadingResult}</p>
        </div>
      </div>
    );
  }

  const result = getResultStatus(run, t);
  const moneyReached = getMoneyReached(run);
  const duration = formatDuration(run.totalTimeMs);
  const isWinner = String(run.status) === "won";

  const incrementShareClicks = async () => {
    if (!runId) return;
    const nextShareClicks = Number(run.shareClicks ?? 0) + 1;
    await updateDocument("gameRuns", runId, { shareClicks: nextShareClicks });
    setRun((prev) => (prev ? ({ ...prev, shareClicks: nextShareClicks } as any) : prev));
  };


  const handlePlayAgain = async () => {
    if (!run) return;

    setRestartingGame(true);
    setMessage("");

    try {
      const modeSlug = run.modeSlug ?? "global-hits";
      const artistId =
        modeSlug === "artist-of-the-day"
          ? (run as any).artistId ?? (run as any).dailyArtistId
          : undefined;

      const newRunId = await generateGameRun(modeSlug, artistId, {
        language,
        theme,
        playMode: run.playMode as "lyrics" | "blindtest" | undefined,
      });

      navigate(`/game/${newRunId}`);
    } catch (err) {
      setMessage(`Unable to start a new game: ${String(err)}`);
      setRestartingGame(false);
    }
  };

  const handleShareLink = async () => {
    if (!runId) return;
    setSharingLink(true);
    setMessage("");
    const text = `${t.result.shareTextPrefix} ${formatMoney(moneyReached)} ${t.result.shareTextSuffix}`;
    const url = window.location.origin;

    try {
      await incrementShareClicks();
      if (navigator.share) {
        await navigator.share({ title: t.common.brand, text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setMessage(t.result.shareLinkCopied);
      }
    } catch {
      setMessage(t.result.shareCancelled);
    } finally {
      setSharingLink(false);
    }
  };

  const handleShareImage = async () => {
    setSharingImage(true);
    setMessage("");

    try {
      const image = await createResultImage({
        title: result.title,
        label: result.label,
        money: moneyReached,
        duration,
        playModeLabel: getPlayModeLabel(run),
        contentLabel: getContentLabel(run),
        isWinner,
        t,
      });

      await incrementShareClicks();

      if (navigator.canShare && navigator.canShare({ files: [image] })) {
        await navigator.share({ title: t.common.brand, text: `${t.result.shareTextPrefix} ${formatMoney(moneyReached)} ${t.result.shareTextSuffix}`, files: [image] });
      } else {
        const imageUrl = URL.createObjectURL(image);
        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = "lyric-millionaire-result.png";
        link.click();
        URL.revokeObjectURL(imageUrl);
        setMessage(t.result.resultImageDownloaded);
      }
    } catch {
      setMessage(t.result.unableToShareImage);
    } finally {
      setSharingImage(false);
    }
  };

  return (
    <div className={`relative min-h-screen overflow-hidden ${pageBg}`}>
      <FloatingResultBackground isLight={isLight} />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-4 lg:px-8 lg:py-6">
        <header className="flex items-center justify-between gap-4">
          <button onClick={() => navigate("/")} className="flex items-center gap-3 text-left transition hover:opacity-80">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl"><img src="/logo-mark.png" alt="Lyric Millionaire" className="h-full w-full object-contain" /></div>
            <div>
              <p className="text-sm font-black leading-none">{t.common.brand}</p>
              <p className={isLight ? "text-xs text-slate-500" : "text-xs text-gray-500"}>{t.common.tagline}</p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <LanguageSelector isLight={isLight} />
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </header>

        <section className="grid flex-1 items-start gap-4 py-4 lg:grid-cols-[1fr_420px] lg:gap-8 lg:py-8">
          <div className="flex flex-col gap-4 lg:gap-5">
            <div className={["relative overflow-hidden rounded-[1.7rem] border p-4 shadow-2xl backdrop-blur-xl sm:rounded-[2.4rem] sm:p-8", isLight ? "border-orange-200 bg-white/85 shadow-orange-200/50" : "border-white/10 bg-gray-950/80 shadow-black/50"].join(" ")}>
              <div className={["absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl", result.tone === "win" ? isLight ? "bg-orange-400/30" : "bg-yellow-400/20" : "bg-red-500/20"].join(" ")} />

              <div className="relative">
                <div className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <p className={["text-[10px] font-black uppercase tracking-[0.25em] sm:text-xs", isLight ? "text-orange-700" : "text-yellow-400"].join(" ")}>{t.result.finalAnswer}</p>
                    <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-7xl">{result.label}</h1>
                  </div>
                  <div className="text-5xl sm:text-6xl">{result.emoji}</div>
                </div>

                <div className="mt-5 sm:mt-8">
                  <p className={["text-[10px] font-black uppercase tracking-[0.24em] sm:text-xs", isLight ? "text-slate-500" : "text-gray-500"].join(" ")}>{t.result.moneyReached}</p>
                  <p className={["mt-2 text-5xl font-black tracking-tight sm:text-8xl", result.tone === "win" ? isLight ? "text-orange-600" : "text-yellow-400" : "text-red-400"].join(" ")}>{formatMoney(moneyReached)}</p>
                  <p className={["mt-3 max-w-xl text-sm font-bold sm:mt-4 sm:text-lg", isLight ? "text-slate-600" : "text-gray-400"].join(" ")}>
                    {getFunnyComment(moneyReached, String(run.status), t)}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 sm:mt-8 sm:gap-3">
                  {[
                    [t.result.time, duration],
                    ["Mode", getPlayModeLabel(run)],
                    ["Contenu", getContentLabel(run)],
                  ].map(([label, value]) => (
                    <div key={label} className={["rounded-xl border p-2.5 sm:rounded-2xl sm:p-4", isLight ? "border-orange-100 bg-white/70" : "border-white/10 bg-black/25"].join(" ")}>
                      <p className="truncate text-[10px] font-bold text-gray-500 sm:text-xs">{label}</p>
                      <p className="mt-1 truncate text-sm font-black sm:text-xl">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={["rounded-[1.5rem] border p-4 shadow-xl backdrop-blur-xl sm:rounded-[2rem] sm:p-5", isLight ? "border-orange-200 bg-white/80 shadow-orange-100" : "border-white/10 bg-gray-950/70 shadow-black/30"].join(" ")}>
              <p className={["text-xs font-black uppercase tracking-[0.25em]", isLight ? "text-orange-700" : "text-yellow-400"].join(" ")}>{t.result.shareYourRun}</p>
              <p className={["mt-2 hidden text-sm font-bold leading-6 sm:block", isLight ? "text-slate-500" : "text-gray-400"].join(" ")}>{t.result.shareDescription}</p>

              <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-5 sm:gap-3">
                <button onClick={handleShareImage} disabled={sharingImage || sharingLink} className={["rounded-xl px-2 py-3 text-xs font-black transition active:scale-[0.98] disabled:opacity-50 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-sm", isLight ? "bg-orange-500 text-white hover:bg-orange-400" : "bg-yellow-400 text-black hover:bg-yellow-300"].join(" ")}>{sharingImage ? t.common.creatingImage : t.common.shareImage}</button>
                <button onClick={handleShareLink} disabled={sharingImage || sharingLink} className={["rounded-xl border px-2 py-3 text-xs font-black transition active:scale-[0.98] disabled:opacity-50 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-sm", isLight ? "border-orange-200 bg-white text-orange-700 hover:bg-orange-50" : "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"].join(" ")}>{sharingLink ? t.common.sharingLink : t.common.shareLink}</button>
                <button
                  onClick={handlePlayAgain}
                  disabled={sharingImage || sharingLink || restartingGame}
                  className={[
                    "rounded-xl border px-2 py-3 text-xs font-black transition active:scale-[0.98] disabled:opacity-50 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-sm",
                    isLight
                      ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                      : "border-green-400/20 bg-green-400/10 text-green-300 hover:bg-green-400/15",
                  ].join(" ")}
                >
                  {restartingGame ? "Starting…" : t.common.playAgain}
                </button>
              </div>

              {message && <div className={["mt-4 rounded-2xl border p-3 text-sm font-bold", isLight ? "border-orange-200 bg-orange-50 text-orange-700" : "border-white/10 bg-white/[0.04] text-gray-300"].join(" ")}>{message}</div>}
            </div>
          </div>

          <aside className={["rounded-[1.5rem] border p-4 sm:rounded-[2rem] sm:p-5", isLight ? "border-orange-200 bg-white/60" : "border-white/10 bg-white/[0.03]"].join(" ")}>
            <p className={["text-xs font-black uppercase tracking-[0.25em]", isLight ? "text-orange-700" : "text-yellow-400"].join(" ")}>{t.result.runDetails}</p>
            <div className="mt-4 flex max-h-[360px] flex-col gap-3 overflow-y-auto pr-1">
              {run.questions.filter((q) => q.selectedSongId).map((question) => {
                const realIndex = run.questions.indexOf(question);
                return (
                <div key={`${question.snippetId}-${realIndex}`} className={["flex items-center justify-between gap-3 rounded-2xl border px-3 py-3", question.isCorrect ? isLight ? "border-green-200 bg-green-50 text-green-700" : "border-green-500/25 bg-green-500/10 text-green-300" : isLight ? "border-red-200 bg-red-50 text-red-700" : "border-red-500/25 bg-red-500/10 text-red-300"].join(" ")}>
                  <span className="text-sm font-black">Q{realIndex + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{question.correctTitle}</p>
                    <p className="truncate text-xs font-bold text-gray-500">{question.correctArtist}</p>
                  </div>
                  <span>{question.isCorrect ? "✅" : "❌"}</span>
                </div>
              );
              })}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}