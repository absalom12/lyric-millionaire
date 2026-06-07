import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  db,
  collection,
  getDocs,
  getDocument,
  upsertDocument,
  updateDocument,
  serverTimestamp,
} from "../../lib/firebase";
import { Artist, DailyArtist, Snippet } from "../../types/index";
import { generateGameRun } from "../../lib/gameEngine";

type AdminArtist = Artist & {
  id: string;
};

type AdminSnippet = Snippet & {
  id: string;
};

type AdminDailyArtist = DailyArtist & {
  id: string;
  updatedAt?: any;
  generatedAt?: any;
};

function getTodayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function timestampToMillis(value: any): number {
  return value?.toMillis?.() ?? 0;
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

function DailyCalendar({
  selectedDate,
  programmedDates,
  onSelectDate,
}: {
  selectedDate: string;
  programmedDates: Set<string>;
  onSelectDate: (date: string) => void;
}) {
  const [visibleMonth, setVisibleMonth] = useState(() =>
    parseLocalDate(selectedDate)
  );

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const firstWeekDay = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = lastDayOfMonth.getDate();

  const cells: Array<{
    date: string | null;
    day: number | null;
  }> = [];

  for (let i = 0; i < firstWeekDay; i++) {
    cells.push({
      date: null,
      day: null,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = formatLocalDate(new Date(year, month, day));

    cells.push({
      date,
      day,
    });
  }

  const goToPreviousMonth = () => {
    setVisibleMonth(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setVisibleMonth(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = getTodayLocalDate();
    setVisibleMonth(parseLocalDate(today));
    onSelectDate(today);
  };

  useEffect(() => {
    setVisibleMonth(parseLocalDate(selectedDate));
  }, [selectedDate]);

  return (
    <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className="bg-white/[0.04] text-gray-300 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold hover:bg-white/[0.08] transition"
        >
          ←
        </button>

        <div className="text-center">
          <p className="text-white font-black capitalize">
            {getMonthLabel(visibleMonth)}
          </p>

          <button
            type="button"
            onClick={goToToday}
            className="text-yellow-400 text-xs font-bold mt-1 hover:underline"
          >
            Aujourd’hui
          </button>
        </div>

        <button
          type="button"
          onClick={goToNextMonth}
          className="bg-white/[0.04] text-gray-300 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold hover:bg-white/[0.08] transition"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center">
        {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
          <div key={`${day}-${index}`} className="text-gray-500 text-xs font-black py-1">
            {day}
          </div>
        ))}

        {cells.map((cell, index) => {
          if (!cell.date) {
            return <div key={index} className="h-11" />;
          }

          const isSelected = cell.date === selectedDate;
          const isProgrammed = programmedDates.has(cell.date);
          const isToday = cell.date === getTodayLocalDate();

          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => onSelectDate(cell.date!)}
              className={[
                "h-11 rounded-2xl text-sm font-black border transition relative",
                isSelected
                  ? "bg-yellow-400 text-black border-yellow-300 shadow-lg shadow-yellow-400/20"
                  : isProgrammed
                  ? "bg-green-500/20 text-green-300 border-green-500/40 hover:bg-green-500/30"
                  : "bg-white/[0.03] text-gray-300 border-white/10 hover:bg-white/[0.07]",
              ].join(" ")}
            >
              {cell.day}

              {isToday && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-yellow-400" />
              )}

              {isProgrammed && !isSelected && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-400" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <span className="bg-green-500/15 text-green-300 border border-green-500/25 rounded-full px-3 py-1 text-xs font-bold">
          Date programmée
        </span>

        <span className="bg-yellow-400/15 text-yellow-300 border border-yellow-400/25 rounded-full px-3 py-1 text-xs font-bold">
          Date sélectionnée
        </span>
      </div>
    </div>
  );
}

export default function AdminDaily() {
  const navigate = useNavigate();

  const [artists, setArtists] = useState<AdminArtist[]>([]);
  const [snippets, setSnippets] = useState<AdminSnippet[]>([]);
  const [dailyArtists, setDailyArtists] = useState<AdminDailyArtist[]>([]);

  const [selectedDate, setSelectedDate] = useState(getTodayLocalDate());
  const [selectedArtistId, setSelectedArtistId] = useState("");
  const [artistCoverUrl, setArtistCoverUrl] = useState("");
  const [savingArtistCover, setSavingArtistCover] = useState(false);
  const [currentDailyArtist, setCurrentDailyArtist] =
    useState<(DailyArtist & { id?: string }) | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  const [errors, setErrors] = useState<string[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const selectedArtist = useMemo(() => {
    return artists.find((artist) => artist.id === selectedArtistId) ?? null;
  }, [artists, selectedArtistId]);

  useEffect(() => {
    setArtistCoverUrl(selectedArtist?.imageUrl ?? "");
  }, [selectedArtist]);

  const programmedDates = useMemo(() => {
    return new Set(
      dailyArtists
        .map((dailyArtist) => dailyArtist.date || dailyArtist.id)
        .filter(Boolean)
    );
  }, [dailyArtists]);

  const approvedSnippetsForSelectedArtist = useMemo(() => {
    if (!selectedArtistId) return [];

    return snippets.filter((snippet) => {
      return (
        snippet.artistId === selectedArtistId &&
        snippet.isApproved === true &&
        snippet.licenseStatus !== "removed"
      );
    });
  }, [snippets, selectedArtistId]);

  const easyApprovedCount = useMemo(() => {
    return approvedSnippetsForSelectedArtist.filter(
      (snippet) => Number(snippet.difficulty) <= 2
    ).length;
  }, [approvedSnippetsForSelectedArtist]);

  const hardApprovedCount = useMemo(() => {
    return approvedSnippetsForSelectedArtist.filter(
      (snippet) => Number(snippet.difficulty) >= 3
    ).length;
  }, [approvedSnippetsForSelectedArtist]);

  const uniqueApprovedSongsCount = useMemo(() => {
    return new Set(
      approvedSnippetsForSelectedArtist.map((snippet) => snippet.songId)
    ).size;
  }, [approvedSnippetsForSelectedArtist]);

  const canGenerateArtistGame =
    easyApprovedCount >= 5 &&
    hardApprovedCount >= 5 &&
    uniqueApprovedSongsCount >= 10;

  const artistStats = useMemo(() => {
    return artists.map((artist) => {
      const artistApprovedSnippets = snippets.filter((snippet) => {
        return (
          snippet.artistId === artist.id &&
          snippet.isApproved === true &&
          snippet.licenseStatus !== "removed"
        );
      });

      const easy = artistApprovedSnippets.filter(
        (snippet) => Number(snippet.difficulty) <= 2
      ).length;

      const hard = artistApprovedSnippets.filter(
        (snippet) => Number(snippet.difficulty) >= 3
      ).length;

      const uniqueSongs = new Set(
        artistApprovedSnippets.map((snippet) => snippet.songId)
      ).size;

      return {
        artist,
        approvedSnippets: artistApprovedSnippets.length,
        easy,
        hard,
        uniqueSongs,
        playable: easy >= 5 && hard >= 5 && uniqueSongs >= 10,
      };
    });
  }, [artists, snippets]);

  const filteredArtistStats = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const result = normalizedSearch
      ? artistStats.filter(({ artist }) =>
          artist.name.toLowerCase().includes(normalizedSearch)
        )
      : artistStats;

    return [...result].sort((a, b) => {
      if (a.playable !== b.playable) {
        return Number(b.playable) - Number(a.playable);
      }

      if (b.uniqueSongs !== a.uniqueSongs) {
        return b.uniqueSongs - a.uniqueSongs;
      }

      return a.artist.name.localeCompare(b.artist.name);
    });
  }, [artistStats, search]);

  const upcomingDailyArtists = useMemo(() => {
    const today = getTodayLocalDate();

    return dailyArtists
      .filter((dailyArtist) => (dailyArtist.date || dailyArtist.id) >= today)
      .sort((a, b) =>
        String(a.date || a.id).localeCompare(String(b.date || b.id))
      )
      .slice(0, 8);
  }, [dailyArtists]);

  const loadData = async () => {
    setLoading(true);
    setErrors([]);
    setReport(null);

    try {
      const [artistsSnap, snippetsSnap, dailyArtistsSnap] = await Promise.all([
        getDocs(collection(db, "artists")),
        getDocs(collection(db, "snippets")),
        getDocs(collection(db, "dailyArtists")),
      ]);

      const artistsData = artistsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AdminArtist[];

      const snippetsData = snippetsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AdminSnippet[];

      const dailyArtistsData = dailyArtistsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AdminDailyArtist[];

      artistsData.sort((a, b) => a.name.localeCompare(b.name));

      setArtists(artistsData);
      setSnippets(snippetsData);
      setDailyArtists(dailyArtistsData);
    } catch (err) {
      setErrors([`Erreur chargement données : ${String(err)}`]);
    } finally {
      setLoading(false);
    }
  };

  const loadDailyArtist = async (date: string) => {
    setErrors([]);
    setReport(null);

    try {
      const daily = await getDocument<DailyArtist & { id?: string }>(
        "dailyArtists",
        date
      );

      setCurrentDailyArtist(daily);

      if (daily?.artistId) {
        setSelectedArtistId(daily.artistId);
      } else {
        setSelectedArtistId("");
      }
    } catch (err) {
      setErrors([`Erreur chargement artiste du jour : ${String(err)}`]);
    }
  };

  const handleSelectArtistFromList = (artistId: string) => {
    setSelectedArtistId(artistId);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleSaveArtistCover = async () => {
    if (!selectedArtist) {
      setErrors(["Choisis un artiste avant d’ajouter une cover."]);
      return;
    }

    const nextCoverUrl = artistCoverUrl.trim();

    setSavingArtistCover(true);
    setErrors([]);
    setReport(null);

    try {
      await updateDocument("artists", selectedArtist.id, {
        imageUrl: nextCoverUrl,
        updatedAt: serverTimestamp(),
      });

      setArtists((currentArtists) =>
        currentArtists.map((artist) =>
          artist.id === selectedArtist.id
            ? { ...artist, imageUrl: nextCoverUrl }
            : artist
        )
      );

      setReport(`✅ Cover mise à jour pour ${selectedArtist.name}.`);
    } catch (err) {
      setErrors([`Erreur sauvegarde cover artiste : ${String(err)}`]);
    } finally {
      setSavingArtistCover(false);
    }
  };

  const handleSaveDailyArtist = async () => {
    if (!selectedDate) {
      setErrors(["Choisis une date."]);
      return;
    }

    if (!selectedArtist) {
      setErrors(["Choisis un artiste."]);
      return;
    }

    setSaving(true);
    setErrors([]);
    setReport(null);

    try {
      const trimmedCoverUrl = artistCoverUrl.trim();

      await upsertDocument("dailyArtists", selectedDate, {
        date: selectedDate,
        artistId: selectedArtist.id,
        artistName: selectedArtist.name,
        ...(trimmedCoverUrl
          ? {
              coverUrl: trimmedCoverUrl,
              artistCoverUrl: trimmedCoverUrl,
            }
          : {}),
        generatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await loadData();
      await loadDailyArtist(selectedDate);

      setReport(
        `✅ ${selectedArtist.name} est maintenant configuré comme artiste du jour pour le ${selectedDate}.`
      );
    } catch (err) {
      setErrors([`Erreur sauvegarde artiste du jour : ${String(err)}`]);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateArtistTestGame = async () => {
    if (!selectedArtistId) {
      setErrors(["Choisis un artiste avant de lancer une partie test."]);
      return;
    }

    setTestLoading(true);
    setErrors([]);
    setReport(null);

    try {
      const runId = await generateGameRun("artist-of-the-day", selectedArtistId);
      navigate(`/game/${runId}`);
    } catch (err) {
      setErrors([
        `Impossible de générer une partie test Artist of the Day : ${String(err)}`,
      ]);
    } finally {
      setTestLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadDailyArtist(selectedDate);
    }
  }, [selectedDate]);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-yellow-400 font-black">
            Planning
          </p>

          <h2 className="text-3xl font-black tracking-tight mt-1">
            Artist of the Day
          </h2>

          <p className="text-gray-500 text-sm mt-2 max-w-2xl">
            Programme l’artiste du jour, visualise les dates déjà planifiées et vérifie si un artiste a assez de contenu pour générer une partie complète.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="bg-white/[0.04] text-gray-300 border border-white/10 rounded-2xl px-5 py-3 text-sm font-bold hover:bg-white/[0.08] hover:text-white disabled:opacity-50 transition"
        >
          {loading ? "Chargement…" : "Rafraîchir"}
        </button>
      </div>

      {report && (
        <div className="bg-green-500/15 border border-green-500/40 text-green-300 text-sm rounded-2xl p-4">
          {report}
        </div>
      )}

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

      {/* Main planning card */}
      <section className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        <div className="bg-gray-950/70 border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/20 flex flex-col gap-5">
          <div>
            <h3 className="text-xl font-black text-white tracking-tight">
              Calendrier
            </h3>

            <p className="text-sm text-gray-500 mt-1">
              Les dates programmées sont affichées en vert.
            </p>
          </div>

          <DailyCalendar
            selectedDate={selectedDate}
            programmedDates={programmedDates}
            onSelectDate={setSelectedDate}
          />

          <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wide">
              Date sélectionnée
            </p>

            <p className="text-white text-2xl font-black mt-2">
              {selectedDate}
            </p>

            {currentDailyArtist ? (
              <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-2xl p-3">
                <p className="text-green-300 text-xs font-bold">
                  Déjà programmée
                </p>

                <p className="text-white text-sm mt-1">
                  {currentDailyArtist.artistName}
                </p>
              </div>
            ) : (
              <div className="mt-4 bg-white/[0.04] border border-white/10 rounded-2xl p-3">
                <p className="text-gray-400 text-xs">
                  Aucun artiste configuré pour cette date.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-950/70 border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/20 flex flex-col gap-5">
          <div>
            <h3 className="text-xl font-black text-white tracking-tight">
              Configuration
            </h3>

            <p className="text-sm text-gray-500 mt-1">
              Choisis l’artiste à associer à la date sélectionnée.
            </p>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-gray-500 text-xs font-bold uppercase tracking-wide">
              Artiste
            </span>

            <select
              value={selectedArtistId}
              onChange={(e) => setSelectedArtistId(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10"
            >
              <option value="">Sélectionner un artiste</option>

              {artists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
          </label>

          {selectedArtist && (
            <div className="bg-black/30 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-wide">
                    Artiste sélectionné
                  </p>

                  <p className="text-white text-2xl font-black mt-1">
                    {selectedArtist.name}
                  </p>
                </div>

                <div className="w-full lg:w-56">
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-wide mb-2">
                    Preview cover
                  </p>

                  <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                    {artistCoverUrl.trim() ? (
                      <img
                        src={artistCoverUrl.trim()}
                        alt={`Cover ${selectedArtist.name}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs font-bold text-gray-500">
                        Aucune cover
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    <p className="absolute bottom-3 left-3 right-3 truncate text-sm font-black text-white">
                      {selectedArtist.name}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-yellow-400/15 bg-yellow-400/5 p-4">
                <label className="flex flex-col gap-2">
                  <span className="text-yellow-300 text-xs font-bold uppercase tracking-wide">
                    Cover artiste
                  </span>

                  <input
                    type="url"
                    value={artistCoverUrl}
                    onChange={(e) => setArtistCoverUrl(e.target.value)}
                    placeholder="https://..."
                    className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10"
                  />
                </label>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-gray-500">
                    Cette image sera utilisée comme background du bouton “Artiste du jour” sur la Home.
                  </p>

                  <button
                    type="button"
                    onClick={handleSaveArtistCover}
                    disabled={savingArtistCover}
                    className="shrink-0 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-xs font-black text-yellow-300 transition hover:bg-yellow-400/20 disabled:opacity-50"
                  >
                    {savingArtistCover ? "Sauvegarde…" : "Sauvegarder la cover"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-gray-950/80 border border-white/10 rounded-2xl p-4">
                  <p className="text-gray-500 text-xs">
                    Faciles approuvés
                  </p>

                  <p
                    className={
                      easyApprovedCount >= 5
                        ? "text-green-400 text-2xl font-black mt-1"
                        : "text-red-400 text-2xl font-black mt-1"
                    }
                  >
                    {easyApprovedCount}/5
                  </p>
                </div>

                <div className="bg-gray-950/80 border border-white/10 rounded-2xl p-4">
                  <p className="text-gray-500 text-xs">
                    Difficiles approuvés
                  </p>

                  <p
                    className={
                      hardApprovedCount >= 5
                        ? "text-green-400 text-2xl font-black mt-1"
                        : "text-red-400 text-2xl font-black mt-1"
                    }
                  >
                    {hardApprovedCount}/5
                  </p>
                </div>

                <div className="bg-gray-950/80 border border-white/10 rounded-2xl p-4">
                  <p className="text-gray-500 text-xs">
                    Chansons uniques
                  </p>

                  <p
                    className={
                      uniqueApprovedSongsCount >= 10
                        ? "text-green-400 text-2xl font-black mt-1"
                        : "text-red-400 text-2xl font-black mt-1"
                    }
                  >
                    {uniqueApprovedSongsCount}/10
                  </p>
                </div>
              </div>

              {!canGenerateArtistGame && (
                <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-xs rounded-2xl p-3">
                  Cet artiste n’a pas encore assez de contenu approuvé pour générer une partie complète de 10 questions.
                </div>
              )}

              {canGenerateArtistGame && (
                <div className="bg-green-500/10 border border-green-500/40 text-green-300 text-xs rounded-2xl p-3">
                  Cet artiste a assez de contenu pour générer une partie Artist of the Day.
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-3">
            <button
              onClick={handleSaveDailyArtist}
              disabled={saving || !selectedArtistId}
              className="flex-1 bg-yellow-400 text-black font-black rounded-2xl py-3 text-sm hover:bg-yellow-300 disabled:opacity-50 transition active:scale-95"
            >
              {saving ? "Sauvegarde…" : "Définir comme artiste du jour"}
            </button>

            <button
              onClick={handleCreateArtistTestGame}
              disabled={testLoading || !selectedArtistId || !canGenerateArtistGame}
              className="flex-1 bg-white/[0.04] text-gray-200 border border-white/10 font-bold rounded-2xl py-3 text-sm hover:bg-white/[0.08] disabled:opacity-50 transition active:scale-95"
            >
              {testLoading ? "Création…" : "Tester une partie"}
            </button>
          </div>
        </div>
      </section>

      {/* Upcoming planning */}
      <section className="bg-gray-950/70 border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/20 flex flex-col gap-4">
        <div>
          <h3 className="text-xl font-black text-white tracking-tight">
            Prochaines dates programmées
          </h3>

          <p className="text-sm text-gray-500 mt-1">
            Aperçu rapide des artistes déjà planifiés.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
          <table className="w-full min-w-[760px] text-xs text-gray-300">
            <thead className="bg-white/[0.04] text-gray-400">
              <tr>
                <th className="px-4 py-4 text-left">Date</th>
                <th className="px-4 py-4 text-left">Artiste</th>
                <th className="px-4 py-4 text-left">Créé / MAJ</th>
              </tr>
            </thead>

            <tbody>
              {upcomingDailyArtists.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                    Aucune date programmée à venir.
                  </td>
                </tr>
              )}

              {upcomingDailyArtists.map((dailyArtist) => (
                <tr
                  key={dailyArtist.id}
                  className="border-t border-white/10 hover:bg-white/[0.03] transition"
                >
                  <td className="px-4 py-4 font-bold text-white">
                    {dailyArtist.date || dailyArtist.id}
                  </td>

                  <td className="px-4 py-4">
                    <span className="bg-green-500/15 text-green-300 border border-green-500/25 rounded-full px-3 py-1 text-xs font-bold">
                      {dailyArtist.artistName}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-gray-500">
                    {formatDateTime(dailyArtist.updatedAt || dailyArtist.generatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Artist readiness table */}
      <section className="bg-gray-950/70 border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/20 flex flex-col gap-4">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-white tracking-tight">
              Éligibilité des artistes
            </h3>

            <p className="text-sm text-gray-500 mt-1">
              Clique sur un artiste pour le sélectionner rapidement.
            </p>
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un artiste..."
            className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10 xl:w-80"
          />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
          <table className="w-full min-w-[1000px] text-xs text-gray-300">
            <thead className="bg-white/[0.04] text-gray-400">
              <tr>
                <th className="px-4 py-4 text-left">Artiste</th>
                <th className="px-4 py-4 text-left">Snippets approuvés</th>
                <th className="px-4 py-4 text-left">Faciles</th>
                <th className="px-4 py-4 text-left">Difficiles</th>
                <th className="px-4 py-4 text-left">Chansons uniques</th>
                <th className="px-4 py-4 text-left">Jouable</th>
                <th className="px-4 py-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Chargement des artistes...
                  </td>
                </tr>
              )}

              {!loading && filteredArtistStats.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Aucun artiste trouvé.
                  </td>
                </tr>
              )}

              {!loading &&
                filteredArtistStats.map(
                  ({
                    artist,
                    approvedSnippets,
                    easy,
                    hard,
                    uniqueSongs,
                    playable,
                  }) => (
                    <tr
                      key={artist.id}
                      className={`border-t border-white/10 hover:bg-white/[0.03] transition ${
                        selectedArtistId === artist.id ? "bg-yellow-400/5" : ""
                      }`}
                    >
                      <td className="px-4 py-4 font-bold text-white">
                        {artist.name}
                      </td>

                      <td className="px-4 py-4">
                        {approvedSnippets}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={
                            easy >= 5 ? "text-green-400 font-bold" : "text-red-400 font-bold"
                          }
                        >
                          {easy}/5
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={
                            hard >= 5 ? "text-green-400 font-bold" : "text-red-400 font-bold"
                          }
                        >
                          {hard}/5
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={
                            uniqueSongs >= 10
                              ? "text-green-400 font-bold"
                              : "text-red-400 font-bold"
                          }
                        >
                          {uniqueSongs}/10
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        {playable ? (
                          <span className="bg-green-500/15 text-green-300 border border-green-500/25 rounded-full px-3 py-1 text-xs font-bold">
                            Oui
                          </span>
                        ) : (
                          <span className="bg-red-500/15 text-red-300 border border-red-500/25 rounded-full px-3 py-1 text-xs font-bold">
                            Non
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => handleSelectArtistFromList(artist.id)}
                          className="bg-white/[0.04] text-gray-300 border border-white/10 px-4 py-2 rounded-xl font-bold hover:bg-white/[0.08] hover:text-white transition"
                        >
                          Sélectionner
                        </button>
                      </td>
                    </tr>
                  )
                )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}