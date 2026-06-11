import { useState, useEffect, useMemo } from "react";
import { getDocs, collection, updateDoc, doc, addDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db, serverTimestamp } from "../../lib/firebase";
import { Song, GamePlaylist } from "../../types";
import { invalidateGameCache } from "../../lib/gameEngine";

type SongRow = Song & { id: string };

const LEGACY_FIELD: Record<string, string> = {
  "global-hits": "isGlobalHit",
  "rap-fr": "isRapFr",
};

function inPlaylist(song: SongRow, slug: string): boolean {
  if (song.playlists?.includes(slug)) return true;
  if (slug === "global-hits" && song.isGlobalHit) return true;
  if (slug === "rap-fr" && song.isRapFr) return true;
  return false;
}

export default function AdminPlaylists() {
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [playlists, setPlaylists] = useState<GamePlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  // Add playlist form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formEmoji, setFormEmoji] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, "songs")),
      getDocs(collection(db, "gamePlaylists")),
    ]).then(([songsSnap, playlistsSnap]) => {
      setSongs(songsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SongRow)));
      const loaded = playlistsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GamePlaylist));
      setPlaylists(loaded);
      if (loaded.length > 0) setSelectedSlug(loaded[0].slug);
    }).finally(() => setLoading(false));
  }, []);

  const selected = playlists.find((p) => p.slug === selectedSlug) ?? null;

  const filteredSongs = useMemo(() => {
    let list = [...songs];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) => s.title?.toLowerCase().includes(q) || s.artistName?.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => {
      if (!selected) return 0;
      const aIn = inPlaylist(a, selected.slug);
      const bIn = inPlaylist(b, selected.slug);
      if (aIn && !bIn) return -1;
      if (!aIn && bIn) return 1;
      return (a.artistName ?? "").localeCompare(b.artistName ?? "");
    });
  }, [songs, search, selected]);

  const toggle = async (song: SongRow, slug: string) => {
    if (togglingIds.has(song.id)) return;
    setTogglingIds((prev) => new Set([...prev, song.id]));
    const wasIn = inPlaylist(song, slug);
    const legacyKey = LEGACY_FIELD[slug];
    try {
      const update: Record<string, unknown> = {
        playlists: wasIn ? arrayRemove(slug) : arrayUnion(slug),
        updatedAt: serverTimestamp(),
      };
      if (legacyKey) update[legacyKey] = !wasIn;
      await updateDoc(doc(db, "songs", song.id), update);
      setSongs((prev) =>
        prev.map((s) => {
          if (s.id !== song.id) return s;
          const next: SongRow = {
            ...s,
            playlists: wasIn
              ? (s.playlists ?? []).filter((p) => p !== slug)
              : [...(s.playlists ?? []), slug],
          };
          if (legacyKey) (next as unknown as Record<string, unknown>)[legacyKey] = !wasIn;
          return next;
        })
      );
      invalidateGameCache();
    } finally {
      setTogglingIds((prev) => { const n = new Set(prev); n.delete(song.id); return n; });
    }
  };

  const createPlaylist = async () => {
    setFormError("");
    const name = formName.trim();
    const slug = formSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const emoji = formEmoji.trim() || "🎵";
    if (!name) { setFormError("Le nom est requis."); return; }
    if (!slug) { setFormError("Le slug est requis (ex: rnb-fr)."); return; }
    if (playlists.some((p) => p.slug === slug)) { setFormError("Ce slug existe déjà."); return; }
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "gamePlaylists"), {
        name, slug, emoji, createdAt: serverTimestamp(),
      });
      const newPl: GamePlaylist = { id: ref.id, name, slug, emoji };
      setPlaylists((prev) => [...prev, newPl]);
      setSelectedSlug(slug);
      setFormName(""); setFormSlug(""); setFormEmoji("");
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-yellow-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-white">Playlists de jeu</h1>
        <p className="mt-1 text-sm text-gray-500">
          Assigne des chansons à chaque contenu de jeu. Crée une nouvelle playlist sans modifier le code.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">

        {/* ── Left: playlist list ─────────────────────────────────────────── */}
        <aside className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-600 px-1">
            Playlists ({playlists.length})
          </p>

          {playlists.length === 0 && !showForm && (
            <p className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-xs text-gray-600">
              Aucune playlist. Crée la première ci-dessous.
            </p>
          )}

          {playlists.map((pl) => {
            const count = songs.filter((s) => inPlaylist(s, pl.slug)).length;
            const isSelected = selectedSlug === pl.slug;
            return (
              <button
                key={pl.slug}
                onClick={() => { setSelectedSlug(pl.slug); setSearch(""); }}
                className={[
                  "w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                  isSelected
                    ? "border-yellow-400/25 bg-yellow-400/[0.08] text-yellow-300"
                    : "border-white/[0.06] text-gray-400 hover:text-gray-200 hover:bg-white/[0.03] hover:border-white/[0.1]",
                ].join(" ")}
              >
                <span className="text-xl shrink-0">{pl.emoji ?? "🎵"}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold truncate">{pl.name}</span>
                  <span className="block text-xs text-gray-600 font-mono">{pl.slug}</span>
                </span>
                <span className={[
                  "shrink-0 rounded-lg px-2 py-0.5 text-xs font-black",
                  isSelected ? "bg-yellow-400/20 text-yellow-300" : "bg-white/[0.05] text-gray-600",
                ].join(" ")}>
                  {count}
                </span>
              </button>
            );
          })}

          {/* Add playlist */}
          {showForm ? (
            <div className="rounded-2xl border border-white/[0.1] bg-white/[0.02] p-4 space-y-3">
              <p className="text-xs font-black text-gray-300">Nouvelle playlist</p>

              <div className="flex gap-2">
                <input
                  value={formEmoji}
                  onChange={(e) => setFormEmoji(e.target.value)}
                  placeholder="🎵"
                  maxLength={4}
                  className="w-12 shrink-0 rounded-xl border border-white/[0.07] bg-black/30 px-2 py-2 text-center text-base outline-none focus:border-yellow-400/40"
                />
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nom (ex: RnB FR)"
                  className="flex-1 rounded-xl border border-white/[0.07] bg-black/30 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-yellow-400/40"
                />
              </div>
              <input
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="slug (ex: rnb-fr)"
                className="w-full rounded-xl border border-white/[0.07] bg-black/30 px-3 py-2 text-sm text-white placeholder-gray-600 font-mono outline-none focus:border-yellow-400/40"
              />
              {formError && <p className="text-xs text-red-400">{formError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={createPlaylist}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-yellow-400 py-2 text-xs font-black text-black hover:bg-yellow-300 disabled:opacity-60 transition"
                >
                  {saving ? "…" : "Créer"}
                </button>
                <button
                  onClick={() => { setShowForm(false); setFormError(""); }}
                  className="rounded-xl border border-white/[0.07] px-3 text-xs font-bold text-gray-500 hover:text-gray-300 transition"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full rounded-2xl border border-dashed border-white/[0.1] py-3 text-xs font-bold text-gray-600 hover:text-gray-300 hover:border-white/[0.2] transition"
            >
              + Nouvelle playlist
            </button>
          )}
        </aside>

        {/* ── Right: songs for selected playlist ──────────────────────────── */}
        <div className="space-y-4">
          {!selected ? (
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-white/[0.1] py-24">
              <p className="text-sm text-gray-600">Sélectionne une playlist à gauche</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selected.emoji ?? "🎵"}</span>
                  <div>
                    <h2 className="text-lg font-black text-white">{selected.name}</h2>
                    <p className="text-xs text-gray-600">
                      <code className="text-gray-500">{selected.slug}</code>
                      {" · "}
                      <span className="text-yellow-400 font-bold">
                        {songs.filter((s) => inPlaylist(s, selected.slug)).length}
                      </span>
                      {" "}chanson{songs.filter((s) => inPlaylist(s, selected.slug)).length !== 1 ? "s" : ""} assignée{songs.filter((s) => inPlaylist(s, selected.slug)).length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="w-48 sm:w-64 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-yellow-400/40"
                />
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
                <div className="border-b border-white/[0.07] bg-white/[0.02] px-4 py-2.5 flex items-center gap-3 text-xs text-gray-600">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-4 h-4 rounded border-2 border-yellow-400 bg-yellow-400" />
                    Dans la playlist
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-4 h-4 rounded border-2 border-white/20" />
                    Hors playlist
                  </span>
                  <span className="ml-auto">{filteredSongs.length} chanson{filteredSongs.length !== 1 ? "s" : ""}</span>
                </div>

                <div className="divide-y divide-white/[0.04] max-h-[65vh] overflow-y-auto">
                  {filteredSongs.length === 0 && (
                    <p className="px-4 py-10 text-center text-sm text-gray-600">Aucune chanson</p>
                  )}
                  {filteredSongs.map((song) => {
                    const isIn = inPlaylist(song, selected.slug);
                    const isToggling = togglingIds.has(song.id);
                    return (
                      <div
                        key={song.id}
                        onClick={() => !isToggling && toggle(song, selected.slug)}
                        className={[
                          "flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition",
                          isIn ? "bg-yellow-400/[0.04] hover:bg-yellow-400/[0.07]" : "hover:bg-white/[0.02]",
                          isToggling ? "opacity-50" : "",
                        ].join(" ")}
                      >
                        {/* Checkbox */}
                        <div className={[
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition",
                          isIn ? "border-yellow-400 bg-yellow-400 text-black" : "border-white/20",
                        ].join(" ")}>
                          {isIn && <span className="text-[11px] font-black leading-none">✓</span>}
                        </div>

                        {/* Song info */}
                        <div className="flex-1 min-w-0">
                          <p className={["text-sm font-bold truncate", isIn ? "text-white" : "text-gray-400"].join(" ")}>
                            {song.title}
                          </p>
                          <p className="text-xs text-gray-600 truncate">{song.artistName}</p>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-2 shrink-0">
                          {song.previewUrl && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/15">
                              preview
                            </span>
                          )}
                          {song.isActive ? null : (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-gray-500/10 text-gray-500 border border-gray-500/15">
                              inactif
                            </span>
                          )}
                          {isToggling && <span className="text-xs text-gray-600">…</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
