import { fetchLyricsFromLrclib } from "./lrclibApi";
import { getDocuments, createDocument, serverTimestamp, where } from "./firebase";

// ── Deezer types ──────────────────────────────────────────────────────────────

interface DeezerArtist {
  id: number;
  name: string;
  picture_medium: string;
  nb_fan: number;
}

interface DeezerTrack {
  id: number;
  title: string;
  rank: number;
  preview: string;
  album: { id: number; title: string; release_date?: string };
  artist: { id: number; name: string };
}

interface DeezerAlbum {
  id: number;
  title: string;
  release_date?: string;
}

// ── Public types ──────────────────────────────────────────────────────────────

export type SnippetGenCallbacks = {
  onStep: (step: string) => void;
  onProgress: (current: number, total: number, message: string) => void;
  onLog: (type: "info" | "success" | "warning" | "error", message: string) => void;
};

export type SongProcessResult = {
  title: string;
  lyricsFound: boolean;
  snippetsCreated: number;
  songCreated: boolean;
  alreadyExisted: boolean;
  error?: string;
};

export type GenerationReport = {
  artistName: string;
  deezerFans: number;
  totalSongs: number;
  topCount: number;
  randomCount: number;
  songsWithLyrics: number;
  songsWithoutLyrics: number;
  newSongsCreated: number;
  existingSongsSkipped: number;
  snippetsCreated: number;
  errors: string[];
  songs: SongProcessResult[];
  durationMs: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/feat\..*$/i, "")
    .trim();
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function extractSnippets(
  lyrics: string,
  songTitle: string
): Array<{ text: string; difficulty: number; containsTitle: boolean }> {
  const BLOCK = 3;
  const lines = lyrics
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 2)
    .filter(l => !/^\[.*\]$/.test(l));

  if (lines.length < BLOCK) return [];

  const max = Math.max(0, lines.length - BLOCK);
  const clamp = (n: number) => Math.max(0, Math.min(Math.round(n), max));
  const rand = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

  const easyIdx   = clamp(max * (0.40 + Math.random() * 0.20));
  const mediumIdx = clamp(max * (0.15 + Math.random() * 0.20));
  const hardIdx   = clamp(max * (Math.random() < 0.5
    ? 0.05 + Math.random() * 0.10
    : 0.65 + Math.random() * 0.20));

  const normTitle = normalizeTitle(songTitle);

  const makeSnippet = (idx: number, difficulty: number) => {
    const text = lines.slice(idx, idx + BLOCK).join("\n");
    const containsTitle =
      normTitle.length > 2 &&
      text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(normTitle);
    return { text, difficulty, containsTitle };
  };

  return [
    makeSnippet(easyIdx,   rand(1, 3)),
    makeSnippet(mediumIdx, rand(4, 6)),
    makeSnippet(hardIdx,   rand(7, 9)),
  ];
}

// ── Deezer API ────────────────────────────────────────────────────────────────

async function searchDeezerArtist(name: string): Promise<DeezerArtist | null> {
  try {
    const res = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=5`);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.data?.[0] as DeezerArtist) ?? null;
  } catch { return null; }
}

async function getDeezerTopTracks(artistId: number, limit = 50): Promise<DeezerTrack[]> {
  try {
    const res = await fetch(`https://api.deezer.com/artist/${artistId}/top?limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? []) as DeezerTrack[];
  } catch { return []; }
}

async function getDeezerAlbums(artistId: number, limit = 20): Promise<DeezerAlbum[]> {
  try {
    const res = await fetch(`https://api.deezer.com/artist/${artistId}/albums?limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? []) as DeezerAlbum[];
  } catch { return []; }
}

async function getDeezerAlbumTracks(albumId: number): Promise<DeezerTrack[]> {
  try {
    const res = await fetch(`https://api.deezer.com/album/${albumId}/tracks`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? []) as DeezerTrack[];
  } catch { return []; }
}

// ── Firestore helpers ─────────────────────────────────────────────────────────

async function findOrCreateArtist(name: string, imageUrl: string): Promise<string> {
  const existing = await getDocuments<{ id: string; name: string }>("artists", [
    where("name", "==", name),
  ]);
  if (existing.length > 0) return existing[0].id;
  return createDocument("artists", {
    name,
    imageUrl,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runSnippetGeneration(
  artistQuery: string,
  { onStep, onProgress, onLog }: SnippetGenCallbacks
): Promise<GenerationReport> {
  const startedAt = Date.now();

  // 1. Search artist on Deezer
  onStep("Recherche de l'artiste sur Deezer…");
  onLog("info", `Recherche de "${artistQuery}"…`);

  const deezerArtist = await searchDeezerArtist(artistQuery);
  if (!deezerArtist) throw new Error(`Artiste "${artistQuery}" introuvable sur Deezer.`);

  onLog("success", `Trouvé : ${deezerArtist.name} · ${deezerArtist.nb_fan.toLocaleString("fr-FR")} fans`);

  // 2. Top 30 tracks
  onStep("Récupération du top 30…");
  const allTop = await getDeezerTopTracks(deezerArtist.id, 50);
  const topTracks = allTop.slice(0, 30);
  const topTrackIds = new Set(topTracks.map(t => t.id));
  onLog("success", `Top ${topTracks.length} chansons récupérées.`);

  // 3. 20 random tracks from albums
  onStep("Récupération de chansons aléatoires depuis les albums…");
  const albums = await getDeezerAlbums(deezerArtist.id, 20);
  const selectedAlbums = shuffleArray(albums).slice(0, 4);
  const seenTitles = new Set(topTracks.map(t => normalizeTitle(t.title)));
  const albumTracks: DeezerTrack[] = [];

  for (const album of selectedAlbums) {
    const tracks = await getDeezerAlbumTracks(album.id);
    for (const t of tracks) {
      if (topTrackIds.has(t.id)) continue;
      const norm = normalizeTitle(t.title);
      if (seenTitles.has(norm)) continue;
      seenTitles.add(norm);
      albumTracks.push(t);
    }
  }

  const randomTracks = shuffleArray(albumTracks).slice(0, 20);
  onLog("success", `${randomTracks.length} chansons aléatoires récupérées.`);

  const allTracks = [...topTracks, ...randomTracks];
  onLog("info", `Total : ${allTracks.length} chansons à traiter.`);

  // 4. Find or create artist in Firestore
  onStep("Préparation Firestore…");
  const firestoreArtistId = await findOrCreateArtist(deezerArtist.name, deezerArtist.picture_medium);

  // Load existing songs for this artist (batch check — 1 query)
  const existingSongs = await getDocuments<{ id: string; title: string }>("songs", [
    where("artistId", "==", firestoreArtistId),
  ]);
  const existingTitles = new Set(existingSongs.map(s => normalizeTitle(s.title)));

  // 5. Process each track
  onStep("Récupération des paroles et génération des snippets…");

  const songResults: SongProcessResult[] = [];
  const errors: string[] = [];
  let snippetsCreated = 0;
  let newSongsCreated = 0;
  let existingSongsSkipped = 0;
  let songsWithLyrics = 0;
  let songsWithoutLyrics = 0;

  for (let i = 0; i < allTracks.length; i++) {
    const track = allTracks[i];
    onProgress(i + 1, allTracks.length, track.title);

    const normTrackTitle = normalizeTitle(track.title);

    // Skip if song already exists in Firestore
    if (existingTitles.has(normTrackTitle)) {
      onLog("warning", `"${track.title}" — déjà dans la base, ignoré.`);
      existingSongsSkipped++;
      songResults.push({ title: track.title, lyricsFound: false, snippetsCreated: 0, songCreated: false, alreadyExisted: true });
      continue;
    }

    try {
      const lyrics = await fetchLyricsFromLrclib(track.title, deezerArtist.name);

      if (!lyrics) {
        onLog("warning", `"${track.title}" — paroles introuvables sur lrclib.`);
        songsWithoutLyrics++;
        songResults.push({ title: track.title, lyricsFound: false, snippetsCreated: 0, songCreated: false, alreadyExisted: false });
        continue;
      }

      songsWithLyrics++;

      const snippets = extractSnippets(lyrics, track.title);
      if (snippets.length === 0) {
        onLog("warning", `"${track.title}" — paroles trop courtes.`);
        songsWithoutLyrics++;
        songResults.push({ title: track.title, lyricsFound: true, snippetsCreated: 0, songCreated: false, alreadyExisted: false, error: "Paroles trop courtes" });
        continue;
      }

      // Create song
      const releaseYear = track.album.release_date
        ? parseInt(track.album.release_date.slice(0, 4), 10) || undefined
        : undefined;

      const songId = await createDocument("songs", {
        title: track.title,
        artistId: firestoreArtistId,
        artistName: deezerArtist.name,
        album: track.album.title || null,
        releaseYear: releaseYear ?? null,
        previewUrl: track.preview || null,
        isGlobalHit: i < topTracks.length,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      newSongsCreated++;
      existingTitles.add(normTrackTitle); // prevent duplicate on re-run within same batch

      // Create snippets
      for (const snippet of snippets) {
        await createDocument("snippets", {
          songId,
          songTitle: track.title,
          artistId: firestoreArtistId,
          artistName: deezerArtist.name,
          text: snippet.text,
          snippetType: "other",
          difficulty: snippet.difficulty,
          containsTitle: snippet.containsTitle,
          isApproved: false,
          licenseStatus: "manual_mvp",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        snippetsCreated++;
      }

      onLog("success", `"${track.title}" — ${snippets.length} snippets créés (difficulté : ${snippets.map(s => s.difficulty).join(", ")})`);
      songResults.push({ title: track.title, lyricsFound: true, snippetsCreated: snippets.length, songCreated: true, alreadyExisted: false });

    } catch (err) {
      const msg = `"${track.title}" — erreur : ${String(err)}`;
      onLog("error", msg);
      errors.push(msg);
      songResults.push({ title: track.title, lyricsFound: false, snippetsCreated: 0, songCreated: false, alreadyExisted: false, error: String(err) });
    }
  }

  return {
    artistName: deezerArtist.name,
    deezerFans: deezerArtist.nb_fan,
    totalSongs: allTracks.length,
    topCount: topTracks.length,
    randomCount: randomTracks.length,
    songsWithLyrics,
    songsWithoutLyrics,
    newSongsCreated,
    existingSongsSkipped,
    snippetsCreated,
    errors,
    songs: songResults,
    durationMs: Date.now() - startedAt,
  };
}
