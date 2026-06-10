export async function fetchLyrics(
  artist: string,
  title: string
): Promise<string | null> {
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const lyrics = typeof data.lyrics === "string" ? data.lyrics.trim() : "";
    return lyrics || null;
  } catch {
    return null;
  }
}
