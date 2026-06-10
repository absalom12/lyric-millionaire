function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // strip accents
    .replace(/\(.*?\)/g, "")          // remove (feat. xxx), (remix), (live), etc.
    .replace(/\[.*?\]/g, "")          // remove [deluxe], [explicit], etc.
    .replace(/\bfeat\..*$/i, "")      // remove trailing feat. …
    .replace(/\bft\..*$/i, "")
    .replace(/\bx\s+\w/i, "")        // remove "x ArtistName" collabs
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMatch(track: { title: string; artistName: string }, songTitle: string, artistName: string): number {
  const nt = normalize(track.title);
  const ns = normalize(songTitle);
  const na = normalize(track.artistName);
  const nArtist = normalize(artistName);

  let score = 0;
  if (nt === ns) score += 3;
  else if (nt.startsWith(ns) || ns.startsWith(nt)) score += 2;
  else if (nt.includes(ns) || ns.includes(nt)) score += 1;

  if (na === nArtist) score += 2;
  else if (na.includes(nArtist) || nArtist.includes(na)) score += 1;

  return score;
}

async function fetchDeezerPreview(
  songTitle: string,
  artistName: string
): Promise<string | null> {
  try {
    const q = encodeURIComponent(`${songTitle} ${artistName}`);
    const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=10`);
    if (!res.ok) return null;

    const data = await res.json();
    const tracks: any[] = (data.data ?? [])
      .filter((t: any) => t.preview)
      .map((t: any) => ({
        ...t,
        artistName: t.artist?.name ?? "",
        _score: scoreMatch({ title: t.title, artistName: t.artist?.name ?? "" }, songTitle, artistName),
      }))
      .filter((t: any) => t._score >= 2)   // must match at least title OR artist loosely + one more point
      .sort((a: any, b: any) => b._score - a._score);

    return tracks[0]?.preview ?? null;
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
    const tracks: any[] = (data.results ?? [])
      .filter((r: any) => r.kind === "song" && r.previewUrl)
      .map((r: any) => ({
        ...r,
        _score: scoreMatch({ title: r.trackName ?? "", artistName: r.artistName ?? "" }, songTitle, artistName),
      }))
      .filter((r: any) => r._score >= 2)
      .sort((a: any, b: any) => b._score - a._score);

    return tracks[0]?.previewUrl ?? null;
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
