const BASE = "https://api.genius.com";

export interface GeniusSong {
  id: number;
  title: string;
  artist_names: string;
  primary_artist: { id: number; name: string };
  release_date_for_display?: string;
  header_image_thumbnail_url?: string;
}

async function geniusGet(path: string, token: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Genius API ${res.status}`);
  return res.json();
}

export async function searchArtistSongs(
  artistName: string,
  token: string
): Promise<GeniusSong[]> {
  const searchData = await geniusGet(
    `/search?q=${encodeURIComponent(artistName)}`,
    token
  );

  const hits: any[] = searchData.response?.hits ?? [];
  if (!hits.length) return [];

  // Find the first hit whose primary artist matches the query
  const artistHit = hits.find((h) =>
    h.result?.primary_artist?.name
      ?.toLowerCase()
      .includes(artistName.toLowerCase())
  );

  const artistId: number | undefined =
    artistHit?.result?.primary_artist?.id ??
    hits[0]?.result?.primary_artist?.id;

  if (!artistId) {
    return hits.slice(0, 20).map((h) => h.result) as GeniusSong[];
  }

  const songsData = await geniusGet(
    `/artists/${artistId}/songs?per_page=30&sort=popularity`,
    token
  );

  return (songsData.response?.songs ?? []) as GeniusSong[];
}
