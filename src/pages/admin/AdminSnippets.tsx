import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  db,
  collection,
  getDocs,
  updateDocument,
  deleteDocument,
  serverTimestamp,
} from "../../lib/firebase";
import { generateGameRun, invalidateGameCache } from "../../lib/gameEngine";
import { fetchItunesPreview } from "../../lib/itunesPreview";
import { GamePlaylist, Snippet } from "../../types/index";

type AdminSnippet = Snippet & {
  id: string;
  songPlaylists?: string[];
};

type FilterStatus = "all" | "pending" | "approved" | "rejected";
type FilterDifficulty = "all" | "1" | "2" | "3" | "4" | "5";
type ViewMode = "table" | "review";

type SortColumn =
  | "artistName"
  | "songTitle"
  | "difficulty"
  | "snippetType"
  | "containsTitle"
  | "licenseStatus"
  | "createdAt"
  | "status";

type SortDirection = "asc" | "desc";

type EditSnippetForm = {
  text: string;
  difficulty: number;
  snippetType: string;
  containsTitle: boolean;
  isApproved: boolean;
  licenseStatus: string;
};

function getSnippetStatus(snippet: AdminSnippet): FilterStatus {
  if (snippet.licenseStatus === "removed") return "rejected";
  if (snippet.isApproved === true) return "approved";
  return "pending";
}

function getStatusLabel(status: FilterStatus): string {
  if (status === "approved") return "Approuvé";
  if (status === "pending") return "En attente";
  if (status === "rejected") return "Rejeté";
  return "Tous";
}

function getStatusRank(snippet: AdminSnippet): number {
  const status = getSnippetStatus(snippet);
  if (status === "pending") return 1;
  if (status === "approved") return 2;
  if (status === "rejected") return 3;
  return 4;
}

function getCreatedAtMillis(snippet: AdminSnippet): number {
  return snippet.createdAt?.toMillis?.() ?? 0;
}

function formatDate(snippet: AdminSnippet): string {
  const date = snippet.createdAt?.toDate?.();
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalize(value?: string): string {
  return value?.trim().toLowerCase() ?? "";
}

function getTextLower(value: string): string {
  return value.trim().toLowerCase();
}

function difficultyLabel(d: number): { text: string; className: string } {
  if (d <= 2) return { text: `${d} — Facile`, className: "bg-green-500/20 text-green-300 border-green-500/30" };
  if (d === 3) return { text: `${d} — Moyen`, className: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" };
  return { text: `${d} — Difficile`, className: "bg-red-500/20 text-red-300 border-red-500/30" };
}

function SortableHeader({
  label,
  column,
  activeColumn,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  column: SortColumn;
  activeColumn: SortColumn;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
  align?: "left" | "right";
}) {
  const isActive = activeColumn === column;
  return (
    <th
      className={`px-3 py-3 text-${align} whitespace-nowrap select-none cursor-pointer hover:text-yellow-400 transition`}
      onClick={() => onSort(column)}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>
        {label}
        <span className={isActive ? "text-yellow-400" : "text-gray-600"}>
          {isActive ? (direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </span>
    </th>
  );
}

export default function AdminSnippets() {
  const navigate = useNavigate();

  const [snippets, setSnippets] = useState<AdminSnippet[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [testGameLoading, setTestGameLoading] = useState(false);

  const [errors, setErrors] = useState<string[]>([]);
  const [report, setReport] = useState<string | null>(null);

  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{ done: number; total: number } | null>(null);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("pending");
  const [filterArtist, setFilterArtist] = useState("all");
  const [filterSong, setFilterSong] = useState("all");
  const [filterDifficulty, setFilterDifficulty] = useState<FilterDifficulty>("all");

  const [sortColumn, setSortColumn] = useState<SortColumn>("artistName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const [editingSnippet, setEditingSnippet] = useState<AdminSnippet | null>(null);
  const [editForm, setEditForm] = useState<EditSnippetForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [playlists, setPlaylists] = useState<GamePlaylist[]>([]);
  const [playlistModal, setPlaylistModal] = useState<{ snippet: AdminSnippet; selected: string[] } | null>(null);
  const [playlistModalSaving, setPlaylistModalSaving] = useState(false);
  const [bulkPlaylistModal, setBulkPlaylistModal] = useState<string[]>([]);
  const [bulkPlaylistModalOpen, setBulkPlaylistModalOpen] = useState(false);

  const loadSnippets = async () => {
    setLoading(true);
    setErrors([]);
    setReport(null);

    try {
      const [snippetsSnap, songsSnap, playlistsSnap] = await Promise.all([
        getDocs(collection(db, "snippets")),
        getDocs(collection(db, "songs")),
        getDocs(collection(db, "gamePlaylists")),
      ]);

      const songDataById = new Map(
        songsSnap.docs.map((d) => [d.id, { playlists: ((d.data() as Record<string, unknown>).playlists ?? []) as string[] }])
      );

      const data = snippetsSnap.docs.map((d) => {
        const snippet = { id: d.id, ...d.data() } as AdminSnippet;
        return { ...snippet, songPlaylists: songDataById.get(snippet.songId)?.playlists ?? [] };
      });

      setPlaylists(playlistsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GamePlaylist)));

      setSnippets(data);
      setSelectedIds((current) => {
        const availableIds = new Set(data.map((snippet) => snippet.id));
        return new Set(Array.from(current).filter((id) => availableIds.has(id)));
      });
    } catch (err) {
      setErrors([`Erreur chargement snippets : ${String(err)}`]);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(column);
    if (column === "createdAt" || column === "difficulty" || column === "status") {
      setSortDirection("desc");
    } else {
      setSortDirection("asc");
    }
  };

  const approveSnippet = async (snippetId: string) => {
    setActionLoadingId(snippetId);
    setErrors([]);
    setReport(null);
    try {
      await updateDocument("snippets", snippetId, {
        isApproved: true,
        licenseStatus: "manual_mvp",
        updatedAt: serverTimestamp(),
      });
      setSnippets((prev) =>
        prev.map((s) =>
          s.id === snippetId ? { ...s, isApproved: true, licenseStatus: "manual_mvp" } : s
        )
      );
    } catch (err) {
      setErrors([`Erreur approbation snippet : ${String(err)}`]);
    } finally {
      setActionLoadingId(null);
    }
  };

  const restoreSnippetToPending = async (snippetId: string) => {
    setActionLoadingId(snippetId);
    setErrors([]);
    setReport(null);
    try {
      await updateDocument("snippets", snippetId, {
        isApproved: false,
        licenseStatus: "manual_mvp",
        updatedAt: serverTimestamp(),
      });
      setSnippets((prev) =>
        prev.map((s) =>
          s.id === snippetId ? { ...s, isApproved: false, licenseStatus: "manual_mvp" } : s
        )
      );
    } catch (err) {
      setErrors([`Erreur restauration snippet : ${String(err)}`]);
    } finally {
      setActionLoadingId(null);
    }
  };

  const deleteSnippetPermanently = async (snippet: AdminSnippet) => {
    const confirmed = window.confirm(
      `Supprimer définitivement ce snippet ?\n\n${snippet.artistName} — ${snippet.songTitle}\n\nCette action est irréversible.`
    );
    if (!confirmed) return;
    setActionLoadingId(snippet.id);
    setErrors([]);
    setReport(null);
    try {
      await deleteDocument("snippets", snippet.id);
      setSnippets((prev) => prev.filter((s) => s.id !== snippet.id));
      setReport("🗑️ Snippet supprimé définitivement.");
    } catch (err) {
      setErrors([`Erreur suppression définitive : ${String(err)}`]);
    } finally {
      setActionLoadingId(null);
    }
  };

  const approveAllForSong = async (songSnippets: AdminSnippet[]) => {
    const pending = songSnippets.filter((s) => getSnippetStatus(s) === "pending");
    if (!pending.length) return;
    setBulkLoading(true);
    try {
      for (const s of pending) {
        await updateDocument("snippets", s.id, {
          isApproved: true,
          licenseStatus: "manual_mvp",
          updatedAt: serverTimestamp(),
        });
      }
      setSnippets((prev) =>
        prev.map((s) =>
          pending.some((p) => p.id === s.id)
            ? { ...s, isApproved: true, licenseStatus: "manual_mvp" }
            : s
        )
      );
      invalidateGameCache();
    } catch (err) {
      setErrors([`Erreur approbation chanson : ${String(err)}`]);
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleSnippetSelection = (snippetId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(snippetId)) next.delete(snippetId);
      else next.add(snippetId);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkApprove = async (items: AdminSnippet[]) => {
    for (const snippet of items) {
      await updateDocument("snippets", snippet.id, {
        isApproved: true,
        licenseStatus: "manual_mvp",
        updatedAt: serverTimestamp(),
      });
    }
  };

  const handleBulkDelete = async (items: AdminSnippet[]) => {
    const confirmed = window.confirm(
      `Supprimer définitivement ${items.length} snippet(s) sélectionné(s) ?\n\nCette action est irréversible.`
    );
    if (!confirmed) return false;
    for (const snippet of items) {
      await deleteDocument("snippets", snippet.id);
    }
    return true;
  };

  const runBulkAction = async (action: "approve" | "delete") => {
    const items = snippets.filter((s) => selectedIds.has(s.id));
    if (!items.length) return;
    setBulkLoading(true);
    setErrors([]);
    setReport(null);
    try {
      if (action === "approve") {
        await handleBulkApprove(items);
        setSnippets((prev) =>
          prev.map((s) =>
            selectedIds.has(s.id) ? { ...s, isApproved: true, licenseStatus: "manual_mvp" } : s
          )
        );
        invalidateGameCache();
        setReport(`✅ ${items.length} snippet(s) approuvé(s).`);
      }
      if (action === "delete") {
        const deleted = await handleBulkDelete(items);
        if (!deleted) return;
        setSnippets((prev) => prev.filter((s) => !selectedIds.has(s.id)));
        setReport(`🗑️ ${items.length} snippet(s) supprimé(s) définitivement.`);
      }
      clearSelection();
    } catch (err) {
      setErrors([`Erreur action groupée : ${String(err)}`]);
    } finally {
      setBulkLoading(false);
    }
  };

  const openEditModal = (snippet: AdminSnippet) => {
    setEditingSnippet(snippet);
    setEditForm({
      text: snippet.text ?? "",
      difficulty: Number(snippet.difficulty) || 1,
      snippetType: snippet.snippetType ?? "other",
      containsTitle: snippet.containsTitle ?? false,
      isApproved: snippet.isApproved ?? false,
      licenseStatus: snippet.licenseStatus ?? "manual_mvp",
    });
    setErrors([]);
    setReport(null);
  };

  const closeEditModal = () => {
    setEditingSnippet(null);
    setEditForm(null);
    setSavingEdit(false);
  };

  const saveSnippetEdit = async () => {
    if (!editingSnippet || !editForm) return;
    if (!editForm.text.trim()) {
      setErrors(["Le texte du snippet ne peut pas être vide."]);
      return;
    }
    if (editForm.difficulty < 1 || editForm.difficulty > 5) {
      setErrors(["La difficulté doit être comprise entre 1 et 5."]);
      return;
    }
    setSavingEdit(true);
    setErrors([]);
    setReport(null);
    try {
      const finalLicenseStatus =
        editForm.licenseStatus === "removed" ? "removed" : editForm.licenseStatus || "manual_mvp";
      const finalIsApproved = finalLicenseStatus === "removed" ? false : editForm.isApproved;

      await updateDocument("snippets", editingSnippet.id, {
        text: editForm.text.trim(),
        textLower: getTextLower(editForm.text),
        difficulty: Number(editForm.difficulty),
        snippetType: editForm.snippetType || "other",
        containsTitle: editForm.containsTitle,
        isApproved: finalIsApproved,
        licenseStatus: finalLicenseStatus,
        updatedAt: serverTimestamp(),
      });
      setSnippets((prev) =>
        prev.map((s) =>
          s.id === editingSnippet.id
            ? {
                ...s,
                text: editForm.text.trim(),
                difficulty: Number(editForm.difficulty),
                snippetType: (editForm.snippetType || "other") as import("../../types").SnippetType,
                containsTitle: editForm.containsTitle,
                isApproved: finalIsApproved,
                licenseStatus: finalLicenseStatus as import("../../types").LicenseStatus,
              }
            : s
        )
      );
      invalidateGameCache();
      setReport("✅ Snippet modifié avec succès.");
      closeEditModal();
    } catch (err) {
      setErrors([`Erreur modification snippet : ${String(err)}`]);
    } finally {
      setSavingEdit(false);
    }
  };

  const approveAllFilteredPendingSnippets = async () => {
    const pendingFilteredSnippets = filteredSnippets.filter(
      (s) => getSnippetStatus(s) === "pending"
    );
    if (!pendingFilteredSnippets.length) return;
    setBulkLoading(true);
    setErrors([]);
    setReport(null);
    try {
      for (const snippet of pendingFilteredSnippets) {
        await updateDocument("snippets", snippet.id, {
          isApproved: true,
          licenseStatus: "manual_mvp",
          updatedAt: serverTimestamp(),
        });
      }
      const ids = new Set(pendingFilteredSnippets.map((s) => s.id));
      setSnippets((prev) =>
        prev.map((s) =>
          ids.has(s.id) ? { ...s, isApproved: true, licenseStatus: "manual_mvp" } : s
        )
      );
      invalidateGameCache();
      setReport(`✅ ${pendingFilteredSnippets.length} snippet(s) filtré(s) approuvé(s).`);
    } catch (err) {
      setErrors([`Erreur approbation massive : ${String(err)}`]);
    } finally {
      setBulkLoading(false);
    }
  };

  const openPlaylistModal = (snippet: AdminSnippet) => {
    setPlaylistModal({ snippet, selected: snippet.songPlaylists ?? [] });
  };

  const savePlaylistAssignment = async () => {
    if (!playlistModal || !playlistModal.snippet.songId) return;
    setPlaylistModalSaving(true);
    try {
      const selected = playlistModal.selected;
      const updates: Record<string, unknown> = {
        playlists: selected,
        isGlobalHit: selected.includes("global-hits"),
        isRapFr: selected.includes("rap-fr"),
        updatedAt: serverTimestamp(),
      };
      await updateDocument("songs", playlistModal.snippet.songId, updates);
      setSnippets((prev) =>
        prev.map((s) => s.songId === playlistModal.snippet.songId ? { ...s, songPlaylists: selected } : s)
      );
      invalidateGameCache();
      setReport(`✅ Playlists mises à jour.`);
      setPlaylistModal(null);
    } catch (err) {
      setErrors([`Erreur mise à jour playlist : ${String(err)}`]);
    } finally {
      setPlaylistModalSaving(false);
    }
  };

  const saveBulkPlaylistAssignment = async () => {
    if (!bulkPlaylistModal.length) { setBulkPlaylistModalOpen(false); return; }
    setBulkLoading(true);
    try {
      const songIds = Array.from(new Set(
        snippets.filter((s) => selectedIds.has(s.id) && s.songId).map((s) => s.songId!)
      ));
      for (const songId of songIds) {
        const song = snippets.find((s) => s.songId === songId);
        const current = song?.songPlaylists ?? [];
        const next = Array.from(new Set([...current, ...bulkPlaylistModal]));
        await updateDocument("songs", songId, {
          playlists: next,
          isGlobalHit: next.includes("global-hits"),
          isRapFr: next.includes("rap-fr"),
          updatedAt: serverTimestamp(),
        });
      }
      setSnippets((prev) =>
        prev.map((s) => {
          if (!selectedIds.has(s.id)) return s;
          const current = s.songPlaylists ?? [];
          return { ...s, songPlaylists: Array.from(new Set([...current, ...bulkPlaylistModal])) };
        })
      );
      invalidateGameCache();
      setReport(`✅ ${bulkPlaylistModal.length} playlist(s) ajoutée(s) à ${songIds.length} chanson(s).`);
      clearSelection();
      setBulkPlaylistModalOpen(false);
      setBulkPlaylistModal([]);
    } catch (err) {
      setErrors([`Erreur action groupée playlist : ${String(err)}`]);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleCreateTestGame = async () => {
    setTestGameLoading(true);
    setErrors([]);
    setReport(null);
    try {
      const runId = await generateGameRun("global-hits");
      navigate(`/game/${runId}`);
    } catch (err) {
      setErrors([`Impossible de générer une partie test : ${String(err)}`]);
    } finally {
      setTestGameLoading(false);
    }
  };

  const handleEnrichPreviews = async () => {
    setEnrichLoading(true);
    setEnrichProgress(null);
    setErrors([]);
    setReport(null);
    try {
      const songsSnap = await getDocs(collection(db, "songs"));
      const allSongs = songsSnap.docs;
      const total = allSongs.length;
      let found = 0;
      for (let i = 0; i < allSongs.length; i++) {
        const songDoc = allSongs[i];
        const data = songDoc.data();
        setEnrichProgress({ done: i + 1, total });
        const previewUrl = await fetchItunesPreview(data.title, data.artistName);
        await updateDocument("songs", songDoc.id, { previewUrl: previewUrl ?? null, updatedAt: serverTimestamp() });
        if (previewUrl) found++;
        if (i < allSongs.length - 1) await new Promise((r) => setTimeout(r, 300));
      }
      setReport(`Previews : ${found}/${total} chansons trouvées et mises à jour.`);
    } catch (err) {
      setErrors([`Erreur enrichissement previews : ${String(err)}`]);
    } finally {
      setEnrichLoading(false);
      setEnrichProgress(null);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setFilterStatus("pending");
    setFilterArtist("all");
    setFilterSong("all");
    setFilterDifficulty("all");
    setSortColumn("artistName");
    setSortDirection("asc");
  };

  const pendingSnippets = useMemo(() => snippets.filter((s) => getSnippetStatus(s) === "pending"), [snippets]);
  const approvedSnippets = useMemo(() => snippets.filter((s) => getSnippetStatus(s) === "approved"), [snippets]);
  const rejectedSnippets = useMemo(() => snippets.filter((s) => getSnippetStatus(s) === "rejected"), [snippets]);

  const easyApprovedCount = useMemo(
    () => approvedSnippets.filter((s) => Number(s.difficulty) <= 2).length,
    [approvedSnippets]
  );
  const hardApprovedCount = useMemo(
    () => approvedSnippets.filter((s) => Number(s.difficulty) >= 3).length,
    [approvedSnippets]
  );
  const uniqueApprovedSongsCount = useMemo(
    () => new Set(approvedSnippets.map((s) => s.songId)).size,
    [approvedSnippets]
  );
  const canGenerateGlobalGame = easyApprovedCount >= 5 && hardApprovedCount >= 5 && uniqueApprovedSongsCount >= 10;

  const artistOptions = useMemo(() => {
    const artists = new Map<string, string>();
    snippets.forEach((s) => {
      if (s.artistId && s.artistName) artists.set(s.artistId, s.artistName);
    });
    return Array.from(artists.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [snippets]);

  const songOptions = useMemo(() => {
    const songs = new Map<string, { id: string; title: string; artistName: string; artistId: string }>();
    snippets.forEach((s) => {
      if (s.songId && s.songTitle)
        songs.set(s.songId, { id: s.songId, title: s.songTitle, artistName: s.artistName, artistId: s.artistId });
    });
    return Array.from(songs.values()).sort((a, b) => {
      const c = a.artistName.localeCompare(b.artistName);
      return c !== 0 ? c : a.title.localeCompare(b.title);
    });
  }, [snippets]);

  const filteredSongOptions = useMemo(() => {
    if (filterArtist === "all") return songOptions;
    return songOptions.filter((s) => s.artistId === filterArtist);
  }, [songOptions, filterArtist]);

  const filteredSnippets = useMemo(() => {
    let result = [...snippets];
    const normalizedSearch = normalize(search);

    if (normalizedSearch) {
      result = result.filter(
        (s) =>
          normalize(s.artistName).includes(normalizedSearch) ||
          normalize(s.songTitle).includes(normalizedSearch) ||
          normalize(s.text).includes(normalizedSearch) ||
          normalize(s.snippetType).includes(normalizedSearch) ||
          normalize(s.licenseStatus).includes(normalizedSearch)
      );
    }
    if (filterStatus !== "all") result = result.filter((s) => getSnippetStatus(s) === filterStatus);
    if (filterArtist !== "all") result = result.filter((s) => s.artistId === filterArtist);
    if (filterSong !== "all") result = result.filter((s) => s.songId === filterSong);
    if (filterDifficulty !== "all") result = result.filter((s) => String(s.difficulty) === filterDifficulty);

    result.sort((a, b) => {
      let comparison = 0;
      if (sortColumn === "artistName") comparison = normalize(a.artistName).localeCompare(normalize(b.artistName));
      if (sortColumn === "songTitle") comparison = normalize(a.songTitle).localeCompare(normalize(b.songTitle));
      if (sortColumn === "difficulty") comparison = Number(a.difficulty) - Number(b.difficulty);
      if (sortColumn === "snippetType") comparison = normalize(a.snippetType).localeCompare(normalize(b.snippetType));
      if (sortColumn === "containsTitle") comparison = Number(a.containsTitle) - Number(b.containsTitle);
      if (sortColumn === "licenseStatus") comparison = normalize(a.licenseStatus).localeCompare(normalize(b.licenseStatus));
      if (sortColumn === "createdAt") comparison = getCreatedAtMillis(a) - getCreatedAtMillis(b);
      if (sortColumn === "status") comparison = getStatusRank(a) - getStatusRank(b);
      if (comparison === 0) comparison = normalize(a.artistName).localeCompare(normalize(b.artistName));
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [snippets, search, filterStatus, filterArtist, filterSong, filterDifficulty, sortColumn, sortDirection]);

  const filteredPendingCount = useMemo(
    () => filteredSnippets.filter((s) => getSnippetStatus(s) === "pending").length,
    [filteredSnippets]
  );

  const snippetsBySong = useMemo(() => {
    const groups = new Map<
      string,
      { songId: string; songTitle: string; artistName: string; snippets: AdminSnippet[] }
    >();
    for (const s of filteredSnippets) {
      const key = s.songId ?? s.songTitle;
      if (!groups.has(key)) {
        groups.set(key, { songId: s.songId, songTitle: s.songTitle, artistName: s.artistName, snippets: [] });
      }
      groups.get(key)!.snippets.push(s);
    }
    return Array.from(groups.values());
  }, [filteredSnippets]);

  const selectedSnippets = useMemo(() => snippets.filter((s) => selectedIds.has(s.id)), [snippets, selectedIds]);
  const visibleSelectedCount = useMemo(
    () => filteredSnippets.filter((s) => selectedIds.has(s.id)).length,
    [filteredSnippets, selectedIds]
  );
  const allVisibleSelected =
    filteredSnippets.length > 0 && visibleSelectedCount === filteredSnippets.length;

  const toggleAllVisibleSelection = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) filteredSnippets.forEach((s) => next.delete(s.id));
      else filteredSnippets.forEach((s) => next.add(s.id));
      return next;
    });
  };

  useEffect(() => {
    loadSnippets();
  }, []);

  useEffect(() => {
    if (filterSong !== "all" && filterArtist !== "all") {
      const selectedSong = songOptions.find((s) => s.id === filterSong);
      if (selectedSong && selectedSong.artistId !== filterArtist) setFilterSong("all");
    }
  }, [filterArtist, filterSong, songOptions]);

  useEffect(() => {
    if (filterArtist !== "all") setViewMode("review");
  }, [filterArtist]);

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-yellow-400 font-black">Catalogue</p>
          <h2 className="text-3xl font-black tracking-tight mt-1">Snippets</h2>
          <p className="text-gray-500 text-sm mt-2 max-w-2xl">
            Modère, filtre, trie et modifie les snippets utilisés pour générer les parties.
          </p>
        </div>
        <button
          onClick={loadSnippets}
          disabled={loading}
          className="bg-white/[0.04] text-gray-300 border border-white/10 rounded-2xl px-5 py-3 text-sm font-bold hover:bg-white/[0.08] hover:text-white disabled:opacity-50 transition"
        >
          {loading ? "Chargement…" : "Rafraîchir"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-gray-950/70 border border-white/10 rounded-2xl p-4">
          <p className="text-gray-500 text-xs">Total</p>
          <p className="text-white text-2xl font-black mt-1">{snippets.length}</p>
        </div>
        <div className="bg-gray-950/70 border border-white/10 rounded-2xl p-4 cursor-pointer" onClick={() => setFilterStatus("pending")}>
          <p className="text-gray-500 text-xs">En attente</p>
          <p className="text-yellow-400 text-2xl font-black mt-1">{pendingSnippets.length}</p>
        </div>
        <div className="bg-gray-950/70 border border-white/10 rounded-2xl p-4 cursor-pointer" onClick={() => setFilterStatus("approved")}>
          <p className="text-gray-500 text-xs">Approuvés</p>
          <p className="text-green-400 text-2xl font-black mt-1">{approvedSnippets.length}</p>
        </div>
        <div className="bg-gray-950/70 border border-white/10 rounded-2xl p-4 cursor-pointer" onClick={() => setFilterStatus("rejected")}>
          <p className="text-gray-500 text-xs">Rejetés</p>
          <p className="text-red-400 text-2xl font-black mt-1">{rejectedSnippets.length}</p>
        </div>
        <div className="bg-gray-950/70 border border-white/10 rounded-2xl p-4">
          <p className="text-gray-500 text-xs">Résultats filtrés</p>
          <p className="text-white text-2xl font-black mt-1">{filteredSnippets.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-950/70 border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/20 flex flex-col gap-4">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <h3 className="text-base font-black text-white tracking-tight">Filtres</h3>
          <button
            onClick={resetFilters}
            className="bg-white/[0.04] text-gray-300 border border-white/10 text-xs px-4 py-2 rounded-xl hover:bg-white/[0.08] transition self-start xl:self-auto"
          >
            Réinitialiser
          </button>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Recherche libre : artiste, chanson, snippet..."
          className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10"
        />

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-gray-500 text-xs font-bold">Artiste</span>
            <select
              value={filterArtist}
              onChange={(e) => setFilterArtist(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
            >
              <option value="all">Tous les artistes</option>
              {artistOptions.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-gray-500 text-xs font-bold">Chanson</span>
            <select
              value={filterSong}
              onChange={(e) => setFilterSong(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
            >
              <option value="all">Toutes les chansons</option>
              {filteredSongOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.artistName} — {s.title}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-gray-500 text-xs font-bold">Statut</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
            >
              <option value="all">Tous</option>
              <option value="pending">En attente</option>
              <option value="approved">Approuvés</option>
              <option value="rejected">Rejetés</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-gray-500 text-xs font-bold">Difficulté</span>
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value as FilterDifficulty)}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
            >
              <option value="all">Toutes</option>
              <option value="1">1 — Très facile</option>
              <option value="2">2 — Facile</option>
              <option value="3">3 — Moyen</option>
              <option value="4">4 — Difficile</option>
              <option value="5">5 — Très difficile</option>
            </select>
          </label>
        </div>
      </div>

      {/* Quick actions bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-white/10 overflow-hidden">
            <button
              onClick={() => setViewMode("review")}
              className={`px-4 py-2 text-xs font-black transition ${
                viewMode === "review"
                  ? "bg-yellow-400 text-black"
                  : "bg-white/[0.03] text-gray-400 hover:text-gray-200 hover:bg-white/[0.06]"
              }`}
            >
              Mode revue
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-4 py-2 text-xs font-black transition ${
                viewMode === "table"
                  ? "bg-yellow-400 text-black"
                  : "bg-white/[0.03] text-gray-400 hover:text-gray-200 hover:bg-white/[0.06]"
              }`}
            >
              Tableau
            </button>
          </div>
          <span className="text-gray-600 text-xs">
            {filteredSnippets.length} snippet{filteredSnippets.length !== 1 ? "s" : ""}
            {filterArtist !== "all" && (
              <span> · {snippetsBySong.length} chanson{snippetsBySong.length !== 1 ? "s" : ""}</span>
            )}
          </span>
        </div>

        {filteredPendingCount > 0 && (
          <button
            onClick={approveAllFilteredPendingSnippets}
            disabled={bulkLoading}
            className="bg-green-500/15 text-green-300 border border-green-500/30 font-black rounded-xl px-4 py-2 text-xs hover:bg-green-500/25 disabled:opacity-50 transition"
          >
            {bulkLoading ? "Approbation…" : `Tout approuver (${filteredPendingCount})`}
          </button>
        )}
      </div>

      {/* Audio previews */}
      <div className="bg-gray-950/70 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white">Previews audio (blindtest)</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Le mode blindtest nécessite un extrait audio par chanson. Enrichit via iTunes.
          </p>
          {enrichProgress && (
            <div className="mt-2">
              <p className="text-xs text-gray-400">
                {enrichProgress.done}/{enrichProgress.total} chansons traitées…
              </p>
              <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-yellow-400 transition-all"
                  style={{ width: `${(enrichProgress.done / enrichProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <button
          onClick={handleEnrichPreviews}
          disabled={enrichLoading}
          className="shrink-0 bg-white/[0.04] text-gray-200 border border-white/10 font-bold rounded-xl px-4 py-2.5 text-xs hover:bg-white/[0.08] disabled:opacity-50 transition whitespace-nowrap"
        >
          {enrichLoading
            ? enrichProgress
              ? `${enrichProgress.done}/${enrichProgress.total}…`
              : "Chargement…"
            : "Enrichir les previews"}
        </button>
      </div>

      {/* Feedback */}
      {report && (
        <div className="bg-green-500/15 border border-green-500/40 text-green-300 text-sm rounded-2xl p-4">
          {report}
        </div>
      )}
      {errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-4 flex flex-col gap-1">
          <p className="text-red-400 text-sm font-bold">{errors.length} erreur(s)</p>
          {errors.map((error, index) => (
            <p key={index} className="text-red-300 text-xs">{error}</p>
          ))}
        </div>
      )}

      {/* Bulk actions */}
      {selectedSnippets.length > 0 && (
        <div className="rounded-3xl border border-yellow-400/25 bg-yellow-400/10 p-4 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-yellow-300">Gestion groupée</p>
              <p className="mt-1 text-sm font-bold text-gray-300">
                {selectedSnippets.length} snippet(s) sélectionné(s)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => runBulkAction("approve")} disabled={bulkLoading}
                className="rounded-xl border border-green-500/25 bg-green-500/15 px-4 py-2 text-sm font-black text-green-300 transition hover:bg-green-500/25 disabled:opacity-50">
                Approuver
              </button>
              <button onClick={() => setBulkPlaylistModalOpen(true)} disabled={bulkLoading}
                className="rounded-xl border border-blue-500/25 bg-blue-500/15 px-4 py-2 text-sm font-black text-blue-300 transition hover:bg-blue-500/25 disabled:opacity-50">
                Ajouter à une playlist
              </button>
              <button onClick={() => runBulkAction("delete")} disabled={bulkLoading}
                className="rounded-xl border border-red-500/40 bg-red-950/70 px-4 py-2 text-sm font-black text-red-200 transition hover:bg-red-500/25 disabled:opacity-50">
                Supprimer
              </button>
              <button onClick={clearSelection} disabled={bulkLoading}
                className="rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-gray-400 transition hover:bg-white/[0.06] disabled:opacity-50">
                Désélectionner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review mode */}
      {viewMode === "review" && !loading && (
        <div className="flex flex-col gap-4">
          {filteredSnippets.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-gray-950/60 p-10 text-center text-gray-500 text-sm">
              Aucun snippet trouvé avec ces filtres.
            </div>
          )}

          {snippetsBySong.map((group) => {
            const pendingInGroup = group.snippets.filter((s) => getSnippetStatus(s) === "pending");

            return (
              <div key={group.songId} className="rounded-2xl border border-white/[0.08] bg-gray-950/60 overflow-hidden">
                {/* Song header */}
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white/[0.03] border-b border-white/[0.07]">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white truncate">{group.songTitle}</p>
                    <p className="text-xs text-gray-500 truncate">{group.artistName}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-600">{group.snippets.length} snippet{group.snippets.length !== 1 ? "s" : ""}</span>
                    {pendingInGroup.length > 0 && (
                      <button
                        onClick={() => approveAllForSong(group.snippets)}
                        disabled={bulkLoading}
                        className="bg-green-500/15 text-green-300 border border-green-500/25 text-xs font-black px-3 py-1.5 rounded-lg hover:bg-green-500/25 disabled:opacity-50 transition"
                      >
                        Approuver tout ({pendingInGroup.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Snippets grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.06]">
                  {group.snippets.map((snippet) => {
                    const status = getSnippetStatus(snippet);
                    const isLoading = actionLoadingId === snippet.id;
                    const diff = difficultyLabel(Number(snippet.difficulty));

                    return (
                      <div
                        key={snippet.id}
                        className={`flex flex-col gap-3 p-4 transition ${
                          status === "approved" ? "bg-green-500/[0.04]" :
                          status === "rejected" ? "bg-red-500/[0.04]" : ""
                        }`}
                      >
                        {/* Snippet meta */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-black px-2 py-0.5 rounded border ${diff.className}`}>
                            {diff.text}
                          </span>
                          {snippet.containsTitle && (
                            <span className="text-xs bg-orange-500/15 text-orange-300 border border-orange-500/25 px-2 py-0.5 rounded">
                              Contient le titre
                            </span>
                          )}
                        </div>

                        {/* Full snippet text */}
                        <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-line flex-1 min-h-[4rem]">
                          {snippet.text}
                        </p>

                        {/* Status badge */}
                        <div className="flex items-center justify-between gap-2">
                          {status === "approved" && (
                            <span className="text-xs bg-green-500/15 text-green-300 border border-green-500/25 px-2 py-1 rounded-lg font-bold">
                              Approuvé
                            </span>
                          )}
                          {status === "pending" && (
                            <span className="text-xs bg-yellow-500/15 text-yellow-300 border border-yellow-500/25 px-2 py-1 rounded-lg font-bold">
                              En attente
                            </span>
                          )}
                          {status === "rejected" && (
                            <span className="text-xs bg-red-500/15 text-red-300 border border-red-500/25 px-2 py-1 rounded-lg font-bold">
                              Rejeté
                            </span>
                          )}
                          <button
                            onClick={() => openEditModal(snippet)}
                            className="text-xs text-gray-500 hover:text-gray-300 transition"
                          >
                            Modifier
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          {status !== "approved" && (
                            <button
                              onClick={() => approveSnippet(snippet.id)}
                              disabled={isLoading}
                              className="flex-1 bg-green-500/15 text-green-300 border border-green-500/25 text-xs font-black py-2 rounded-xl hover:bg-green-500/25 disabled:opacity-50 transition active:scale-95"
                            >
                              {isLoading ? "…" : "Approuver"}
                            </button>
                          )}
                          {status === "rejected" && (
                            <button
                              onClick={() => restoreSnippetToPending(snippet.id)}
                              disabled={isLoading}
                              className="flex-1 bg-white/[0.04] text-gray-300 border border-white/10 text-xs font-bold py-2 rounded-xl hover:bg-white/[0.08] disabled:opacity-50 transition"
                            >
                              Restaurer
                            </button>
                          )}
                          <button
                            onClick={() => openPlaylistModal(snippet)}
                            className="flex-1 bg-blue-500/15 text-blue-300 border border-blue-500/25 text-xs font-black py-2 rounded-xl hover:bg-blue-500/25 transition"
                          >
                            {(snippet.songPlaylists ?? []).length > 0
                              ? `Playlists (${(snippet.songPlaylists ?? []).length})`
                              : "Ajouter à playlist"}
                          </button>
                          <button
                            onClick={() => deleteSnippetPermanently(snippet)}
                            disabled={isLoading}
                            className="bg-red-950/60 text-red-300 border border-red-500/25 text-xs px-3 py-2 rounded-xl hover:bg-red-500/20 disabled:opacity-50 transition"
                            title="Supprimer définitivement"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table mode */}
      {viewMode === "table" && (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-gray-950/60">
          <table className="w-full min-w-[1480px] text-xs text-gray-300">
            <thead className="bg-white/[0.04] text-gray-400">
              <tr>
                <th className="px-3 py-3 text-left whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisibleSelection}
                    disabled={loading || filteredSnippets.length === 0}
                    className="h-4 w-4 accent-yellow-400"
                    aria-label="Sélectionner tous les snippets visibles"
                  />
                </th>
                <SortableHeader label="Artiste" column="artistName" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
                <SortableHeader label="Chanson" column="songTitle" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
                <th className="px-3 py-3 text-left whitespace-nowrap">Snippet</th>
                <SortableHeader label="Diff." column="difficulty" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
                <SortableHeader label="Type" column="snippetType" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
                <SortableHeader label="Titre" column="containsTitle" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
                <th className="px-3 py-3 text-left whitespace-nowrap">Playlists</th>
                <SortableHeader label="Statut" column="status" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort} />
                <th className="px-3 py-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-gray-500">Chargement des snippets...</td>
                </tr>
              )}
              {!loading && filteredSnippets.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-gray-500">Aucun snippet trouvé avec ces filtres.</td>
                </tr>
              )}
              {!loading && filteredSnippets.map((snippet) => {
                const status = getSnippetStatus(snippet);
                const isRejected = status === "rejected";
                const isApproved = status === "approved";
                const isPending = status === "pending";
                const isCurrentLoading = actionLoadingId === snippet.id;

                return (
                  <tr
                    key={snippet.id}
                    className={[
                      "border-t border-white/10 transition",
                      selectedIds.has(snippet.id) ? "bg-yellow-400/[0.06]" : "hover:bg-white/[0.03]",
                    ].join(" ")}
                  >
                    <td className="px-3 py-3 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(snippet.id)}
                        onChange={() => toggleSnippetSelection(snippet.id)}
                        className="h-4 w-4 accent-yellow-400"
                        aria-label={`Sélectionner ${snippet.artistName} - ${snippet.songTitle}`}
                      />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap font-bold text-white">{snippet.artistName}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{snippet.songTitle}</td>
                    <td className="px-3 py-3 min-w-[280px] max-w-[400px]">
                      <p className="line-clamp-2 text-gray-300">{snippet.text}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-1 rounded-lg font-bold ${
                        Number(snippet.difficulty) <= 2 ? "bg-green-500/20 text-green-400"
                        : Number(snippet.difficulty) === 3 ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-red-500/20 text-red-400"
                      }`}>
                        {snippet.difficulty}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="bg-white/[0.06] text-gray-300 px-2 py-1 rounded-lg">
                        {snippet.snippetType ?? "other"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {snippet.containsTitle ? (
                        <span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded-lg font-bold">Oui</span>
                      ) : (
                        <span className="bg-white/[0.06] text-gray-400 px-2 py-1 rounded-lg">Non</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {(snippet.songPlaylists ?? []).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {(snippet.songPlaylists ?? []).map((p) => (
                            <span key={p} className="rounded-full bg-blue-500/15 border border-blue-500/25 px-2 py-0.5 text-[10px] font-bold text-blue-300">{p}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {isApproved && <span className="bg-green-500/15 text-green-300 border border-green-500/25 rounded-full px-3 py-1 text-xs font-bold">{getStatusLabel(status)}</span>}
                      {isPending && <span className="bg-yellow-500/15 text-yellow-300 border border-yellow-500/25 rounded-full px-3 py-1 text-xs font-bold">{getStatusLabel(status)}</span>}
                      {isRejected && <span className="bg-red-500/15 text-red-300 border border-red-500/25 rounded-full px-3 py-1 text-xs font-bold">{getStatusLabel(status)}</span>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => openEditModal(snippet)}
                          className="bg-white/[0.04] text-gray-300 border border-white/10 px-2.5 py-1.5 rounded-lg font-bold hover:bg-white/[0.08] hover:text-white transition text-xs">
                          Modifier
                        </button>
                        {!isApproved && (
                          <button onClick={() => approveSnippet(snippet.id)} disabled={isCurrentLoading}
                            className="bg-green-500/15 text-green-300 border border-green-500/25 px-2.5 py-1.5 rounded-lg font-bold hover:bg-green-500/25 disabled:opacity-50 transition text-xs">
                            Approuver
                          </button>
                        )}
                        <button onClick={() => openPlaylistModal(snippet)}
                          className="bg-blue-500/15 text-blue-300 border border-blue-500/25 px-2.5 py-1.5 rounded-lg font-bold hover:bg-blue-500/25 disabled:opacity-50 transition text-xs">
                          {(snippet.songPlaylists ?? []).length > 0 ? `Playlists (${(snippet.songPlaylists ?? []).length})` : "Playlists"}
                        </button>
                        {isRejected && (
                          <button onClick={() => restoreSnippetToPending(snippet.id)} disabled={isCurrentLoading}
                            className="bg-white/[0.04] text-gray-300 border border-white/10 px-2.5 py-1.5 rounded-lg font-bold hover:bg-white/[0.08] disabled:opacity-50 transition text-xs">
                            Restaurer
                          </button>
                        )}
                        <button onClick={() => deleteSnippetPermanently(snippet)} disabled={isCurrentLoading}
                          className="bg-red-950/60 text-red-200 border border-red-500/35 px-2.5 py-1.5 rounded-lg font-black hover:bg-red-500/25 disabled:opacity-50 transition text-xs">
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* E2E & tools */}
      <details className="group">
        <summary className="cursor-pointer list-none">
          <div className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition select-none">
            <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
            <span className="font-bold">Outils avancés (test E2E, previews audio)</span>
          </div>
        </summary>

        <div className="mt-4 flex flex-col gap-4">
          <div className="bg-gray-950/70 border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/20 flex flex-col gap-4">
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">Test end-to-end</h3>
              <p className="text-gray-500 text-sm mt-1">
                Le moteur a besoin d'au moins 5 snippets faciles, 5 snippets difficiles et 10 chansons uniques approuvées.
              </p>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="bg-black/30 rounded-2xl p-4 border border-white/10">
                <p className="text-gray-500 text-xs">Faciles approuvés</p>
                <p className={easyApprovedCount >= 5 ? "text-green-400 text-2xl font-black mt-1" : "text-red-400 text-2xl font-black mt-1"}>
                  {easyApprovedCount}/5
                </p>
              </div>
              <div className="bg-black/30 rounded-2xl p-4 border border-white/10">
                <p className="text-gray-500 text-xs">Difficiles approuvés</p>
                <p className={hardApprovedCount >= 5 ? "text-green-400 text-2xl font-black mt-1" : "text-red-400 text-2xl font-black mt-1"}>
                  {hardApprovedCount}/5
                </p>
              </div>
              <div className="bg-black/30 rounded-2xl p-4 border border-white/10">
                <p className="text-gray-500 text-xs">Chansons uniques</p>
                <p className={uniqueApprovedSongsCount >= 10 ? "text-green-400 text-2xl font-black mt-1" : "text-red-400 text-2xl font-black mt-1"}>
                  {uniqueApprovedSongsCount}/10
                </p>
              </div>
            </div>
            {!canGenerateGlobalGame && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-xs rounded-2xl p-3">
                Il manque encore du contenu approuvé pour générer une partie complète.
              </div>
            )}
            <button
              onClick={handleCreateTestGame}
              disabled={testGameLoading || !canGenerateGlobalGame}
              className="bg-yellow-400 text-black font-black rounded-2xl py-3 text-sm hover:bg-yellow-300 disabled:opacity-50 transition active:scale-95"
            >
              {testGameLoading ? "Création de la partie…" : "Créer une partie test"}
            </button>
          </div>

        </div>
      </details>

      {/* Edit modal */}
      {editingSnippet && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl bg-gray-950 border border-white/10 rounded-3xl shadow-2xl shadow-black/50 overflow-hidden">
            <div className="px-6 py-5 border-b border-white/10 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-yellow-400 font-black">Édition</p>
                <h3 className="text-2xl font-black text-white mt-1">Modifier le snippet</h3>
                <p className="text-gray-500 text-sm mt-1">
                  {editingSnippet.artistName} — {editingSnippet.songTitle}
                </p>
              </div>
              <button onClick={closeEditModal}
                className="bg-white/[0.04] text-gray-300 border border-white/10 rounded-xl px-3 py-2 font-bold hover:bg-white/[0.08] transition">
                ✕
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5">
              <label className="flex flex-col gap-2">
                <span className="text-gray-400 text-xs font-bold uppercase tracking-wide">Texte du snippet</span>
                <textarea
                  value={editForm.text}
                  onChange={(e) => setEditForm((prev) => prev ? { ...prev, text: e.target.value } : prev)}
                  rows={4}
                  className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10 resize-none"
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-gray-400 text-xs font-bold uppercase tracking-wide">Difficulté</span>
                  <select
                    value={editForm.difficulty}
                    onChange={(e) => setEditForm((prev) => prev ? { ...prev, difficulty: Number(e.target.value) } : prev)}
                    className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
                  >
                    <option value={1}>1 — Très facile</option>
                    <option value={2}>2 — Facile</option>
                    <option value={3}>3 — Moyen</option>
                    <option value={4}>4 — Difficile</option>
                    <option value={5}>5 — Très difficile</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-gray-400 text-xs font-bold uppercase tracking-wide">Type</span>
                  <select
                    value={editForm.snippetType}
                    onChange={(e) => setEditForm((prev) => prev ? { ...prev, snippetType: e.target.value } : prev)}
                    className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
                  >
                    <option value="chorus">Chorus</option>
                    <option value="verse">Verse</option>
                    <option value="bridge">Bridge</option>
                    <option value="intro">Intro</option>
                    <option value="outro">Outro</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-gray-400 text-xs font-bold uppercase tracking-wide">Licence</span>
                  <select
                    value={editForm.licenseStatus}
                    onChange={(e) => setEditForm((prev) => prev ? { ...prev, licenseStatus: e.target.value } : prev)}
                    className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
                  >
                    <option value="manual_mvp">manual_mvp</option>
                    <option value="approved">approved</option>
                    <option value="pending">pending</option>
                    <option value="removed">removed</option>
                  </select>
                </label>

                <div className="flex flex-col gap-3">
                  <span className="text-gray-400 text-xs font-bold uppercase tracking-wide">Options</span>
                  <label className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={editForm.containsTitle}
                      onChange={(e) => setEditForm((prev) => prev ? { ...prev, containsTitle: e.target.checked } : prev)}
                      className="accent-yellow-400" />
                    <span className="text-sm text-gray-300">Le snippet contient le titre</span>
                  </label>
                  <label className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={editForm.isApproved}
                      disabled={editForm.licenseStatus === "removed"}
                      onChange={(e) => setEditForm((prev) => prev ? { ...prev, isApproved: e.target.checked } : prev)}
                      className="accent-yellow-400" />
                    <span className="text-sm text-gray-300">Snippet approuvé</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 border-t border-white/10 flex flex-col md:flex-row gap-3 md:justify-end">
              <button onClick={closeEditModal} disabled={savingEdit}
                className="bg-white/[0.04] text-gray-300 border border-white/10 rounded-2xl px-5 py-3 text-sm font-bold hover:bg-white/[0.08] disabled:opacity-50 transition">
                Annuler
              </button>
              <button onClick={saveSnippetEdit} disabled={savingEdit}
                className="bg-yellow-400 text-black font-black rounded-2xl px-5 py-3 text-sm hover:bg-yellow-300 disabled:opacity-50 transition active:scale-95">
                {savingEdit ? "Sauvegarde…" : "Sauvegarder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Playlist assignment modal */}
      {playlistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-gray-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/10 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-blue-400 font-black">Playlists</p>
                <h3 className="text-xl font-black text-white mt-1">{playlistModal.snippet.songTitle}</h3>
                <p className="text-gray-500 text-sm">{playlistModal.snippet.artistName}</p>
              </div>
              <button onClick={() => setPlaylistModal(null)}
                className="bg-white/[0.04] text-gray-300 border border-white/10 rounded-xl px-3 py-2 font-bold hover:bg-white/[0.08] transition">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-3">
              {playlists.length === 0 && (
                <p className="text-sm text-gray-500">Aucune playlist disponible. Crée-en une dans l'onglet Playlists.</p>
              )}
              {playlists.map((pl) => {
                const isIn = playlistModal.selected.includes(pl.slug);
                return (
                  <label key={pl.slug} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/20 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition">
                    <input
                      type="checkbox"
                      checked={isIn}
                      onChange={() => setPlaylistModal((prev) => {
                        if (!prev) return prev;
                        const next = isIn
                          ? prev.selected.filter((s) => s !== pl.slug)
                          : [...prev.selected, pl.slug];
                        return { ...prev, selected: next };
                      })}
                      className="h-4 w-4 accent-yellow-400"
                    />
                    <span className="text-xl">{pl.emoji ?? "🎵"}</span>
                    <span className="flex-1 text-sm font-bold text-white">{pl.name}</span>
                    {isIn && <span className="text-xs font-black text-yellow-400">✓</span>}
                  </label>
                );
              })}
            </div>
            <div className="px-6 py-4 border-t border-white/10 flex gap-3 justify-end">
              <button onClick={() => setPlaylistModal(null)} disabled={playlistModalSaving}
                className="bg-white/[0.04] text-gray-300 border border-white/10 rounded-2xl px-5 py-2.5 text-sm font-bold hover:bg-white/[0.08] disabled:opacity-50 transition">
                Annuler
              </button>
              <button onClick={savePlaylistAssignment} disabled={playlistModalSaving}
                className="bg-yellow-400 text-black font-black rounded-2xl px-5 py-2.5 text-sm hover:bg-yellow-300 disabled:opacity-50 transition">
                {playlistModalSaving ? "Sauvegarde…" : "Sauvegarder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk playlist modal */}
      {bulkPlaylistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-gray-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/10 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-blue-400 font-black">Action groupée</p>
                <h3 className="text-xl font-black text-white mt-1">Ajouter à une playlist</h3>
                <p className="text-gray-500 text-sm">{selectedSnippets.length} snippet(s) sélectionné(s)</p>
              </div>
              <button onClick={() => { setBulkPlaylistModalOpen(false); setBulkPlaylistModal([]); }}
                className="bg-white/[0.04] text-gray-300 border border-white/10 rounded-xl px-3 py-2 font-bold hover:bg-white/[0.08] transition">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-3">
              {playlists.length === 0 && (
                <p className="text-sm text-gray-500">Aucune playlist disponible.</p>
              )}
              {playlists.map((pl) => {
                const isIn = bulkPlaylistModal.includes(pl.slug);
                return (
                  <label key={pl.slug} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/20 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition">
                    <input
                      type="checkbox"
                      checked={isIn}
                      onChange={() => setBulkPlaylistModal((prev) =>
                        isIn ? prev.filter((s) => s !== pl.slug) : [...prev, pl.slug]
                      )}
                      className="h-4 w-4 accent-yellow-400"
                    />
                    <span className="text-xl">{pl.emoji ?? "🎵"}</span>
                    <span className="flex-1 text-sm font-bold text-white">{pl.name}</span>
                  </label>
                );
              })}
            </div>
            <div className="px-6 py-4 border-t border-white/10 flex gap-3 justify-end">
              <button onClick={() => { setBulkPlaylistModalOpen(false); setBulkPlaylistModal([]); }} disabled={bulkLoading}
                className="bg-white/[0.04] text-gray-300 border border-white/10 rounded-2xl px-5 py-2.5 text-sm font-bold hover:bg-white/[0.08] disabled:opacity-50 transition">
                Annuler
              </button>
              <button onClick={saveBulkPlaylistAssignment} disabled={bulkLoading || bulkPlaylistModal.length === 0}
                className="bg-yellow-400 text-black font-black rounded-2xl px-5 py-2.5 text-sm hover:bg-yellow-300 disabled:opacity-50 transition">
                {bulkLoading ? "En cours…" : "Appliquer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
