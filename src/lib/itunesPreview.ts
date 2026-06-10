function normalize(s: string): string {
  return s.toLowerCase().trim();
}

async function fetchDeezerPreview(
  songTitle: string,
  artistName: string
): Promise<string | null> {
  try {
    const q = encodeURIComponent(`"${songTitle}" "${artistName}"`);
    const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=5`);
    if (!res.ok) return null;

    const data = await res.json();
    const tracks: any[] = (data.data ?? []).filter((t: any) => t.preview);
    if (!tracks.length) return null;

    const exact = tracks.find(
      (t) =>
        normalize(t.title) === normalize(songTitle) &&
        normalize(t.artist?.name ?? "").includes(normalize(artistName))
    );

    return (exact ?? tracks[0]).preview ?? null;
  } catch {
    return null;
  }
}

async function fetchItunesPreview(
  songTitle: string,
  artistName: string
): Promise<string | null> {
  try {
    const term = encodeURIComponent(`${songTitle} ${artistName}`);
    const res = await fetch(
      `https://itunes.apple.com/search?term=${term}&entity=song&limit=5`
    );
    if (!res.ok) return null;

    const data = await res.json();
    const tracks: any[] = (data.results ?? []).filter(
      (r: any) => r.kind === "song" && r.previewUrl
    );
    if (!tracks.length) return null;

    const exact = tracks.find(
      (t) =>
        normalize(t.trackName ?? "") === normalize(songTitle) &&
        normalize(t.artistName ?? "").includes(normalize(artistName))
    );

    return (exact ?? tracks[0]).previewUrl ?? null;
  } catch {
    return null;
  }
}

// Deezer first (better coverage, especially French music), iTunes as fallback
export async function fetchPreviewUrl(
  songTitle: string,
  artistName: string
): Promise<string | null> {
  const deezer = await fetchDeezerPreview(songTitle, artistName);
  if (deezer) return deezer;
  return fetchItunesPreview(songTitle, artistName);
}

// Keep old export name so nothing else needs to change
export { fetchPreviewUrl as fetchItunesPreview };
