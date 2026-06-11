import { useState, useEffect, useMemo, useRef } from "react";
import {
  getDocs,
  collection,
  updateDoc,
  doc,
  addDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Song, GamePlaylist } from "../../types";
import { invalidateGameCache } from "../../lib/gameEngine";

type SongRow = Song & { id: string };

// Legacy boolean field names for backward compat
const LEGACY_FIELD: Record<string, keyof SongRow> = {
  "global-hits": "isGlobalHit",
  "rap-fr": "isRapFr",
};

function songInPlaylist(song: SongRow, slug: string): boolean {
  if (song.playlists?.includes(slug)) return true;
  if (slug === "global-hits" && song.isGlobalHit) return true;
  if (slug === "rap-fr" && song.isRapFr) return true;
  return false;
}

// ── Stat pill ──────────────────────────────────────────────────────────────────
function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-600">{sub}</p>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AdminSongs() {
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [playlists, setPlaylists] = useState<GamePlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"previews" | "playlists">("previews");

  // Preview tab
  const [previewFilter, setPreviewFilter] = useState<"all" | "missing" | "has">("missing");
  const [previewSearch, setPreviewSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Playlist tab
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [playlistSearch, setPlaylistSearch] = useState("");
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [showAddPlaylist, setShowAddPlaylist] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", slug: "", emoji: "" });
  const [addingPlaylist, setAddingPlaylist] = useState(false);
  const [playlistError, setPlaylistError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [songsSnap, playlistsSnap] = await Promise.all([
          getDocs(collection(db, "songs")),
          getDocs(collection(db, "gamePlaylists")),
        ]);
        setSongs(songsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SongRow)));
        const loaded = playlistsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GamePlaylist));
        setPlaylists(loaded);
        if (loaded.length > 0) setSelectedSlug(loaded[0].slug);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Stats ──
  const withPreview = songs.filter((s) => !!s.previewUrl).length;
  const activeSongs = songs.filter((s) => s.isActive).length;

  // ── Preview tab ──
  const filteredPreviews = useMemo(() => {
    let list = songs;
    if (previewFilter === "missing") list = list.filter((s) => !s.previewUrl);
    if (previewFilter === "has") list = list.filter((s) => !!s.previewUrl);
    if (previewSearch.trim()) {
      const q = previewSearch.toLowerCase();
      list = list.filter(
        (s) => s.title?.toLowerCase().includes(q) || s.artistName?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (!a.previewUrl && b.previewUrl) return -1;
      if (a.previewUrl && !b.previewUrl) return 1;
      return (a.artistName ?? "").localeCompare(b.artistName ?? "");
    });
  }, [songs, previewFilter, previewSearch]);

  const startEditUrl = (song: SongRow) => {
    setEditingId(song.id);
    setEditUrl(song.previewUrl ?? "");
    setTestingId(null);
    if (audioRef.current) { audioRef.current.pause(); }
  };

  const saveUrl = async (songId: string) => {
    setSavingId(songId);
    try {
      const trimmed = editUrl.trim() || null;
      await updateDoc(doc(db, "songs", songId), { previewUrl: trimmed, updatedAt: serverTimestamp() });
      setSongs((prev) => prev.map((s) => s.id === songId ? { ...s, previewUrl: trimmed ?? undefined } : s));
      invalidateGameCache();
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  };

  const testAudio = (song: SongRow) => {
    const url = editingId === song.id ? editUrl.trim() : song.previewUrl;
    if (!url) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (testingId === song.id) {
      audio.pause();
      setTestingId(null);
    } else {
      audio.src = url;
      audio.play().then(() => setTestingId(song.id)).catch(() => {});
    }
  };

  // ── Playlist tab ──
  const selectedPlaylist = playlists.find((p) => p.slug === selectedSlug) ?? null;

  const filteredPlaylistSongs = useMemo(() => {
    let list = songs;
    if (playlistSearch.trim()) {
      const q = playlistSearch.toLowerCase();
      list = list.filter(
        (s) => s.title?.toLowerCase().includes(q) || s.artistName?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => (a.artistName ?? "").localeCompare(b.artistName ?? ""));
  }, [songs, playlistSearch]);

  const toggleSong = async (song: SongRow, slug: string) => {
    if (togglingIds.has(song.id)) return;
    setTogglingIds((prev) => new Set([...prev, song.id]));
    const inPlaylist = songInPlaylist(song, slug);
    const legacyKey = LEGACY_FIELD[slug];

    try {
      const update: Record<string, unknown> = {
        playlists: inPlaylist ? arrayRemove(slug) : arrayUnion(slug),
        updatedAt: serverTimestamp(),
      };
      if (legacyKey) update[legacyKey as string] = !inPlaylist;

      await updateDoc(doc(db, "songs", song.id), update);

      setSongs((prev) =>
        prev.map((s) => {
          if (s.id !== song.id) return s;
          const next: SongRow = {
            ...s,
            playlists: inPlaylist
              ? (s.playlists ?? []).filter((p) => p !== slug)
              : [...(s.playlists ?? []), slug],
          };
          if (legacyKey) (next as Record<string, unknown>)[legacyKey as string] = !inPlaylist;
          return next;
        })
      );
      invalidateGameCache();
    } finally {
      setTogglingIds((prev) => { const n = new Set(prev); n.delete(song.id); return n; });
    }
  };

  const addPlaylist = async () => {
    setPlaylistError("");
    const name = newForm.name.trim();
    const slug = newForm.slug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const emoji = newForm.emoji.trim() || "🎵";
    if (!name || !slug) { setPlaylistError("Nom et slug requis."); return; }
    if (playlists.some((p) => p.slug === slug)) { setPlaylistError("Ce slug existe déjà."); return; }

    setAddingPlaylist(true);
    try {
      const ref = await addDoc(collection(db, "gamePlaylists"), { name, slug, emoji, createdAt: serverTimestamp() });
      const newPl: GamePlaylist = { id: ref.id, name, slug, emoji };
      setPlaylists((prev) => [...prev, newPl]);
      setSelectedSlug(slug);
      setNewForm({ name: "", slug: "", emoji: "" });
      setShowAddPlaylist(false);
    } finally {
      setAddingPlaylist(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-yellow-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white">Chansons</h1>
        <p className="mt-1 text-sm text-gray-500">Previews audio (Blindtest) · Playlists de jeu</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={songs.length} />
        <Stat label="Actives" value={activeSongs} />
        <Stat label="Avec preview" value={withPreview} sub={`${songs.length - withPreview} manquants`} />
        <Stat label="Playlists" value={playlists.length} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-1 w-fit">
        {(["previews", "playlists"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "rounded-xl px-4 py-2 text-sm font-black transition",
              tab === t
                ? "bg-yellow-400 text-black shadow"
                : "text-gray-500 hover:text-gray-300",
            ].join(" ")}
          >
            {t === "previews" ? "🎧 Previews Blindtest" : "🎵 Playlists de jeu"}
          </button>
        ))}
      </div>

      {/* ── Tab: Previews ────────────────────────────────────────────────────── */}
      {tab === "previews" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter */}
            <div className="flex gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-1">
              {(["all", "missing", "has"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setPreviewFilter(f)}
                  className={[
                    "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                    previewFilter === f
                      ? "bg-yellow-400/15 text-yellow-300 border border-yellow-400/25"
                      : "text-gray-600 hover:text-gray-300",
                  ].join(" ")}
                >
                  {f === "all" ? `Tous (${songs.length})` : f === "missing" ? `Manquants (${songs.filter(s => !s.previewUrl).length})` : `OK (${withPreview})`}
                </button>
              ))}
            </div>

            {/* Search */}
            <input
              value={previewSearch}
              onChange={(e) => setPreviewSearch(e.target.value)}
              placeholder="Rechercher titre ou artiste…"
              className="flex-1 min-w-[200px] rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-yellow-400/40"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                  <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em] text-gray-600">Chanson</th>
                  <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em] text-gray-600">Artiste</th>
                  <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em] text-gray-600">Preview URL</th>
                  <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em] text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredPreviews.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-600">Aucune chanson</td></tr>
                )}
                {filteredPreviews.map((song) => {
                  const isEditing = editingId === song.id;
                  const isSaving = savingId === song.id;
                  const isTesting = testingId === song.id;

                  return (
                    <tr key={song.id} className="group hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3 font-bold text-white max-w-[180px] truncate">{song.title}</td>
                      <td className="px-4 py-3 text-gray-400 max-w-[140px] truncate">{song.artistName}</td>

                      <td className="px-4 py-3 max-w-[300px]">
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editUrl}
                            onChange={(e) => setEditUrl(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveUrl(song.id); if (e.key === "Escape") setEditingId(null); }}
                            placeholder="https://…"
                            className="w-full rounded-xl border border-yellow-400/40 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400/70"
                          />
                        ) : song.previewUrl ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/10 px-2 py-1 text-xs font-bold text-green-400 border border-green-500/20">
                            ✓ <span className="max-w-[180px] truncate text-green-300/70 font-normal">{song.previewUrl}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-1 text-xs font-bold text-red-400 border border-red-500/20">
                            ✗ Aucun preview
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => testAudio(song)}
                                disabled={!editUrl.trim()}
                                className="rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-xs font-bold text-gray-300 hover:bg-white/[0.1] disabled:opacity-30 transition"
                              >
                                {isTesting ? "⏸ Stop" : "▶ Test"}
                              </button>
                              <button
                                onClick={() => saveUrl(song.id)}
                                disabled={isSaving}
                                className="rounded-lg bg-yellow-400 px-3 py-1 text-xs font-black text-black hover:bg-yellow-300 disabled:opacity-60 transition"
                              >
                                {isSaving ? "…" : "Sauver"}
                              </button>
                              <button
                                onClick={() => { setEditingId(null); if (audioRef.current) audioRef.current.pause(); setTestingId(null); }}
                                className="rounded-lg border border-white/10 px-2 py-1 text-xs font-bold text-gray-500 hover:text-gray-300 transition"
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <>
                              {song.previewUrl && (
                                <button
                                  onClick={() => testAudio(song)}
                                  className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-bold text-gray-400 hover:text-white transition"
                                >
                                  {isTesting ? "⏸" : "▶"}
                                </button>
                              )}
                              <button
                                onClick={() => startEditUrl(song)}
                                className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-gray-400 hover:text-yellow-300 hover:border-yellow-400/30 transition"
                              >
                                Modifier
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <audio ref={audioRef} onEnded={() => setTestingId(null)} onPause={() => setTestingId(null)} className="hidden" />
        </div>
      )}

      {/* ── Tab: Playlists ────────────────────────────────────────────────────── */}
      {tab === "playlists" && (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">

          {/* Left: playlist list */}
          <aside className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-600">Playlists</p>

            <div className="space-y-1">
              {playlists.length === 0 && (
                <p className="rounded-xl border border-white/[0.07] p-3 text-xs text-gray-600">
                  Aucune playlist. Créez-en une ci-dessous.
                </p>
              )}
              {playlists.map((pl) => {
                const count = songs.filter((s) => songInPlaylist(s, pl.slug)).length;
                return (
                  <button
                    key={pl.slug}
                    onClick={() => { setSelectedSlug(pl.slug); setPlaylistSearch(""); }}
                    className={[
                      "w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                      selectedSlug === pl.slug
                        ? "border-yellow-400/25 bg-yellow-400/[0.08] text-yellow-300"
                        : "border-white/[0.06] text-gray-500 hover:text-gray-200 hover:bg-white/[0.03]",
                    ].join(" ")}
                  >
                    <span className="text-lg shrink-0">{pl.emoji ?? "🎵"}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold truncate">{pl.name}</span>
                      <span className="block text-[11px] text-gray-600">{count} chanson{count !== 1 ? "s" : ""}</span>
                    </span>
                    {selectedSlug === pl.slug && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-yellow-400" />}
                  </button>
                );
              })}
            </div>

            {/* Add playlist */}
            {showAddPlaylist ? (
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
                <p className="text-xs font-black text-gray-400">Nouvelle playlist</p>
                <div className="flex gap-2">
                  <input
                    value={newForm.emoji}
                    onChange={(e) => setNewForm((f) => ({ ...f, emoji: e.target.value }))}
                    placeholder="🎵"
                    className="w-12 rounded-xl border border-white/[0.07] bg-black/30 px-2 py-2 text-center text-sm outline-none focus:border-yellow-400/40"
                  />
                  <input
                    value={newForm.name}
                    onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Nom affiché"
                    className="flex-1 rounded-xl border border-white/[0.07] bg-black/30 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-yellow-400/40"
                  />
                </div>
                <input
                  value={newForm.slug}
                  onChange={(e) => setNewForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="slug (ex: rnb-fr)"
                  className="w-full rounded-xl border border-white/[0.07] bg-black/30 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-yellow-400/40"
                />
                {playlistError && <p className="text-xs text-red-400">{playlistError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={addPlaylist}
                    disabled={addingPlaylist}
                    className="flex-1 rounded-xl bg-yellow-400 py-2 text-xs font-black text-black hover:bg-yellow-300 disabled:opacity-60 transition"
                  >
                    {addingPlaylist ? "…" : "Créer"}
                  </button>
                  <button
                    onClick={() => { setShowAddPlaylist(false); setPlaylistError(""); }}
                    className="rounded-xl border border-white/[0.07] px-3 py-2 text-xs font-bold text-gray-500 hover:text-gray-300 transition"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddPlaylist(true)}
                className="w-full rounded-xl border border-dashed border-white/[0.12] py-2.5 text-xs font-bold text-gray-600 hover:text-gray-300 hover:border-white/[0.2] transition"
              >
                + Nouvelle playlist
              </button>
            )}
          </aside>

          {/* Right: song list for selected playlist */}
          <div className="space-y-4">
            {selectedPlaylist ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{selectedPlaylist.emoji ?? "🎵"}</span>
                  <div>
                    <h2 className="text-lg font-black text-white">{selectedPlaylist.name}</h2>
                    <p className="text-xs text-gray-600">
                      slug: <code className="text-gray-400">{selectedPlaylist.slug}</code>
                      {" · "}
                      {songs.filter((s) => songInPlaylist(s, selectedPlaylist.slug)).length} chansons assignées
                    </p>
                  </div>
                </div>

                <input
                  value={playlistSearch}
                  onChange={(e) => setPlaylistSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-yellow-400/40"
                />

                <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
                  <div className="flex items-center justify-between border-b border-white/[0.07] bg-white/[0.02] px-4 py-2.5">
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-600">
                      {filteredPlaylistSongs.length} chanson{filteredPlaylistSongs.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex gap-2 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-400/80 inline-block" /> Dans la playlist</span>
                      <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-white/10 inline-block" /> Hors playlist</span>
                    </div>
                  </div>

                  <div className="divide-y divide-white/[0.04] max-h-[60vh] overflow-y-auto">
                    {filteredPlaylistSongs.length === 0 && (
                      <p className="px-4 py-8 text-center text-sm text-gray-600">Aucune chanson</p>
                    )}
                    {filteredPlaylistSongs.map((song) => {
                      const inPlaylist = songInPlaylist(song, selectedPlaylist.slug);
                      const isToggling = togglingIds.has(song.id);

                      return (
                        <div
                          key={song.id}
                          className={[
                            "flex items-center gap-3 px-4 py-3 transition cursor-pointer select-none",
                            inPlaylist ? "bg-yellow-400/[0.04] hover:bg-yellow-400/[0.07]" : "hover:bg-white/[0.02]",
                          ].join(" ")}
                          onClick={() => !isToggling && toggleSong(song, selectedPlaylist.slug)}
                        >
                          <div className={[
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition",
                            inPlaylist
                              ? "border-yellow-400 bg-yellow-400 text-black"
                              : "border-white/20 bg-transparent",
                            isToggling ? "opacity-50" : "",
                          ].join(" ")}>
                            {inPlaylist && <span className="text-[11px] font-black">✓</span>}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className={["text-sm font-bold truncate", inPlaylist ? "text-white" : "text-gray-400"].join(" ")}>
                              {song.title}
                            </p>
                            <p className="text-xs text-gray-600 truncate">{song.artistName}</p>
                          </div>

                          {song.previewUrl && (
                            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold bg-green-500/15 text-green-400 border border-green-500/20">
                              preview ✓
                            </span>
                          )}

                          <span className={[
                            "shrink-0 text-xs font-bold transition",
                            isToggling ? "text-gray-600" : inPlaylist ? "text-red-400 opacity-0 group-hover:opacity-100" : "text-yellow-400 opacity-0",
                          ].join(" ")}>
                            {isToggling ? "…" : inPlaylist ? "Retirer" : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center rounded-2xl border border-dashed border-white/[0.1] py-24">
                <p className="text-sm text-gray-600">Sélectionne une playlist à gauche</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
