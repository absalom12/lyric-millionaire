interface ItunesResult {
  kind?: string;
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
}

interface ItunesResponse {
  resultCount: number;
  results: ItunesResult[];
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

export async function fetchItunesPreview(
  songTitle: string,
  artistName: string
): Promise<string | null> {
  try {
    const term = encodeURIComponent(`${songTitle} ${artistName}`);
    const res = await fetch(
      `https://itunes.apple.com/search?term=${term}&entity=song&limit=5`
    );
    if (!res.ok) return null;

    const data: ItunesResponse = await res.json();
    const tracks = data.results.filter((r) => r.kind === "song" && r.previewUrl);
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
