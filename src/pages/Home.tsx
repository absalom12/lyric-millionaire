import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppTheme } from "../components/ThemeToggle";
import { useLanguage } from "../i18n/LanguageContext";
import { getDocument, getDocuments, where, limit } from "../lib/firebase";
import { generateGameRun } from "../lib/gameEngine";
import { Artist, DailyArtist, GameModeSlug } from "../types";
import PageShell from "../components/layout/PageShell";
import Header from "../components/layout/Header";
import HeroSection from "../components/home/HeroSection";
import HomeCTA from "../components/home/HomeCTA";
import { getTodayLocalDate } from "../utils/date";
import { cn } from "../theme/styles";

function readCoverUrl(source: unknown) {
  if (!source || typeof source !== "object") return "";

  const record = source as Record<string, unknown>;
  const keys = [
    "coverUrl",
    "artistCoverUrl",
    "backgroundUrl",
    "imageUrl",
    "image",
    "cover",
    "photoUrl",
    "pictureUrl",
  ];

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function getDailyArtistCover(dailyArtist: DailyArtist | null) {
  return readCoverUrl(dailyArtist);
}

async function findArtistByName(artistName: string) {
  if (!artistName) return null;

  const matches = await getDocuments<Artist>("artists", [where("name", "==", artistName), limit(1)]);

  return matches[0] ?? null;
}

export default function Home() {
  const navigate = useNavigate();
  const { theme, isLight, toggleTheme } = useAppTheme();
  const { t, language } = useLanguage();

  const [dailyArtist, setDailyArtist] = useState<DailyArtist | null>(null);
  const [loadingMode, setLoadingMode] = useState<GameModeSlug | null>(null);
  const [error, setError] = useState("");
  const [playMode, setPlayMode] = useState<"lyrics" | "blindtest">("lyrics");

  useEffect(() => {
    const today = getTodayLocalDate();
    let cancelled = false;

    async function enrichDailyArtist(nextDailyArtist: DailyArtist | null) {
      if (!nextDailyArtist) return null;
      if (getDailyArtistCover(nextDailyArtist)) return nextDailyArtist;

      try {
        let artist: Artist | null = null;

        if (nextDailyArtist.artistId) {
          artist = await getDocument<Artist>("artists", nextDailyArtist.artistId);
        }

        const artistCover = readCoverUrl(artist);

        if (!artistCover && nextDailyArtist.artistName) {
          const artistByName = await findArtistByName(nextDailyArtist.artistName);

          if (readCoverUrl(artistByName) || !artist) {
            artist = artistByName;
          }
        }

        const resolvedCover = readCoverUrl(nextDailyArtist) || readCoverUrl(artist);

        return {
          ...nextDailyArtist,
          coverUrl: resolvedCover,
          artistCoverUrl: resolvedCover,
        };
      } catch (error) {
        console.error("Unable to load daily artist cover", error);
        return nextDailyArtist;
      }
    }

    async function loadDailyArtist() {
      try {
        const directDailyArtist = await getDocument<DailyArtist>("dailyArtists", today);

        if (directDailyArtist) {
          const enriched = await enrichDailyArtist(directDailyArtist);
          if (!cancelled) setDailyArtist(enriched);
          return;
        }

        const matchingDailyArtists = await getDocuments<DailyArtist>("dailyArtists", [
          where("date", "==", today),
          limit(1),
        ]);

        const enriched = await enrichDailyArtist(matchingDailyArtists[0] ?? null);
        if (!cancelled) setDailyArtist(enriched);
      } catch (error) {
        console.error("Unable to load daily artist", error);
        if (!cancelled) setDailyArtist(null);
      }
    }

    loadDailyArtist();

    return () => {
      cancelled = true;
    };
  }, []);

  const startGame = async (mode: GameModeSlug) => {
    setError("");
    setLoadingMode(mode);

    try {
      const artistId = mode === "artist-of-the-day" ? dailyArtist?.artistId : undefined;

      if (mode === "artist-of-the-day" && !artistId) {
        setError(t.home.dailyArtistMissing);
        setLoadingMode(null);
        return;
      }

      const runId = await generateGameRun(mode, artistId, { language, theme, playMode });
      navigate(`/game/${runId}`);
    } catch (err) {
      setError(String(err));
      setLoadingMode(null);
    }
  };

  return (
    <PageShell isLight={isLight} background="home">
      <Header
        brand={t.common.brand}
        subtitle={t.common.musicQuiz}
        isLight={isLight}
        theme={theme}
        onToggleTheme={toggleTheme}
        onBrandClick={() => navigate("/")}
      />

      <section className="grid flex-1 items-center gap-8 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)] lg:gap-12">
        <HeroSection t={t} isLight={isLight} />

        <HomeCTA
          t={t}
          isLight={isLight}
          dailyArtist={dailyArtist}
          loadingMode={loadingMode}
          error={error}
          playMode={playMode}
          onPlayModeChange={setPlayMode}
          onStartGame={startGame}
        />
      </section>

      <p className={cn("pb-3 text-center text-xs", isLight ? "text-orange-300" : "text-gray-700")}>MVP v1.0</p>
    </PageShell>
  );
}
