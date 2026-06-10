import * as XLSX from "xlsx";
import { ExcelRow, ImportReport } from "../types/index";
import { validateExcelRow } from "./validators";
import { db, serverTimestamp } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  addDoc,
} from "firebase/firestore";
import { fetchItunesPreview } from "./itunesPreview";

type ParsedImportResult = {
  rows: ExcelRow[];
  errors: string[];
};

function getFileExtension(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function parseWorksheetToRows(sheet: XLSX.WorkSheet): ParsedImportResult {
  const raw = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
  });

  const rows: ExcelRow[] = [];
  const errors: string[] = [];

  raw.forEach((row, i) => {
    const result = validateExcelRow(row as Record<string, unknown>, i + 2);

    if (result.valid && result.data) {
      rows.push(result.data);
    } else if (result.error) {
      errors.push(result.error);
    }
  });

  return { rows, errors };
}

function parseSpreadsheetFile(file: File): Promise<ParsedImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);

        const workbook = XLSX.read(data, {
          type: "array",
        });

        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
          resolve({
            rows: [],
            errors: ["Aucune feuille trouvée dans le fichier."],
          });
          return;
        }

        const sheet = workbook.Sheets[firstSheetName];
        resolve(parseWorksheetToRows(sheet));
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error("Impossible de lire le fichier."));
    };

    reader.readAsArrayBuffer(file);
  });
}

function parseCsvFile(file: File): Promise<ParsedImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = String(e.target?.result ?? "");

        const workbook = XLSX.read(text, {
          type: "string",
          raw: false,
        });

        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
          resolve({
            rows: [],
            errors: ["Aucune donnée trouvée dans le fichier CSV."],
          });
          return;
        }

        const sheet = workbook.Sheets[firstSheetName];
        resolve(parseWorksheetToRows(sheet));
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error("Impossible de lire le fichier CSV."));
    };

    reader.readAsText(file, "UTF-8");
  });
}

export async function parseImportFile(file: File): Promise<ParsedImportResult> {
  const extension = getFileExtension(file);

  if (extension === "csv") {
    return parseCsvFile(file);
  }

  if (extension === "xlsx" || extension === "xls") {
    return parseSpreadsheetFile(file);
  }

  return {
    rows: [],
    errors: [
      `Format non supporté : .${extension || "inconnu"}. Utilise un fichier .xlsx, .xls ou .csv.`,
    ],
  };
}

/**
 * Alias conservé pour ne pas casser les anciens composants.
 */
export function parseExcelFile(file: File): Promise<ParsedImportResult> {
  return parseImportFile(file);
}

async function findArtistId(name: string): Promise<string | null> {
  const q = query(
    collection(db, "artists"),
    where("nameLower", "==", name.toLowerCase())
  );

  const snap = await getDocs(q);

  return snap.empty ? null : snap.docs[0].id;
}

async function findSongId(
  artistId: string,
  title: string
): Promise<string | null> {
  const q = query(
    collection(db, "songs"),
    where("artistId", "==", artistId),
    where("titleLower", "==", title.toLowerCase())
  );

  const snap = await getDocs(q);

  return snap.empty ? null : snap.docs[0].id;
}

async function snippetExists(songId: string, text: string): Promise<boolean> {
  const q = query(
    collection(db, "snippets"),
    where("songId", "==", songId),
    where("textLower", "==", text.toLowerCase())
  );

  const snap = await getDocs(q);

  return !snap.empty;
}

export async function importRows(
  rows: ExcelRow[],
  onProgress?: (current: number, total: number) => void
): Promise<ImportReport> {
  const report: ImportReport = {
    artistsCreated: 0,
    songsCreated: 0,
    songsUpdated: 0,
    snippetsCreated: 0,
    rowsSkipped: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    onProgress?.(i + 1, rows.length);

    try {
      let artistId = await findArtistId(row.artist_name);

      if (!artistId) {
        const ref = await addDoc(collection(db, "artists"), {
          name: row.artist_name,
          nameLower: row.artist_name.toLowerCase(),
          genre: row.genre ?? null,
          country: row.country ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        artistId = ref.id;
        report.artistsCreated++;
      }

      let songId = await findSongId(artistId, row.song_title);

      if (!songId) {
        const previewUrl = await fetchItunesPreview(row.song_title, row.artist_name);

        const ref = await addDoc(collection(db, "songs"), {
          title: row.song_title,
          titleLower: row.song_title.toLowerCase(),
          artistId,
          artistName: row.artist_name,
          album: row.album ?? null,
          releaseYear: row.release_year,
          language: row.language ?? null,
          genre: row.genre ?? null,
          country: row.country ?? null,
          spotifyStreams: row.spotify_streams ?? null,
          spotifyPopularity: row.spotify_popularity ?? null,
          isGlobalHit: row.is_global_hit ?? false,
          isActive: true,
          previewUrl: previewUrl ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        songId = ref.id;
        report.songsCreated++;
      } else {
        await setDoc(
          doc(db, "songs", songId),
          {
            isGlobalHit: row.is_global_hit ?? false,
            spotifyStreams: row.spotify_streams ?? null,
            spotifyPopularity: row.spotify_popularity ?? null,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        report.songsUpdated++;
      }

      const exists = await snippetExists(songId, row.snippet_text);

      if (exists) {
        report.rowsSkipped++;
        continue;
      }

      await addDoc(collection(db, "snippets"), {
        songId,
        songTitle: row.song_title,
        artistId,
        artistName: row.artist_name,
        text: row.snippet_text,
        textLower: row.snippet_text.toLowerCase(),
        snippetType: row.snippet_type ?? "other",
        difficulty: row.difficulty,
        containsTitle: row.contains_title ?? false,
        isApproved: false,
        licenseStatus: "manual_mvp",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      report.snippetsCreated++;
    } catch (err) {
      report.errors.push(`Ligne ${i + 2}: ${String(err)}`);
      report.rowsSkipped++;
    }
  }

  return report;
}