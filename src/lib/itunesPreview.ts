function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // strip accents (é→e, à→a, etc.)
    .replace(/\(.*?\)/g, "")           // remove (feat. SCH), (Bande Originale), etc.
    .replace(/\[.*?\]/g, "")           // remove [Explicit], [Deluxe], etc.
    .replace(/\bfeat\..*$/i, "")       // remove feat. … at end
    .replace(/\bft\..*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isExactMatch(
  trackTitle: string,
  trackArtist: string,
  songTitle: string,
  artistName: string
): boolean {
  const nt = normalize(trackTitle);
  const ns = normalize(songTitle);
  const na = normalize(trackArtist);
  const nArtist = normalize(artistName);

  // Title: exact OR track title starts with our title (handles "Validé (feat. SCH)" → "Validé")
  const titleMatch = nt === ns || nt.startsWith(ns + " ") || nt.startsWith(ns + "(");

  // Artist: exact OR one contains the other (handles "Booba" in "Booba feat. SCH")
  const artistMatch = na === nArtist || na.includes(nArtist) || nArtist.includes(na);

  return titleMatch && artistMatch;
}

async function fetchDeezerPreview(
  songTitle: string,
  artistName: string
): Promise<string | null> {
  try {
    // Field search is much more precise than free text
    const q = encodeURIComponent(`artist:"${artistName}" track:"${songTitle}"`);
    const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=10`);
    if (!res.ok) return null;

    const data = await res.json();
    const tracks: any[] = (data.data ?? []).filter((t: any) => t.preview);

    const match = tracks.find((t) =>
      isExactMatch(t.title, t.artist?.name ?? "", songTitle, artistName)
    );

    return match?.preview ?? null; // null if no exact match — never return a wrong song
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
      `https://itunes.apple.com/search?term=${term}&entity=song&limit=10`
    );
    if (!res.ok) return null;

    const data = await res.json();
    const tracks: any[] = (data.results ?? []).filter(
      (r: any) => r.kind === "song" && r.previewUrl
    );

    const match = tracks.find((r) =>
      isExactMatch(r.trackName ?? "", r.artistName ?? "", songTitle, artistName)
    );

    return match?.previewUrl ?? null;
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
