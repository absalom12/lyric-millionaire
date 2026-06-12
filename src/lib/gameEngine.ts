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

function findUndefinedPaths(value: unknown, path = "run"): string[] {
  if (value === undefined) return [path];
  if (typeof value === "number" && isNaN(value)) return [`${path} [NaN]`];
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return (value as unknown[]).flatMap((item, i) => findUndefinedPaths(item, `${path}[${i}]`));
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    findUndefinedPaths(v, `${path}.${k}`)
  );
}

function sanitizeForFirestore(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === "number" && isNaN(value)) return null;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sanitizeForFirestore);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeForFirestore(v)])
  );
}

type GameRunAnalyticsOptions = {
  language?: LanguageCode;
  theme?: AppTheme;
  playMode?: "lyrics" | "blindtest";
};

type SnippetWithId = Snippet & { id: string };
type SongWithId = Song & { id: string };
type ArtistLite = { id?: string; name?: string };
type DailyArtistLite = { id?: string; date?: string; artistId?: string; artistName?: string };

// ── In-memory cache with TTL ──────────────────────────────────────────────────
type CacheEntry<T> = { data: T; expiresAt: number };
const _cache = new Map<string, CacheEntry<unknown>>();
const HOUR_MS = 60 * 60 * 1000;

function getCache<T>(key: string): T | null {
  const entry = _cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _cache.delete(key); return null; }
  return entry.data;
}

function setCache<T>(key: string, data: T, ttlMs = HOUR_MS): void {
  _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/** Call from admin panel after bulk writes to force fresh data on next game. */
export function invalidateGameCache(): void {
  _cache.clear();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getTodayId() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeArtist(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesArtist(
  item: { artistId?: string; artistName?: string },
  artistId?: string,
  artistName?: string
) {
  if (artistId && item.artistId === artistId) return true;
  const expectedName = normalizeArtist(artistName);
  const itemName = normalizeArtist(item.artistName);
  if (expectedName && itemName && itemName === expectedName) return true;
  return false;
}

// ── Cached Firestore fetches ──────────────────────────────────────────────────
async function getArtist(artistId?: string): Promise<ArtistLite | null> {
  if (!artistId) return null;
  const key = `artist:${artistId}`;
  const cached = getCache<ArtistLite>(key);
  if (cached) return cached;

  try {
    const snap = await getDoc(doc(db, "artists", artistId));
    if (!snap.exists()) return null;
    const result = { id: snap.id, ...snap.data() } as ArtistLite;
    setCache(key, result);
    return result;
  } catch {
    return null;
  }
}

async function getTodayDailyArtist(): Promise<DailyArtistLite | null> {
  const today = getTodayId();
  const key = `dailyArtist:${today}`;
  const cached = getCache<DailyArtistLite>(key);
  if (cached) return cached;

  let result: DailyArtistLite | null = null;

  try {
    const snap = await getDoc(doc(db, "dailyArtists", today));
    if (snap.exists()) result = { id: snap.id, ...snap.data() } as DailyArtistLite;
  } catch { /* fallback below */ }

  if (!result) {
    try {
      const q = query(collection(db, "dailyArtists"), where("date", "==", today));
      const snap = await getDocs(q);
      const first = snap.docs[0];
      if (first) result = { id: first.id, ...first.data() } as DailyArtistLite;
    } catch { /* ignore */ }
  }

  if (result) setCache(key, result, HOUR_MS * 24);
  return result;
}

/** Load all active songs once per hour, shared across modes. */
async function getAllActiveSongs(): Promise<SongWithId[]> {
  const key = "songs:active";
  const cached = getCache<SongWithId[]>(key);
  if (cached) return cached;
  const snap = await getDocs(query(collection(db, "songs"), where("isActive", "==", true)));
  const songs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SongWithId);
  setCache(key, songs);
  return songs;
}

/**
 * Fetch songs scoped to the game mode.
 * – global-hits / rap-fr  : cached all-active, filtered in JS
 *   (supports both legacy boolean fields AND new playlists[] array — no migration needed)
 * – artist-of-the-day     : Firestore query scoped to that artist only
 */
async function fetchSongsForMode(
  modeSlug: GameModeSlug,
  artistId?: string
): Promise<SongWithId[]> {
  if (modeSlug === "artist-of-the-day" && artistId) {
    const key = `songs:artist:${artistId}`;
    const cached = getCache<SongWithId[]>(key);
    if (cached) return cached;
    const snap = await getDocs(query(collection(db, "songs"), where("isActive", "==", true), where("artistId", "==", artistId)));
    const songs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SongWithId);
    setCache(key, songs);
    return songs;
  }

  const all = await getAllActiveSongs();

  if (modeSlug === "global-hits") {
    return all.filter((s) => s.isGlobalHit === true || s.playlists?.includes("global-hits"));
  }
  if (modeSlug === "rap-fr") {
    return all.filter((s) => s.isRapFr === true || s.playlists?.includes("rap-fr"));
  }

  return all;
}

/**
 * Fetch snippets scoped to the game mode.
 * – artist-of-the-day: only that artist's snippets (huge saving vs. full collection)
 * – others            : all approved snippets, cached for 1 h
 */
async function fetchSnippetsForMode(
  modeSlug: GameModeSlug,
  artistId?: string
): Promise<SnippetWithId[]> {
  if (modeSlug === "artist-of-the-day" && artistId) {
    const key = `snippets:artist:${artistId}`;
    const cached = getCache<SnippetWithId[]>(key);
    if (cached) return cached;

    const snap = await getDocs(
      query(collection(db, "snippets"), where("isApproved", "==", true), where("artistId", "==", artistId))
    );
    const snippets = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SnippetWithId);
    setCache(key, snippets);
    return snippets;
  }

  // global-hits / rap-fr: fetch all approved, filter by songId in JS (cached)
  const key = "snippets:approved";
  const cached = getCache<SnippetWithId[]>(key);
  if (cached) return cached;

  const snap = await getDocs(query(collection(db, "snippets"), where("isApproved", "==", true)));
  const snippets = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SnippetWithId);
  setCache(key, snippets);
  return snippets;
}

// ── Wrong-answer helpers ──────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function getSongDecade(song: SongWithId): number | null {
  if (!song.releaseYear) return null;
  return Math.floor(song.releaseYear / 10) * 10;
}

function rankWrongAnswerCandidate(candidate: SongWithId, correctSong: SongWithId): number {
  let score = 0;
  if (candidate.genre && correctSong.genre && candidate.genre === correctSong.genre) score += 3;
  const correctDecade = getSongDecade(correctSong);
  const candidateDecade = getSongDecade(candidate);
  if (correctDecade && candidateDecade && correctDecade === candidateDecade) score += 2;
  if (candidate.artistName && correctSong.artistName && candidate.artistName !== correctSong.artistName) score += 1;
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
  const candidates = candidateSongs.filter((s) => s.id !== correctSong.id);
  const ranked = shuffle(candidates).sort(
    (a, b) => rankWrongAnswerCandidate(b, correctSong) - rankWrongAnswerCandidate(a, correctSong)
  );
  return ranked.slice(0, count).map((s) => ({ songId: s.id, title: s.title ?? null, artistName: s.artistName ?? null }));
}

// ── Snippet pool builders ─────────────────────────────────────────────────────
function pickUniqueSnippetsBySong(
  snippets: SnippetWithId[],
  count: number,
  usedSongIds: Set<string>
): SnippetWithId[] {
  const selected: SnippetWithId[] = [];
  for (const snippet of shuffle(snippets)) {
    if (selected.length >= count) break;
    if (usedSongIds.has(snippet.songId)) continue;
    selected.push(snippet);
    usedSongIds.add(snippet.songId);
  }
  return selected;
}

function buildBalancedUniqueSelection(snippets: SnippetWithId[]): SnippetWithId[] {
  const usedSongIds = new Set<string>();
  const easy = snippets.filter((s) => Number(s.difficulty) <= 2);
  const hard = snippets.filter((s) => Number(s.difficulty) >= 3);
  let selected = [
    ...pickUniqueSnippetsBySong(easy, 5, usedSongIds),
    ...pickUniqueSnippetsBySong(hard, 5, usedSongIds),
  ];
  if (selected.length < 10) {
    const remaining = snippets.filter((s) => !usedSongIds.has(s.songId));
    selected = [...selected, ...pickUniqueSnippetsBySong(remaining, 10 - selected.length, usedSongIds)];
  }
  return selected;
}

function buildSnippetPool(snippets: SnippetWithId[], modeSlug: GameModeSlug): SnippetWithId[] {
  const preferred = buildBalancedUniqueSelection(snippets);
  if (modeSlug === "global-hits" || modeSlug === "rap-fr") return preferred;
  // Artist of the day: allow duplicate songs to fill 10 questions if needed
  const preferredIds = new Set(preferred.map((s) => s.id));
  return [...preferred, ...shuffle(snippets.filter((s) => !preferredIds.has(s.id)))];
}

// ── Main export ───────────────────────────────────────────────────────────────
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

  // Scoped fetches — much fewer reads than loading entire collections
  const [modeSongs, modeSnippets] = await Promise.all([
    fetchSongsForMode(modeSlug, resolvedArtistId),
    fetchSnippetsForMode(modeSlug, resolvedArtistId),
  ]);

  const songMap = new Map(modeSongs.map((s) => [s.id, s]));
  const modeSongIds = new Set(modeSongs.map((s) => s.id));

  // Resolve artist name from song data if still unknown
  if (modeSlug === "artist-of-the-day" && !resolvedArtistName && resolvedArtistId) {
    const match = modeSongs.find((s) => s.artistId === resolvedArtistId);
    resolvedArtistName = match?.artistName || "";
  }

  // candidateSongs for wrong answers = all mode songs
  const candidateSongs = modeSlug === "artist-of-the-day"
    ? modeSongs.filter((s) => matchesArtist(s, resolvedArtistId, resolvedArtistName))
    : modeSongs;

  if (candidateSongs.length < 4) {
    throw new Error(
      modeSlug === "artist-of-the-day"
        ? `Pas assez de chansons actives pour cet artiste. Trouvé: ${candidateSongs.length}/4.`
        : modeSlug === "rap-fr"
        ? `Pas assez de chansons Rap FR actives. Trouvé: ${candidateSongs.length}/4.`
        : `Pas assez de chansons Global Hits actives. Trouvé: ${candidateSongs.length}/4.`
    );
  }

  const isBlindtest = analytics?.playMode === "blindtest";

  const validSnippets = modeSnippets.filter((snippet) => {
    if (snippet.licenseStatus === "removed") return false;
    if (!snippet.text?.trim()) return false;
    if (!snippet.songId) return false;
    const song = songMap.get(snippet.songId);
    if (!song) return false;
    if (isBlindtest && !song.previewUrl) return false;
    // For global-hits / rap-fr: snippets are from the full approved pool, filter by mode song ids
    if (modeSlug !== "artist-of-the-day") return modeSongIds.has(snippet.songId);
    return true; // artist-of-the-day snippets were already scoped by query
  });

  const uniqueSongIds = new Set(validSnippets.map((s) => s.songId));

  if ((modeSlug === "global-hits" || modeSlug === "rap-fr") && uniqueSongIds.size < 10) {
    const label = modeSlug === "rap-fr" ? "Rap FR" : "Global Hits";
    throw new Error(
      isBlindtest
        ? `Pas assez de chansons ${label} avec un extrait audio. Trouvé: ${uniqueSongIds.size}/10.`
        : `Pas assez de chansons ${label} uniques. Trouvé: ${uniqueSongIds.size}/10.`
    );
  }

  if (modeSlug === "artist-of-the-day" && validSnippets.length < 10) {
    throw new Error(
      isBlindtest
        ? `Pas assez de snippets avec un extrait audio pour cet artiste. Trouvé: ${validSnippets.length}/10.`
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

    const wrongAnswers = getWrongAnswersFromPool({ correctSong: song, candidateSongs, count: 3 });
    if (wrongAnswers.length < 3) continue;

    questions.push({
      snippetId: snippet.id,
      snippetText: snippet.text ?? null,
      correctSongId: song.id,
      correctTitle: song.title ?? null,
      correctArtist: song.artistName ?? null,
      releaseYear: song.releaseYear ?? null,
      difficulty: Number(snippet.difficulty),
      spotifyStreams: song.spotifyStreams ?? null,
      previewUrl: song.previewUrl ?? null,
      answers: shuffle([
        { songId: song.id, title: song.title ?? null, artistName: song.artistName ?? null },
        ...wrongAnswers,
      ]),
    });
    usedSnippetIds.add(snippet.id);
  }

  if (questions.length < 10) {
    throw new Error(
      modeSlug === "artist-of-the-day"
        ? `Pas assez de questions valides pour cet artiste. Trouvé: ${questions.length}/10.`
        : `Pas assez de questions valides. Trouvé: ${questions.length}/10.`
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

  // ── Debug: find undefined / NaN fields ───────────────────────────────────────
  const badPaths = findUndefinedPaths(run);
  if (badPaths.length > 0) {
    console.error(
      "[Lyric Millionaire] 🚨 Champs undefined/NaN AVANT sanitize:",
      badPaths
    );
    console.error(
      "[Lyric Millionaire] 🚨 Objet run brut:",
      JSON.stringify(run, (_, v) => (v === undefined ? "__UNDEFINED__" : v), 2)
    );
  } else {
    console.info("[Lyric Millionaire] ✅ Aucun undefined avant sanitize");
  }

  const sanitized = sanitizeForFirestore(run) as Record<string, unknown>;

  const badPathsAfter = findUndefinedPaths(sanitized);
  if (badPathsAfter.length > 0) {
    console.error(
      "[Lyric Millionaire] 🚨 Champs undefined/NaN APRÈS sanitize (bug sanitize!):",
      badPathsAfter
    );
  } else {
    console.info("[Lyric Millionaire] ✅ sanitize OK — écriture Firestore...");
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const ref = await addDoc(collection(db, "gameRuns"), sanitized);

  console.info(
    `[Lyric Millionaire] Game generated in ${Math.round(performance.now() - startedAtMs)}ms (${modeSlug})`
  );

  return ref.id;
}

export async function getGameRun(runId: string): Promise<(GameRun & { id: string }) | null> {
  const snap = await getDoc(doc(db, "gameRuns", runId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as GameRun & { id: string };
}
