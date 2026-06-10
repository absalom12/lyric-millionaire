const BASE = "https://api.genius.com";

export interface GeniusSong {
  id: number;
  title: string;
  artist_names: string;
  primary_artist: { id: number; name: string };
  release_date_for_display?: string;
  header_image_thumbnail_url?: string;
  isDeepCut: boolean;
}

async function geniusGet(path: string, token: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Genius API ${res.status}`);
  return res.json();
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
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

  const artistHit = hits.find((h) =>
    h.result?.primary_artist?.name
      ?.toLowerCase()
      .includes(artistName.toLowerCase())
  );

  const artistId: number | undefined =
    artistHit?.result?.primary_artist?.id ??
    hits[0]?.result?.primary_artist?.id;

  if (!artistId) {
    return hits.slice(0, 20).map((h) => ({ ...h.result, isDeepCut: false })) as GeniusSong[];
  }

  // Fetch 50 songs sorted by popularity
  const songsData = await geniusGet(
    `/artists/${artistId}/songs?per_page=50&sort=popularity`,
    token
  );

  const all: any[] = songsData.response?.songs ?? [];

  // First 30 = popular hits
  const popular: GeniusSong[] = all
    .slice(0, 30)
    .map((s) => ({ ...s, isDeepCut: false }));

  // Remaining shuffled → take up to 20 as deep cuts
  const deepCuts: GeniusSong[] = shuffle(all.slice(30))
    .slice(0, 20)
    .map((s) => ({ ...s, isDeepCut: true }));

  return [...popular, ...deepCuts];
}
