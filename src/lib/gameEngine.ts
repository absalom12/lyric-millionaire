import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { db, serverTimestamp } from "./firebase";
import {
  GameQuestion,
  GameRun,
  QuestionAnswer,
  Snippet,
  Song,
  GameModeSlug,
} from "../types/index";
import { LanguageCode } from "../i18n/translations";
import { AppTheme } from "../components/ThemeToggle";

type GameRunAnalyticsOptions = {
  language?: LanguageCode;
  theme?: AppTheme;
  playMode?: "lyrics" | "blindtest";
};

type SnippetWithId = Snippet & {
  id: string;
};

type SongWithId = Song & {
  id: string;
};

type ArtistLite = {
  id?: string;
  name?: string;
};

type DailyArtistLite = {
  id?: string;
  date?: string;
  artistId?: string;
  artistName?: string;
};

function getTodayId() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeArtist(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesArtist(
  item: { artistId?: string; artistName?: string },
  artistId?: string,
  artistName?: string
) {
  const expectedName = normalizeArtist(artistName);
  const itemName = normalizeArtist(item.artistName);

  if (artistId && item.artistId === artistId) return true;
  if (expectedName && itemName && itemName === expectedName) return true;

  return false;
}

async function getArtist(artistId?: string): Promise<ArtistLite | null> {
  if (!artistId) return null;

  try {
    const snap = await getDoc(doc(db, "artists", artistId));

    if (!snap.exists()) return null;

    return {
      id: snap.id,
      ...snap.data(),
    } as ArtistLite;
  } catch {
    return null;
  }
}

async function getTodayDailyArtist(): Promise<DailyArtistLite | null> {
  const today = getTodayId();

  try {
    const directSnap = await getDoc(doc(db, "dailyArtists", today));

    if (directSnap.exists()) {
      return {
        id: directSnap.id,
        ...directSnap.data(),
      } as DailyArtistLite;
    }
  } catch {
    // fallback below
  }

  try {
    const q = query(collection(db, "dailyArtists"), where("date", "==", today));
    const snap = await getDocs(q);
    const first = snap.docs[0];

    if (!first) return null;

    return {
      id: first.id,
      ...first.data(),
    } as DailyArtistLite;
  } catch {
    return null;
  }
}

async function getActiveSongs(): Promise<SongWithId[]> {
  const q = query(collection(db, "songs"), where("isActive", "==", true));
  const snap = await getDocs(q);

  return snap.docs.map(
    (d) =>
      ({
        id: d.id,
        ...d.data(),
      } as SongWithId)
  );
}

async function getApprovedSnippets(): Promise<SnippetWithId[]> {
  const q = query(collection(db, "snippets"), where("isApproved", "==", true));
  const snap = await getDocs(q);

  return snap.docs.map(
    (d) =>
      ({
        id: d.id,
        ...d.data(),
      } as SnippetWithId)
  );
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function getSongDecade(song: SongWithId): number | null {
  if (!song.releaseYear) return null;
  return Math.floor(song.releaseYear / 10) * 10;
}

function rankWrongAnswerCandidate(
  candidate: SongWithId,
  correctSong: SongWithId
): number {
  let score = 0;

  if (candidate.genre && correctSong.genre && candidate.genre === correctSong.genre) {
    score += 3;
  }

  const correctDecade = getSongDecade(correctSong);
  const candidateDecade = getSongDecade(candidate);

  if (correctDecade && candidateDecade && correctDecade === candidateDecade) {
    score += 2;
  }

  if (
    candidate.artistName &&
    correctSong.artistName &&
    candidate.artistName !== correctSong.artistName
  ) {
    score += 1;
  }

  return score;
}

function getWrongAnswersFromPool({
  correctSong,
  candidateSongs,
  count = 3,
}: {
  correctSong: SongWithId;
  candidateSongs: SongWithId[];
  count?: number;
}): QuestionAnswer[] {
  const candidates = candidateSongs.filter((song) => song.id !== correctSong.id);

  const ranked = shuffle(candidates).sort((a, b) => {
    return (
      rankWrongAnswerCandidate(b, correctSong) -
      rankWrongAnswerCandidate(a, correctSong)
    );
  });

  return ranked.slice(0, count).map((song) => ({
    songId: song.id,
    title: song.title,
    artistName: song.artistName,
  }));
}

function pickUniqueSnippetsBySong(
  snippets: SnippetWithId[],
  count: number,
  alreadyUsedSongIds: Set<string>
): SnippetWithId[] {
  const selected: SnippetWithId[] = [];
  const shuffled = shuffle(snippets);

  for (const snippet of shuffled) {
    if (selected.length >= count) break;
    if (alreadyUsedSongIds.has(snippet.songId)) continue;

    selected.push(snippet);
    alreadyUsedSongIds.add(snippet.songId);
  }

  return selected;
}

function buildBalancedUniqueSelection(snippets: SnippetWithId[]): SnippetWithId[] {
  const usedSongIds = new Set<string>();

  const easy = snippets.filter((snippet) => Number(snippet.difficulty) <= 2);
  const hard = snippets.filter((snippet) => Number(snippet.difficulty) >= 3);

  const selectedEasy = pickUniqueSnippetsBySong(easy, 5, usedSongIds);
  const selectedHard = pickUniqueSnippetsBySong(hard, 5, usedSongIds);

  let selected = [...selectedEasy, ...selectedHard];

  if (selected.length < 10) {
    const remaining = snippets.filter(
      (snippet) => !usedSongIds.has(snippet.songId)
    );

    selected = [
      ...selected,
      ...pickUniqueSnippetsBySong(remaining, 10 - selected.length, usedSongIds),
    ];
  }

  return selected;
}

function buildSnippetPool(
  snippets: SnippetWithId[],
  modeSlug: GameModeSlug
): SnippetWithId[] {
  const preferredUnique = buildBalancedUniqueSelection(snippets);
  const preferredIds = new Set(preferredUnique.map((snippet) => snippet.id));

  if (modeSlug === "global-hits" || modeSlug === "rap-fr") {
    return preferredUnique;
  }

  // Artist of the day: on préfère des chansons différentes, mais on autorise
  // plusieurs snippets du même morceau pour compléter les 10 questions.
  const remaining = shuffle(snippets.filter((snippet) => !preferredIds.has(snippet.id)));

  return [...preferredUnique, ...remaining];
}

export async function generateGameRun(
  modeSlug: GameModeSlug,
  artistId?: string,
  analytics?: GameRunAnalyticsOptions
): Promise<string> {
  const startedAtMs = performance.now();

  let resolvedArtistId = artistId;
  let resolvedArtistName = "";

  if (modeSlug === "artist-of-the-day") {
    const [dailyArtist, artist] = await Promise.all([
      getTodayDailyArtist(),
      getArtist(artistId),
    ]);

    resolvedArtistId = resolvedArtistId || dailyArtist?.artistId;
    resolvedArtistName = artist?.name || dailyArtist?.artistName || "";
  }

  const [activeSongs, approvedSnippets] = await Promise.all([
    getActiveSongs(),
    getApprovedSnippets(),
  ]);

  const songMap = new Map(activeSongs.map((song) => [song.id, song]));
  const globalHitSongIds = new Set(
    activeSongs.filter((song) => song.isGlobalHit).map((song) => song.id)
  );
  const rapFrSongIds = new Set(
    activeSongs.filter((song) => song.isRapFr).map((song) => song.id)
  );

  if (modeSlug === "artist-of-the-day" && !resolvedArtistName && resolvedArtistId) {
    const matchingSong = activeSongs.find((song) => song.artistId === resolvedArtistId);
    const matchingSnippet = approvedSnippets.find(
      (snippet) => snippet.artistId === resolvedArtistId
    );

    resolvedArtistName = matchingSong?.artistName || matchingSnippet?.artistName || "";
  }

  const candidateSongs = activeSongs.filter((song) => {
    if (modeSlug === "global-hits") return globalHitSongIds.has(song.id);
    if (modeSlug === "rap-fr") return rapFrSongIds.has(song.id);
    return matchesArtist(song, resolvedArtistId, resolvedArtistName);
  });

  if (candidateSongs.length < 4) {
    throw new Error(
      modeSlug === "artist-of-the-day"
        ? `Pas assez de chansons actives pour cet artiste. Trouvé: ${candidateSongs.length}/4.`
        : modeSlug === "rap-fr"
        ? `Pas assez de chansons Rap FR actives. Trouvé: ${candidateSongs.length}/4. Marque des chansons comme isRapFr dans l'admin.`
        : `Pas assez de chansons Global Hits actives. Trouvé: ${candidateSongs.length}/4.`
    );
  }

  const isBlindtest = analytics?.playMode === "blindtest";

  const validSnippets = approvedSnippets.filter((snippet) => {
    if (!snippet.isApproved) return false;
    if (snippet.licenseStatus === "removed") return false;
    if (!snippet.text?.trim()) return false;
    if (!snippet.songId) return false;

    const song = songMap.get(snippet.songId);

    if (!song) return false;

    // Blindtest requires an audio preview
    if (isBlindtest && !song.previewUrl) return false;

    if (modeSlug === "global-hits") return globalHitSongIds.has(snippet.songId);
    if (modeSlug === "rap-fr") return rapFrSongIds.has(snippet.songId);

    return (
      matchesArtist(snippet, resolvedArtistId, resolvedArtistName) ||
      matchesArtist(song, resolvedArtistId, resolvedArtistName)
    );
  });

  const uniqueSongIds = new Set(validSnippets.map((snippet) => snippet.songId));

  if ((modeSlug === "global-hits" || modeSlug === "rap-fr") && uniqueSongIds.size < 10) {
    const label = modeSlug === "rap-fr" ? "Rap FR" : "Global Hits";
    throw new Error(
      isBlindtest
        ? `Pas assez de chansons ${label} avec un extrait audio pour le blindtest. Trouvé: ${uniqueSongIds.size}/10. Lance l'enrichissement des previews dans l'admin.`
        : `Pas assez de chansons ${label} uniques pour générer une partie complète. Trouvé: ${uniqueSongIds.size}/10.`
    );
  }

  if (modeSlug === "artist-of-the-day" && validSnippets.length < 10) {
    throw new Error(
      isBlindtest
        ? `Pas assez de snippets avec un extrait audio pour le blindtest de cet artiste. Trouvé: ${validSnippets.length}/10. Lance l'enrichissement des previews dans l'admin.`
        : `Pas assez de snippets approuvés pour cet artiste. Trouvé: ${validSnippets.length}/10.`
    );
  }

  const snippetPool = buildSnippetPool(validSnippets, modeSlug);
  const questions: GameQuestion[] = [];
  const usedSnippetIds = new Set<string>();

  for (const snippet of snippetPool) {
    if (questions.length >= 10) break;
    if (usedSnippetIds.has(snippet.id)) continue;

    const song = songMap.get(snippet.songId);

    if (!song) continue;

    const wrongAnswers = getWrongAnswersFromPool({
      correctSong: song,
      candidateSongs,
      count: 3,
    });

    if (wrongAnswers.length < 3) continue;

    const correctAnswer: QuestionAnswer = {
      songId: song.id,
      title: song.title,
      artistName: song.artistName,
    };

    questions.push({
      snippetId: snippet.id,
      snippetText: snippet.text,
      correctSongId: song.id,
      correctTitle: song.title,
      correctArtist: song.artistName,
      releaseYear: song.releaseYear,
      difficulty: Number(snippet.difficulty),
      spotifyStreams: song.spotifyStreams,
      previewUrl: song.previewUrl ?? null,
      answers: shuffle([correctAnswer, ...wrongAnswers]),
    });

    usedSnippetIds.add(snippet.id);
  }

  if (questions.length < 10) {
    throw new Error(
      modeSlug === "artist-of-the-day"
        ? `Pas assez de questions valides pour cet artiste. Trouvé: ${questions.length}/10. Vérifie qu'il y a au moins 4 chansons actives de cet artiste pour générer les réponses.`
        : `Pas assez de questions valides pour générer une partie complète. Trouvé: ${questions.length}/10.`
    );
  }

  const run = {
    modeSlug,
    status: "in_progress",
    score: 0,
    currentQuestionIndex: 0,


    questions: questions.slice(0, 10),
    startedAt: serverTimestamp() as any,

    language: analytics?.language ?? "en",
    theme: analytics?.theme ?? "dark",
    playMode: analytics?.playMode ?? "lyrics",

    moneyReached: 0,
    completedQuestionCount: 0,
    lostAtQuestionIndex: null,

    shareClicks: 0,

    artistId: resolvedArtistId ?? null,
    artistName: resolvedArtistName || null,
    dailyArtistId: modeSlug === "artist-of-the-day" ? resolvedArtistId ?? null : null,
    dailyArtistName: modeSlug === "artist-of-the-day" ? resolvedArtistName || null : null,
  } as Omit<GameRun, "id"> & Record<string, unknown>;

  const ref = await addDoc(collection(db, "gameRuns"), run);

  console.info(
    `[Lyric Millionaire] Game generated in ${Math.round(
      performance.now() - startedAtMs
    )}ms (${modeSlug})`
  );

  return ref.id;
}

export async function getGameRun(
  runId: string
): Promise<(GameRun & { id: string }) | null> {
  const snap = await getDoc(doc(db, "gameRuns", runId));

  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...snap.data(),
  } as GameRun & { id: string };
}
