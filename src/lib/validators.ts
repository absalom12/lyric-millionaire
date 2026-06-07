import { ExcelRow, SnippetType } from "../types/index";

const VALID_SNIPPET_TYPES: SnippetType[] = [
  "chorus", "verse", "bridge", "intro", "outro", "other"
];

const currentYear = new Date().getFullYear();

export function validateExcelRow(row: Record<string, unknown>, index: number): {
  valid: boolean;
  data?: ExcelRow;
  error?: string;
} {
  const artist_name = String(row["artist_name"] ?? "").trim();
  const song_title = String(row["song_title"] ?? "").trim();
  const snippet_text = String(row["snippet_text"] ?? "").trim();
  const release_year = Number(row["release_year"]);
  const difficulty = Number(row["difficulty"]);

  if (!artist_name) return { valid: false, error: `Ligne ${index}: artist_name manquant` };
  if (!song_title) return { valid: false, error: `Ligne ${index}: song_title manquant` };
  if (!snippet_text) return { valid: false, error: `Ligne ${index}: snippet_text manquant` };
  if (isNaN(release_year) || release_year < 1900 || release_year > currentYear)
    return { valid: false, error: `Ligne ${index}: release_year invalide (${row["release_year"]})` };
  if (isNaN(difficulty) || difficulty < 1 || difficulty > 5)
    return { valid: false, error: `Ligne ${index}: difficulty invalide (${row["difficulty"]})` };

  const rawSnippetType = String(row["snippet_type"] ?? "").trim().toLowerCase();
  const snippet_type: SnippetType = VALID_SNIPPET_TYPES.includes(rawSnippetType as SnippetType)
    ? (rawSnippetType as SnippetType)
    : "other";

  const parseBool = (val: unknown): boolean => {
    if (typeof val === "boolean") return val;
    if (val === 1 || val === "1" || String(val).toUpperCase() === "TRUE") return true;
    return false;
  };

  return {
    valid: true,
    data: {
      artist_name,
      song_title,
      release_year,
      snippet_text,
      difficulty,
      album: String(row["album"] ?? "").trim() || undefined,
      genre: String(row["genre"] ?? "").trim() || undefined,
      language: String(row["language"] ?? "").trim() || undefined,
      country: String(row["country"] ?? "").trim() || undefined,
      spotify_streams: row["spotify_streams"] ? Number(row["spotify_streams"]) : undefined,
      spotify_popularity: row["spotify_popularity"] ? Number(row["spotify_popularity"]) : undefined,
      is_global_hit: parseBool(row["is_global_hit"]),
      snippet_type,
      contains_title: parseBool(row["contains_title"]),
    },
  };
}