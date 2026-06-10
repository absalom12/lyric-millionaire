import { Timestamp } from "firebase/firestore";

export interface Artist {
  id?: string;
  name: string;
  country?: string;
  genre?: string;
  imageUrl?: string;
  coverUrl?: string;
  backgroundUrl?: string;
  spotifyId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Song {
  id?: string;
  title: string;
  artistId: string;
  artistName: string;
  album?: string;
  releaseYear?: number;
  language?: string;
  genre?: string;
  country?: string;
  coverUrl?: string;
  previewUrl?: string;
  spotifyId?: string;
  isrc?: string;
  spotifyPopularity?: number;
  spotifyStreams?: number;
  isGlobalHit: boolean;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type SnippetType = "chorus" | "verse" | "bridge" | "intro" | "outro" | "other";
export type LicenseStatus = "manual_mvp" | "licensed" | "unknown" | "removed";

export interface Snippet {
  id?: string;
  songId: string;
  songTitle: string;
  artistId: string;
  artistName: string;
  text: string;
  snippetType?: SnippetType;
  difficulty: number;
  containsTitle: boolean;
  isApproved: boolean;
  licenseStatus: LicenseStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type GameModeSlug = "global-hits" | "artist-of-the-day";

export interface GameMode {
  id?: string;
  slug: GameModeSlug;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface DailyArtist {
  date: string;
  artistId: string;
  artistName: string;
  coverUrl?: string;
  artistCoverUrl?: string;
  backgroundUrl?: string;
  imageUrl?: string;
  generatedAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface QuestionAnswer {
  songId: string;
  title: string;
  artistName: string;
}

export interface GameQuestion {
  snippetId: string;
  snippetText: string;
  correctSongId: string;
  correctTitle: string;
  correctArtist: string;
  releaseYear?: number;
  difficulty?: number;
  spotifyStreams?: number;
  previewUrl?: string | null;
  answers: QuestionAnswer[];
  selectedSongId?: string;
  isCorrect?: boolean;
}

export type GameStatus = "in_progress" | "won" | "lost";

export interface GameRun {
  id?: string;
  modeSlug: GameModeSlug;
  status: GameStatus;
  score: number;
  currentQuestionIndex: number;
  questions: GameQuestion[];
  startedAt: Timestamp;
  endedAt?: Timestamp;
  totalTimeMs?: number;

  language?: "en" | "fr" | "pt" | "es";
  theme?: "dark" | "light";
  playMode?: "lyrics" | "blindtest";
  moneyReached?: number;
  completedQuestionCount?: number;
  lostAtQuestionIndex?: number | null;
  shareClicks?: number;
}

export interface ExcelRow {
  artist_name: string;
  song_title: string;
  release_year: number;
  snippet_text: string;
  difficulty: number;
  album?: string;
  genre?: string;
  language?: string;
  country?: string;
  spotify_streams?: number;
  spotify_popularity?: number;
  is_global_hit?: boolean;
  snippet_type?: SnippetType;
  contains_title?: boolean;
}

export interface ImportReport {
  artistsCreated: number;
  songsCreated: number;
  songsUpdated: number;
  snippetsCreated: number;
  rowsSkipped: number;
  errors: string[];
}