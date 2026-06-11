import { useState, useEffect, useMemo, useRef } from "react";
import { getDocs, collection, updateDoc, doc } from "firebase/firestore";
import { db, serverTimestamp } from "../../lib/firebase";
import { Song } from "../../types";
import { invalidateGameCache } from "../../lib/gameEngine";

type SongRow = Song & { id: string };

export default function AdminPreviews() {
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "missing" | "has">("missing");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    getDocs(collection(db, "songs"))
      .then((snap) => setSongs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SongRow))))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = [...songs];
    if (filter === "missing") list = list.filter((s) => !s.previewUrl);
    if (filter === "has") list = list.filter((s) => Boolean(s.previewUrl));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) => s.title?.toLowerCase().includes(q) || s.artistName?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (!a.previewUrl && b.previewUrl) return -1;
      if (a.previewUrl && !b.previewUrl) return 1;
      return (a.artistName ?? "").localeCompare(b.artistName ?? "");
    });
    return list;
  }, [songs, filter, search]);

  const withPreview = songs.filter((s) => Boolean(s.previewUrl)).length;
  const missing = songs.length - withPreview;

  const startEdit = (song: SongRow) => {
    setEditingId(song.id);
    setEditUrl(song.previewUrl ?? "");
    stopAudio();
  };

  const stopAudio = () => {
    audioRef.current?.pause();
    setTestingId(null);
  };

  const save = async (songId: string) => {
    setSavingId(songId);
    try {
      const url = editUrl.trim() || null;
      await updateDoc(doc(db, "songs", songId), { previewUrl: url, updatedAt: serverTimestamp() });
      setSongs((prev) =>
        prev.map((s) => (s.id === songId ? { ...s, previewUrl: url ?? undefined } : s))
      );
      invalidateGameCache();
      setEditingId(null);
      stopAudio();
    } finally {
      setSavingId(null);
    }
  };

  const toggleTest = (song: SongRow) => {
    const url = editingId === song.id ? editUrl.trim() : song.previewUrl;
    const audio = audioRef.current;
    if (!url || !audio) return;
    if (testingId === song.id) {
      stopAudio();
    } else {
      audio.src = url;
      audio.play().then(() => setTestingId(song.id)).catch(() => setTestingId(null));
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
        <h1 className="text-2xl font-black text-white">Previews Blindtest</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ajoute ou modifie l'URL d'extrait audio de chaque chanson.
        </p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Total", value: songs.length },
          { label: "Avec preview", value: withPreview },
          { label: "Manquants", value: missing },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 min-w-[100px]"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-600">{label}</p>
            <p className="mt-1 text-2xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-1">
          {(["all", "missing", "has"] as const).map((f) => {
            const labels = { all: `Tous (${songs.length})`, missing: `Manquants (${missing})`, has: `OK (${withPreview})` };
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                  filter === f
                    ? "bg-yellow-400/15 text-yellow-300 border border-yellow-400/25"
                    : "text-gray-600 hover:text-gray-300",
                ].join(" ")}
              >
                {labels[f]}
              </button>
            );
          })}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Titre ou artiste…"
          className="flex-1 min-w-[200px] rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-yellow-400/40"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.07] bg-white/[0.02] text-left text-[11px] font-black uppercase tracking-[0.18em] text-gray-600">
              <th className="px-4 py-3">Titre</th>
              <th className="px-4 py-3">Artiste</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">URL Preview</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-600">
                  Aucune chanson
                </td>
              </tr>
            )}
            {filtered.map((song) => {
              const isEditing = editingId === song.id;
              const isTesting = testingId === song.id;

              return (
                <tr key={song.id} className="hover:bg-white/[0.015] transition">
                  <td className="px-4 py-3 font-bold text-white max-w-[160px] truncate">{song.title}</td>
                  <td className="px-4 py-3 text-gray-400 max-w-[130px] truncate">{song.artistName}</td>

                  <td className="px-4 py-3">
                    {song.previewUrl ? (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-xs font-bold text-green-400">
                        ✓ Preview
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-400">
                        ✗ Manquant
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 max-w-[260px]">
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") save(song.id);
                          if (e.key === "Escape") { setEditingId(null); stopAudio(); }
                        }}
                        placeholder="https://…"
                        className="w-full rounded-xl border border-yellow-400/40 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-yellow-400/70"
                      />
                    ) : (
                      <span className="truncate text-xs text-gray-600 max-w-[240px] block">
                        {song.previewUrl ?? "—"}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {(isEditing || song.previewUrl) && (
                        <button
                          onClick={() => toggleTest(song)}
                          disabled={isEditing && !editUrl.trim()}
                          className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-bold text-gray-400 hover:text-white transition disabled:opacity-30"
                        >
                          {isTesting ? "⏸" : "▶"}
                        </button>
                      )}
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => save(song.id)}
                            disabled={savingId === song.id}
                            className="rounded-lg bg-yellow-400 px-3 py-1 text-xs font-black text-black hover:bg-yellow-300 disabled:opacity-60 transition"
                          >
                            {savingId === song.id ? "…" : "Sauver"}
                          </button>
                          <button
                            onClick={() => { setEditingId(null); stopAudio(); }}
                            className="rounded-lg border border-white/10 px-2 py-1 text-xs font-bold text-gray-500 hover:text-gray-300 transition"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEdit(song)}
                          className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-gray-400 hover:text-yellow-300 hover:border-yellow-400/30 transition"
                        >
                          Modifier
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <audio ref={audioRef} onEnded={stopAudio} onPause={() => setTestingId(null)} className="hidden" />
    </div>
  );
}
