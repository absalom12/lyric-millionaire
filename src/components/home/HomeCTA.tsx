import { TranslationDictionary } from "../../i18n/translations";
import { DailyArtist, GameModeSlug } from "../../types";
import { cn } from "../../theme/styles";
import { displayFontClass } from "../../theme/fonts";
import ModeButton from "./ModeButton";

function getDailyArtistCover(dailyArtist: DailyArtist | null) {
  if (!dailyArtist) return "";

const record = dailyArtist as unknown as Record<string, unknown>;
const keys = ["coverUrl", "artistCoverUrl", "backgroundUrl", "imageUrl", "image", "cover", "photoUrl", "pictureUrl"];

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

export default function HomeCTA({
  t,
  isLight,
  dailyArtist,
  loadingMode,
  error,
  playMode,
  onPlayModeChange,
  onStartGame,
}: {
  t: TranslationDictionary;
  isLight: boolean;
  dailyArtist: DailyArtist | null;
  loadingMode: GameModeSlug | null;
  error: string;
  playMode: "lyrics" | "blindtest";
  onPlayModeChange: (mode: "lyrics" | "blindtest") => void;
  onStartGame: (mode: GameModeSlug) => void;
}) {
  const dailyArtistCover = getDailyArtistCover(dailyArtist);

  return (
    <aside className="relative w-full lg:max-w-[520px]">
      <div
        className={cn(
          "pointer-events-none absolute -inset-4 rounded-[2.5rem] blur-3xl",
          isLight ? "bg-orange-300/25" : "bg-yellow-400/10"
        )}
      />

      <div
        className={cn(
          "relative overflow-hidden rounded-[2.25rem] border p-4 shadow-2xl backdrop-blur-xl sm:p-5",
          isLight
            ? "border-orange-200 bg-white/78 shadow-orange-100/80"
            : "border-white/10 bg-black/45 shadow-black/40"
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-4 px-1">
          <div>
            <p
              className={cn(
                "text-xs font-black uppercase tracking-[0.24em]",
                isLight ? "text-orange-700" : "text-yellow-400"
              )}
            >
              {t.home.startGame}
            </p>
            <h2 className={cn("mt-1 text-2xl font-black", displayFontClass, isLight ? "text-slate-950" : "text-white")}>
              {t.home.chooseChallenge}
            </h2>
          </div>
        </div>

        {/* Play mode toggle */}
        <div className={cn("mb-4 flex items-center gap-1 rounded-2xl border p-1", isLight ? "border-orange-200 bg-orange-50/50" : "border-white/10 bg-white/[0.03]")}>
          <button
            onClick={() => onPlayModeChange("lyrics")}
            disabled={!!loadingMode}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-black transition disabled:opacity-60",
              playMode === "lyrics"
                ? isLight ? "bg-orange-500 text-white shadow-md" : "bg-yellow-400 text-black shadow-md shadow-yellow-400/20"
                : isLight ? "text-slate-500 hover:text-slate-700" : "text-gray-500 hover:text-gray-300"
            )}
          >
            🎵 Paroles
          </button>
          <button
            onClick={() => onPlayModeChange("blindtest")}
            disabled={!!loadingMode}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-black transition disabled:opacity-60",
              playMode === "blindtest"
                ? isLight ? "bg-orange-500 text-white shadow-md" : "bg-yellow-400 text-black shadow-md shadow-yellow-400/20"
                : isLight ? "text-slate-500 hover:text-slate-700" : "text-gray-500 hover:text-gray-300"
            )}
          >
            🎧 Blindtest
          </button>
        </div>

        <div className="grid gap-4">
          <ModeButton
            eyebrow={t.home.mainMode}
            title={t.home.globalHits}
            subtitle={t.home.globalHitsDescription}
            icon="🌍"
            isPrimary
            isLight={isLight}
            loading={loadingMode === "global-hits"}
            loadingLabel={t.home.creatingGame}
            disabled={!!loadingMode}
            onClick={() => onStartGame("global-hits")}
          />

          <ModeButton
            eyebrow={t.home.artistOfTheDay}
            title={dailyArtist ? dailyArtist.artistName : t.home.mysteryArtist}
            subtitle={dailyArtist ? `${t.home.artistReady} ${dailyArtist.artistName}.` : t.home.artistNotReady}
            icon="🎤"
            isLight={isLight}
            backgroundImageUrl={dailyArtistCover}
            loading={loadingMode === "artist-of-the-day"}
            loadingLabel={t.home.creatingGame}
            disabled={!!loadingMode || !dailyArtist}
            onClick={() => onStartGame("artist-of-the-day")}
          />
        </div>

        {error && (
          <div
            className={cn(
              "mt-4 rounded-2xl border p-4 text-sm font-bold",
              isLight
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-red-500/40 bg-red-500/10 text-red-300"
            )}
          >
            {error}
          </div>
        )}
      </div>
    </aside>
  );
}
