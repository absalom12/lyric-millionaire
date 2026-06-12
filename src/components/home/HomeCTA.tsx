import { TranslationDictionary } from "../../i18n/translations";
import { DailyArtist, GameModeSlug, GamePlaylist } from "../../types";
import { cn } from "../../theme/styles";
import { displayFontClass } from "../../theme/fonts";

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

const PLAYLIST_THEMES = [
  {
    card: { light: "border-orange-200 bg-gradient-to-br from-white to-orange-50 text-slate-900 shadow-orange-100/60", dark: "border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] text-white shadow-black/40" },
    label: { light: "text-orange-600", dark: "text-yellow-400/80" },
  },
  {
    card: { light: "border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 text-slate-900 shadow-blue-100/60", dark: "border-blue-400/20 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 text-white shadow-black/40" },
    label: { light: "text-blue-600", dark: "text-blue-300/80" },
  },
  {
    card: { light: "border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 text-slate-900 shadow-purple-100/60", dark: "border-purple-400/20 bg-gradient-to-br from-purple-500/10 to-pink-500/5 text-white shadow-black/40" },
    label: { light: "text-purple-600", dark: "text-purple-300/80" },
  },
  {
    card: { light: "border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 text-slate-900 shadow-green-100/60", dark: "border-green-400/20 bg-gradient-to-br from-green-500/10 to-emerald-500/5 text-white shadow-black/40" },
    label: { light: "text-green-600", dark: "text-green-300/80" },
  },
];

export default function HomeCTA({
  t,
  isLight,
  dailyArtist,
  playlists,
  loadingMode,
  error,
  playMode,
  onPlayModeChange,
  onStartGame,
}: {
  t: TranslationDictionary;
  isLight: boolean;
  dailyArtist: DailyArtist | null;
  playlists: GamePlaylist[];
  loadingMode: GameModeSlug | null;
  error: string;
  playMode: "lyrics" | "blindtest";
  onPlayModeChange: (mode: "lyrics" | "blindtest") => void;
  onStartGame: (mode: GameModeSlug) => void;
}) {
  const dailyArtistCover = getDailyArtistCover(dailyArtist);
  const isLoading = !!loadingMode;

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
        {/* Play mode toggle */}
        <div className={cn("mb-4 flex items-center gap-1 rounded-2xl border p-1", isLight ? "border-orange-200 bg-orange-50/50" : "border-white/10 bg-white/[0.03]")}>
          <button
            onClick={() => onPlayModeChange("lyrics")}
            disabled={isLoading}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-black transition disabled:opacity-60",
              playMode === "lyrics"
                ? isLight ? "bg-orange-500 text-white shadow-md" : "bg-yellow-400 text-black shadow-md shadow-yellow-400/20"
                : isLight ? "text-slate-500 hover:text-slate-700" : "text-gray-500 hover:text-gray-300"
            )}
          >
            🎵 Paroles
          </button>
          <button
            onClick={() => onPlayModeChange("blindtest")}
            disabled={isLoading}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-black transition disabled:opacity-60",
              playMode === "blindtest"
                ? isLight ? "bg-orange-500 text-white shadow-md" : "bg-yellow-400 text-black shadow-md shadow-yellow-400/20"
                : isLight ? "text-slate-500 hover:text-slate-700" : "text-gray-500 hover:text-gray-300"
            )}
          >
            🎧 Blindtest
          </button>
        </div>

        {/* ── Hero: Artiste du Jour ── */}
        <button
          onClick={() => onStartGame("artist-of-the-day")}
          disabled={isLoading || !dailyArtist}
          className={cn(
            "group relative mb-3 w-full overflow-hidden rounded-[1.6rem] border text-left transition",
            "min-h-[200px] shadow-2xl",
            "hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
            dailyArtistCover
              ? isLight
                ? "border-orange-300 bg-slate-950 text-white"
                : "border-yellow-400/30 bg-black text-white"
              : isLight
              ? "border-orange-200 bg-gradient-to-br from-orange-500 to-amber-600 text-white"
              : "border-yellow-400/20 bg-gradient-to-br from-yellow-400/20 to-amber-500/10 text-white"
          )}
        >
          {/* Background cover art */}
          {dailyArtistCover && (
            <>
              <img
                src={dailyArtistCover}
                alt=""
                aria-hidden="true"
                loading="eager"
                className="absolute inset-0 h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-105"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-black/10" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </>
          )}

          {/* Glow pulse on no-cover fallback */}
          {!dailyArtistCover && (
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-transparent" />
          )}

          <div className="relative z-10 flex h-full flex-col justify-between p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={cn(
                  "text-[11px] font-black uppercase tracking-[0.26em] drop-shadow",
                  isLight && !dailyArtistCover ? "text-white/80" : "text-yellow-300"
                )}>
                  {t.home.artistOfTheDay}
                </p>
                <h2 className={cn("mt-2 text-3xl font-black drop-shadow-lg leading-tight", displayFontClass)}>
                  {loadingMode === "artist-of-the-day"
                    ? t.home.creatingGame
                    : dailyArtist
                    ? dailyArtist.artistName
                    : t.home.mysteryArtist}
                </h2>
              </div>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-black/30 text-3xl shadow-lg backdrop-blur-sm transition group-hover:scale-110">
                {loadingMode === "artist-of-the-day" ? "⏳" : "🎤"}
              </span>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-white/80 drop-shadow leading-relaxed">
                {dailyArtist
                  ? `${t.home.artistReady} ${dailyArtist.artistName}.`
                  : t.home.artistNotReady}
              </p>
              <span className={cn(
                "shrink-0 rounded-xl px-3 py-1.5 text-xs font-black shadow",
                isLight
                  ? "bg-white text-orange-600"
                  : "bg-yellow-400 text-black"
              )}>
                Jouer →
              </span>
            </div>
          </div>
        </button>

        {/* ── Playlist game modes (dynamic) ── */}
        {playlists.length > 0 && (
          <div className={cn("grid gap-3", playlists.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
            {playlists.map((playlist, i) => {
              const theme = PLAYLIST_THEMES[i % PLAYLIST_THEMES.length];
              const isPlaylistLoading = loadingMode === playlist.slug;
              return (
                <button
                  key={playlist.slug}
                  onClick={() => onStartGame(playlist.slug)}
                  disabled={isLoading}
                  className={cn(
                    "group relative min-h-[120px] overflow-hidden rounded-[1.4rem] border p-4 text-left shadow-xl transition",
                    "hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
                    isLight ? theme.card.light : theme.card.dark
                  )}
                >
                  <div className="flex flex-col h-full justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        "text-[10px] font-black uppercase tracking-[0.22em]",
                        isLight ? theme.label.light : theme.label.dark
                      )}>
                        Mode
                      </p>
                      <span className="text-2xl transition group-hover:scale-110">
                        {isPlaylistLoading ? "⏳" : (playlist.emoji ?? "🎵")}
                      </span>
                    </div>
                    <p className={cn("text-base font-black leading-tight", displayFontClass)}>
                      {isPlaylistLoading ? t.home.creatingGame : playlist.name}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

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
