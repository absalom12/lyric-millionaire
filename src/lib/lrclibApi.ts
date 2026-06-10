interface LrclibResponse {
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export async function fetchLyricsFromLrclib(
  trackName: string,
  artistName: string
): Promise<string | null> {
  try {
    const params = new URLSearchParams({ track_name: trackName, artist_name: artistName });
    const res = await fetch(`https://lrclib.net/api/get?${params}`);
    if (res.status === 404 || !res.ok) return null;
    const data: LrclibResponse = await res.json();
    if (data.instrumental) return null;
    if (data.plainLyrics?.trim()) return data.plainLyrics;
    if (data.syncedLyrics) {
      const plain = data.syncedLyrics
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
