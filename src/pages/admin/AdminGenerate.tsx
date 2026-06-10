import { useState } from "react";
import { collection, addDoc, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import { db, serverTimestamp } from "../../lib/firebase";
import { searchArtistSongs, GeniusSong } from "../../lib/geniusApi";
import { fetchLyrics } from "../../lib/lyricsApi";
import { generateSnippets } from "../../lib/snippetGenerator";

const GENIUS_TOKEN = import.meta.env.VITE_GENIUS_ACCESS_TOKEN as string | undefined;
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

type SongStatus = "idle" | "fetching-lyrics" | "generating" | "done" | "no-lyrics" | "error";

interface SongState {
  song: GeniusSong;
  selected: boolean;
  status: SongStatus;
  snippetsAdded: number;
  errorMsg?: string;
}

async function findOrCreateArtist(name: string): Promise<string> {
  const q = query(collection(db, "artists"), where("nameLower", "==", name.toLowerCase()));
  const snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0].id;
  const ref = await addDoc(collection(db, "artists"), {
    name,
    nameLower: name.toLowerCase(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

async function findOrCreateSong(
  artistId: string,
  artistName: string,
  title: string,
  releaseYear?: number
): Promise<string> {
  const q = query(
    collection(db, "songs"),
    where("artistId", "==", artistId),
    where("titleLower", "==", title.toLowerCase())
  );
  const snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0].id;

  const ref = await addDoc(collection(db, "songs"), {
    title,
    titleLower: title.toLowerCase(),
    artistId,
    artistName,
    releaseYear: releaseYear ?? null,
    isGlobalHit: false,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

async function snippetExists(songId: string, text: string): Promise<boolean> {
  const q = query(
    collection(db, "snippets"),
    where("songId", "==", songId),
    where("textLower", "==", text.toLowerCase())
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export default function AdminGenerate() {
  const [artistQuery, setArtistQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [songs, setSongs] = useState<SongState[]>([]);

  const [generating, setGenerating] = useState(false);
  const [totalAdded, setTotalAdded] = useState<number | null>(null);

  const missingGenius = !GENIUS_TOKEN;
  const missingAnthropic = !ANTHROPIC_KEY;

  const handleSearch = async () => {
    if (!artistQuery.trim() || !GENIUS_TOKEN) return;
    setSearching(true);
    setSearchError("");
    setSongs([]);
    setTotalAdded(null);

    try {
      const results = await searchArtistSongs(artistQuery.trim(), GENIUS_TOKEN);
      setSongs(
        results.map((song) => ({ song, selected: true, status: "idle", snippetsAdded: 0 }))
      );
      if (!results.length) setSearchError("Aucune chanson trouvée.");
    } catch (err) {
      setSearchError(`Erreur Genius : ${String(err)}`);
    } finally {
      setSearching(false);
    }
  };

  const toggleSong = (id: number) => {
    setSongs((prev) =>
      prev.map((s) => (s.song.id === id ? { ...s, selected: !s.selected } : s))
    );
  };

  const selectAll = (value: boolean) => {
    setSongs((prev) => prev.map((s) => ({ ...s, selected: value })));
  };

  const handleGenerate = async () => {
    if (!ANTHROPIC_KEY) return;
    const selected = songs.filter((s) => s.selected);
    if (!selected.length) return;

    setGenerating(true);
    setTotalAdded(null);
    let grandTotal = 0;

    for (const entry of selected) {
      const { song } = entry;
      const artistName = song.primary_artist.name;
      const title = song.title;

      // Mark as fetching lyrics
      setSongs((prev) =>
        prev.map((s) =>
          s.song.id === song.id ? { ...s, status: "fetching-lyrics" } : s
        )
      );

      try {
        const lyrics = await fetchLyrics(artistName, title);

        if (!lyrics) {
          setSongs((prev) =>
            prev.map((s) =>
              s.song.id === song.id ? { ...s, status: "no-lyrics" } : s
            )
          );
          continue;
        }

        // Mark as generating
        setSongs((prev) =>
          prev.map((s) =>
            s.song.id === song.id ? { ...s, status: "generating" } : s
          )
        );

        const snippets = await generateSnippets(lyrics, title, artistName, ANTHROPIC_KEY!, song.isDeepCut);

        if (!snippets.length) {
          setSongs((prev) =>
            prev.map((s) =>
              s.song.id === song.id
                ? { ...s, status: "error", errorMsg: "Aucun snippet généré" }
                : s
            )
          );
          continue;
        }

        // Upsert artist + song in Firestore
        const releaseYear = song.release_date_for_display
          ? parseInt(song.release_date_for_display.split("-")[0] ?? song.release_date_for_display.slice(-4))
          : undefined;

        const artistId = await findOrCreateArtist(artistName);
        const songId = await findOrCreateSong(artistId, artistName, title, releaseYear);

        let added = 0;
        for (const snippet of snippets) {
          if (!snippet.text?.trim()) continue;
          const exists = await snippetExists(songId, snippet.text);
          if (exists) continue;

          await addDoc(collection(db, "snippets"), {
            songId,
            songTitle: title,
            artistId,
            artistName,
            text: snippet.text.trim(),
            textLower: snippet.text.trim().toLowerCase(),
            snippetType: snippet.snippet_type ?? "other",
            difficulty: Math.min(5, Math.max(1, Number(snippet.difficulty) || 3)),
            containsTitle: Boolean(snippet.contains_title),
            isApproved: false,
            licenseStatus: "manual_mvp",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          added++;
        }

        grandTotal += added;
        setSongs((prev) =>
          prev.map((s) =>
            s.song.id === song.id ? { ...s, status: "done", snippetsAdded: added } : s
          )
        );
      } catch (err) {
        setSongs((prev) =>
          prev.map((s) =>
            s.song.id === song.id
              ? { ...s, status: "error", errorMsg: String(err) }
              : s
          )
        );
      }

      // Small delay to avoid hammering APIs
      await new Promise((r) => setTimeout(r, 400));
    }

    setTotalAdded(grandTotal);
    setGenerating(false);
  };

  const selectedCount = songs.filter((s) => s.selected).length;
  const hasResults = songs.some((s) => s.status !== "idle");

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-yellow-400 font-black">
          Génération
        </p>
        <h2 className="text-3xl font-black tracking-tight mt-1">
          Générer des snippets
        </h2>
        <p className="text-gray-500 text-sm mt-2 max-w-2xl">
          Recherche les chansons d'un artiste via Genius, récupère les paroles automatiquement, puis utilise Claude pour extraire des snippets prêts à modérer.
        </p>
      </div>

      {/* Missing env vars warning */}
      {(missingGenius || missingAnthropic) && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-3xl p-5 flex flex-col gap-3">
          <p className="text-red-300 font-black text-sm">Configuration manquante</p>
          <p className="text-red-400 text-xs">
            Ajoute ces variables dans ton fichier <code className="bg-red-500/20 px-1 rounded">.env</code> :
          </p>
          <div className="bg-black/40 rounded-2xl p-4 font-mono text-xs text-gray-300 space-y-1">
            {missingGenius && <p>VITE_GENIUS_ACCESS_TOKEN=your_genius_token</p>}
            {missingAnthropic && <p>VITE_ANTHROPIC_API_KEY=your_anthropic_key</p>}
          </div>
          <p className="text-gray-500 text-xs">
            Genius token : developer.genius.com · Anthropic key : console.anthropic.com
          </p>
        </div>
      )}

      {/* Search */}
      <div className="bg-gray-950/70 border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/20 flex flex-col gap-4">
        <h3 className="text-xl font-black text-white tracking-tight">
          Rechercher un artiste
        </h3>

        <div className="flex gap-3">
          <input
            type="text"
            value={artistQuery}
            onChange={(e) => setArtistQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Ex : Ninho, Jul, Stromae…"
            disabled={missingGenius || searching}
            className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10 disabled:opacity-50"
          />
          <button
            onClick={handleSearch}
            disabled={!artistQuery.trim() || missingGenius || searching}
            className="bg-yellow-400 text-black font-black rounded-2xl px-6 py-3 text-sm hover:bg-yellow-300 disabled:opacity-50 transition active:scale-95"
          >
            {searching ? "Recherche…" : "Rechercher"}
          </button>
        </div>

        {searchError && (
          <p className="text-red-400 text-sm">{searchError}</p>
        )}
      </div>

      {/* Song list */}
      {songs.length > 0 && (
        <div className="bg-gray-950/70 border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/20 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xl font-black text-white tracking-tight">
              {songs.length} chansons trouvées
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => selectAll(true)}
                className="text-xs font-bold text-gray-400 hover:text-white transition px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10"
              >
                Tout sélectionner
              </button>
              <button
                onClick={() => selectAll(false)}
                className="text-xs font-bold text-gray-400 hover:text-white transition px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10"
              >
                Tout désélectionner
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {songs.map((entry: SongState) => {
            const { song, selected, status, snippetsAdded, errorMsg } = entry;
            return (
              <label
                key={song.id}
                className={[
                  "flex items-center gap-3 rounded-2xl border px-4 py-3 cursor-pointer transition",
                  selected
                    ? "border-yellow-400/30 bg-yellow-400/[0.06]"
                    : "border-white/10 bg-white/[0.02] opacity-60",
                  generating ? "cursor-default" : "",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={generating}
                  onChange={() => toggleSong(song.id)}
                  className="h-4 w-4 accent-yellow-400 shrink-0"
                />

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{song.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-xs text-gray-500 truncate">{song.primary_artist.name}</p>
                    {song.isDeepCut && (
                      <span className="shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-400 border border-purple-500/25">
                        deep cut
                      </span>
                    )}
                  </div>
                </div>

                {/* Status badge */}
                {status === "fetching-lyrics" && (
                  <span className="text-xs text-gray-400 shrink-0">paroles…</span>
                )}
                {status === "generating" && (
                  <span className="text-xs text-yellow-400 shrink-0">génération…</span>
                )}
                {status === "done" && (
                  <span className="text-xs font-black text-green-400 shrink-0">
                    +{snippetsAdded}
                  </span>
                )}
                {status === "no-lyrics" && (
                  <span className="text-xs text-gray-600 shrink-0">pas de paroles</span>
                )}
                {status === "error" && (
                  <span className="text-xs text-red-400 shrink-0" title={errorMsg}>
                    erreur
                  </span>
                )}
              </label>
            );
          })}
          </div>

          {/* Generate button */}
          {!hasResults && (
            <button
              onClick={handleGenerate}
              disabled={selectedCount === 0 || missingAnthropic || generating}
              className="bg-yellow-400 text-black font-black rounded-2xl py-3 text-sm hover:bg-yellow-300 disabled:opacity-50 transition active:scale-95"
            >
              {generating
                ? "Génération en cours…"
                : `Générer les snippets (${selectedCount} chanson${selectedCount > 1 ? "s" : ""})`}
            </button>
          )}

          {hasResults && !generating && (
            <button
              onClick={handleGenerate}
              disabled={selectedCount === 0 || missingAnthropic || generating}
              className="bg-white/[0.04] text-gray-300 border border-white/10 font-bold rounded-2xl py-3 text-sm hover:bg-white/[0.08] disabled:opacity-50 transition"
            >
              Relancer sur les chansons sélectionnées
            </button>
          )}
        </div>
      )}

      {/* Results report */}
      {totalAdded !== null && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-3xl p-5">
          <p className="text-green-300 font-black">
            ✅ {totalAdded} snippet{totalAdded > 1 ? "s" : ""} ajouté{totalAdded > 1 ? "s" : ""} en attente de modération.
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Rends-toi dans <strong className="text-gray-300">Snippets</strong> pour les approuver ou les rejeter.
          </p>
          <div className="mt-3 flex gap-3">
            <a
              href="/admin/snippets"
              className="bg-yellow-400 text-black font-black rounded-2xl px-5 py-2.5 text-sm hover:bg-yellow-300 transition"
            >
              Aller à la modération →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
