#!/usr/bin/env node
/**
 * Lyric Millionaire — Snippet Generator CLI
 *
 * Usage:
 *   npx tsx scripts/generateSnippets.ts "Booba"
 *   npx tsx scripts/generateSnippets.ts "Taylor Swift"
 *
 * Prerequisites:
 *   1. Go to Firebase Console → Project Settings → Service Accounts
 *   2. Click "Generate new private key" → download the JSON
 *   3. Save it as  scripts/serviceAccount.json  (gitignored)
 *
 * What it does:
 *   - Searches Deezer for the artist
 *   - Fetches top 30 songs + 20 random tracks from albums
 *   - Fetches full lyrics from lrclib.net for each song
 *   - Extracts 3 snippets per song (easy / medium / hard)
 *   - Writes songs + snippets to Firestore with isApproved: false
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// ── Firebase Admin init ───────────────────────────────────────────────────────

const SA_PATH = resolve(process.cwd(), "scripts/serviceAccount.json");

if (!existsSync(SA_PATH)) {
  console.error(`
❌  Service account not found at: scripts/serviceAccount.json

Setup:
  1. Firebase Console → Project Settings → Service Accounts
  2. "Generate new private key" → download JSON
  3. Save it as scripts/serviceAccount.json
`);
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(SA_PATH, "utf8"))) });
const db = getFirestore();

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeezerArtist {
  id: number;
  name: string;
  picture_medium: string;
  nb_fan: number;
}

interface DeezerTrack {
  id: number;
  title: string;
  preview: string;
  album: { id: number; title: string; release_date?: string };
  artist: { id: number; name: string };
}

interface DeezerAlbum {
  id: number;
  title: string;
}

// ── Terminal helpers ──────────────────────────────────────────────────────────

const LINE = "═".repeat(52);

function log(msg: string)     { console.log(msg); }
function ok(msg: string)      { console.log(`  ✓  ${msg}`); }
function warn(msg: string)    { console.log(`  ⚠  ${msg}`); }
function fail(msg: string)    { console.log(`  ✗  ${msg}`); }

function progressBar(current: number, total: number): string {
  const W = 30;
  const filled = total > 0 ? Math.round((current / total) * W) : 0;
  return `[${"█".repeat(filled)}${"░".repeat(W - filled)}] ${current}/${total}`;
}

// ── String helpers ────────────────────────────────────────────────────────────

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

// ── Deezer API ────────────────────────────────────────────────────────────────

async function deezerGet(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

async function searchArtist(name: string): Promise<DeezerArtist | null> {
  const data = await deezerGet(
    `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=5`
  );
  return data?.data?.[0] ?? null;
}

async function getTopTracks(artistId: number): Promise<DeezerTrack[]> {
  const data = await deezerGet(`https://api.deezer.com/artist/${artistId}/top?limit=50`);
  return data?.data ?? [];
}

async function getAlbums(artistId: number): Promise<DeezerAlbum[]> {
  const data = await deezerGet(`https://api.deezer.com/artist/${artistId}/albums?limit=20`);
  return data?.data ?? [];
}

async function getAlbumTracks(albumId: number): Promise<DeezerTrack[]> {
  const data = await deezerGet(`https://api.deezer.com/album/${albumId}/tracks`);
  return data?.data ?? [];
}

// ── lrclib ───────────────────────────────────────────────────────────────────

async function fetchLyrics(trackName: string, artistName: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({ track_name: trackName, artist_name: artistName });
    const res = await fetch(`https://lrclib.net/api/get?${params}`);
    if (res.status === 404 || !res.ok) return null;
    const data: any = await res.json();
    if (data.instrumental) return null;
    if (data.plainLyrics?.trim()) return data.plainLyrics as string;
    if (data.syncedLyrics) {
      const plain = (data.syncedLyrics as string)
        .split("\n")
        .map(l => l.replace(/^\[\d{1,2}:\d{2}\.\d{2,3}\]\s*/, "").trim())
        .filter(l => l.length > 0)
        .join("\n");
      if (plain.trim()) return plain;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Snippet extraction ────────────────────────────────────────────────────────

function extractSnippets(lyrics: string, songTitle: string) {
  const BLOCK = 3;
  const lines = lyrics
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 2)
    .filter(l => !/^\[.*\]$/.test(l));

  if (lines.length < BLOCK) return [];

  const max = Math.max(0, lines.length - BLOCK);
  const clamp = (n: number) => Math.max(0, Math.min(Math.round(n), max));
  const randInt = (min: number, hi: number) => min + Math.floor(Math.random() * (hi - min + 1));

  const easyIdx   = clamp(max * (0.40 + Math.random() * 0.20));
  const mediumIdx = clamp(max * (0.15 + Math.random() * 0.20));
  const hardIdx   = clamp(
    max * (Math.random() < 0.5 ? 0.05 + Math.random() * 0.10 : 0.65 + Math.random() * 0.20)
  );

  const normTitle = normalizeTitle(songTitle);

  const makeSnippet = (idx: number, difficulty: number) => {
    const text = lines.slice(idx, idx + BLOCK).join("\n");
    const containsTitle =
      normTitle.length > 2 &&
      text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(normTitle);
    return { text, difficulty, containsTitle };
  };

  return [
    makeSnippet(easyIdx,   randInt(1, 2)),
    makeSnippet(mediumIdx, randInt(3, 4)),
    makeSnippet(hardIdx,   5),
  ];
}

// ── Firestore helpers ─────────────────────────────────────────────────────────

async function findOrCreateArtist(name: string, imageUrl: string): Promise<string> {
  const snap = await db.collection("artists").where("name", "==", name).limit(1).get();
  if (!snap.empty) return snap.docs[0].id;
  const ref = await db.collection("artists").add({
    name,
    imageUrl,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return ref.id;
}

async function loadExistingTitles(artistId: string): Promise<Set<string>> {
  const snap = await db.collection("songs").where("artistId", "==", artistId).get();
  return new Set(snap.docs.map(d => normalizeTitle(d.data().title as string)));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const artistQuery = process.argv[2]?.trim();
  if (!artistQuery) {
    console.error('Usage: npx tsx scripts/generateSnippets.ts "Artist Name"');
    process.exit(1);
  }

  log(`\n🎵  Lyric Millionaire — Snippet Generator`);
  log(LINE);

  const startedAt = Date.now();

  // 1. Search artist on Deezer
  log(`\n🔍  Searching "${artistQuery}" on Deezer...`);
  const artist = await searchArtist(artistQuery);
  if (!artist) {
    console.error(`❌  Artist "${artistQuery}" not found on Deezer.`);
    process.exit(1);
  }
  ok(`${artist.name} · ${artist.nb_fan.toLocaleString("fr-FR")} fans`);

  // 2. Top 30 tracks
  log(`\n🎵  Fetching top tracks...`);
  const allTop = await getTopTracks(artist.id);
  const topTracks = allTop.slice(0, 30);
  const topIds = new Set(topTracks.map(t => t.id));
  ok(`${topTracks.length} top tracks.`);

  // 3. 20 random tracks from albums
  log(`\n🎲  Fetching random tracks from albums...`);
  const albums = await getAlbums(artist.id);
  const pickedAlbums = shuffleArray(albums).slice(0, 4);
  const seenTitles = new Set(topTracks.map(t => normalizeTitle(t.title)));
  const albumTracks: DeezerTrack[] = [];

  for (const album of pickedAlbums) {
    const tracks = await getAlbumTracks(album.id);
    for (const t of tracks) {
      if (topIds.has(t.id)) continue;
      const norm = normalizeTitle(t.title);
      if (seenTitles.has(norm)) continue;
      seenTitles.add(norm);
      albumTracks.push(t);
    }
  }

  const randomTracks = shuffleArray(albumTracks).slice(0, 20);
  ok(`${randomTracks.length} random tracks from ${pickedAlbums.length} albums.`);

  const allTracks = [...topTracks, ...randomTracks];
  log(`\n  → ${allTracks.length} songs total to process.`);

  // 4. Firestore setup
  log(`\n🔥  Connecting to Firestore...`);
  const artistId = await findOrCreateArtist(artist.name, artist.picture_medium);
  const existingTitles = await loadExistingTitles(artistId);
  ok(`Artist ID: ${artistId}`);
  if (existingTitles.size > 0) ok(`${existingTitles.size} existing songs will be skipped.`);

  // 5. Process each track
  log(`\n📖  Processing songs...\n`);

  let snippetsCreated = 0;
  let songsWithLyrics = 0;
  let songsWithoutLyrics = 0;
  let newSongs = 0;
  let skipped = 0;
  const errors: string[] = [];
  const results: Array<{ title: string; status: "ok" | "skipped" | "no_lyrics" | "error"; count: number }> = [];

  for (let i = 0; i < allTracks.length; i++) {
    const track = allTracks[i];
    const normTitle = normalizeTitle(track.title);
    const bar = progressBar(i + 1, allTracks.length);
    const label = track.title.slice(0, 32).padEnd(32);
    process.stdout.write(`\r  ${bar}  ${label}`);

    // Skip songs already in Firestore
    if (existingTitles.has(normTitle)) {
      skipped++;
      results.push({ title: track.title, status: "skipped", count: 0 });
      continue;
    }

    try {
      // Fetch lyrics
      const lyrics = await fetchLyrics(track.title, artist.name);
      if (!lyrics) {
        songsWithoutLyrics++;
        results.push({ title: track.title, status: "no_lyrics", count: 0 });
        continue;
      }

      // Extract snippets
      const snippets = extractSnippets(lyrics, track.title);
      if (snippets.length === 0) {
        songsWithoutLyrics++;
        results.push({ title: track.title, status: "no_lyrics", count: 0 });
        continue;
      }

      songsWithLyrics++;

      // Create song document
      const rawYear = parseInt((track.album.release_date ?? "").slice(0, 4), 10);
      const releaseYear = Number.isFinite(rawYear) && rawYear > 1900 ? rawYear : null;

      const songRef = await db.collection("songs").add({
        title: track.title,
        artistId,
        artistName: artist.name,
        album: track.album.title || null,
        releaseYear,
        previewUrl: track.preview || null,
        isGlobalHit: i < topTracks.length,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      newSongs++;
      existingTitles.add(normTitle);

      // Write snippets in a batch
      const batch = db.batch();
      for (const s of snippets) {
        const ref = db.collection("snippets").doc();
        batch.set(ref, {
          songId: songRef.id,
          songTitle: track.title,
          artistId,
          artistName: artist.name,
          text: s.text,
          snippetType: "other",
          difficulty: s.difficulty,
          containsTitle: s.containsTitle,
          isApproved: false,
          licenseStatus: "manual_mvp",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        snippetsCreated++;
      }
      await batch.commit();

      results.push({ title: track.title, status: "ok", count: snippets.length });

    } catch (err) {
      errors.push(`${track.title}: ${String(err)}`);
      results.push({ title: track.title, status: "error", count: 0 });
    }
  }

  process.stdout.write("\n");

  // 6. Summary
  const duration = ((Date.now() - startedAt) / 1000).toFixed(1);

  log(`\n📊  Summary`);
  log(LINE);
  log(`  Artist        ${artist.name}`);
  log(`  Songs         ${allTracks.length}  (${topTracks.length} top · ${randomTracks.length} random)`);
  log(`  With lyrics   ${songsWithLyrics}`);
  log(`  No lyrics     ${songsWithoutLyrics}`);
  log(`  New songs     ${newSongs}`);
  log(`  Snippets      ${snippetsCreated}  (isApproved: false)`);
  log(`  Skipped       ${skipped}  (already in DB)`);
  log(`  Duration      ${duration}s`);

  if (errors.length > 0) {
    log(`\n  Errors (${errors.length}):`);
    for (const e of errors) fail(e);
  }

  log(LINE);

  // Per-song detail (only failures + errors)
  const failures = results.filter(r => r.status !== "ok" && r.status !== "skipped");
  if (failures.length > 0) {
    log(`\n  Songs without lyrics (${failures.length}):`);
    for (const r of failures) {
      if (r.status === "no_lyrics") warn(r.title);
      if (r.status === "error")    fail(r.title);
    }
  }

  log(`\n✓  Done! Review snippets in the admin panel at /admin/snippets\n`);
}

main().catch(err => {
  console.error("\n❌  Fatal error:", err);
  process.exit(1);
});
