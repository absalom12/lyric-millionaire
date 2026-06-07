import { useState } from "react";
import { parseImportFile, importRows } from "../../lib/excelImport";
import { ExcelRow } from "../../types/index";

type RowStatus = {
  row: ExcelRow;
  index: number;
};

export default function AdminImport() {
  const [validRows, setValidRows] = useState<RowStatus[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string>("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setFileName(file.name);
    setReport(null);
    setErrors([]);
    setValidRows([]);

    try {
      const result = await parseImportFile(file);

      setValidRows(
        result.rows.map((row, i) => ({
          row,
          index: i + 2,
        }))
      );

      setErrors(result.errors);
    } catch (err) {
      setErrors([`Erreur lecture fichier : ${String(err)}`]);
    }
  };

  const handleImport = async () => {
    if (!validRows.length) return;

    setLoading(true);
    setReport(null);
    setErrors([]);
    setProgress(null);

    try {
      const result = await importRows(
        validRows.map((r) => r.row),
        (current, total) => setProgress({ current, total })
      );

      setReport(
        `✅ Import terminé — ` +
          `${result.artistsCreated} artiste(s) créé(s), ` +
          `${result.songsCreated} chanson(s) créée(s), ` +
          `${result.songsUpdated} chanson(s) mise(s) à jour, ` +
          `${result.snippetsCreated} snippet(s) créé(s), ` +
          `${result.rowsSkipped} ligne(s) ignorée(s).`
      );

      if (result.errors.length) {
        setErrors((prev) => [...prev, ...result.errors]);
      }
    } catch (err) {
      setErrors([String(err)]);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-yellow-400">
          Import catalogue
        </h2>

        <p className="text-gray-500 text-xs mt-1">
          Importe des artistes, chansons et snippets depuis un fichier .xlsx, .xls ou .csv.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-400">
        <p className="font-bold text-gray-300 mb-2">
          Colonnes attendues :
        </p>

        <p className="leading-6">
          artist_name, song_title, release_year, snippet_text, difficulty,
          album, genre, language, country, spotify_streams, spotify_popularity,
          is_global_hit, snippet_type, contains_title
        </p>
      </div>

      <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-xl p-6 cursor-pointer hover:border-yellow-400 transition">
        <span className="text-gray-400 text-sm">
          Glisse ton fichier ici
        </span>

        <span className="text-gray-600 text-xs mt-1">
          Formats acceptés : .xlsx, .xls, .csv
        </span>

        {fileName && (
          <span className="text-yellow-400 text-xs mt-3">
            Fichier sélectionné : {fileName}
          </span>
        )}

        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFile}
          className="hidden"
        />
      </label>

      {validRows.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-green-400 text-sm font-medium">
            {validRows.length} ligne(s) valide(s) prête(s) à importer
          </p>

          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-xs text-gray-300">
              <thead className="bg-gray-800 text-gray-400">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Artiste</th>
                  <th className="px-2 py-2 text-left">Chanson</th>
                  <th className="px-2 py-2 text-left">Année</th>
                  <th className="px-2 py-2 text-left">Diff.</th>
                  <th className="px-2 py-2 text-left">Global</th>
                  <th className="px-2 py-2 text-left">Type</th>
                </tr>
              </thead>

              <tbody>
                {validRows.map(({ row, index }) => (
                  <tr key={index} className="border-t border-gray-800">
                    <td className="px-2 py-2 text-gray-500">
                      {index}
                    </td>

                    <td className="px-2 py-2">
                      {row.artist_name}
                    </td>

                    <td className="px-2 py-2">
                      {row.song_title}
                    </td>

                    <td className="px-2 py-2">
                      {row.release_year}
                    </td>

                    <td className="px-2 py-2">
                      {row.difficulty}
                    </td>

                    <td className="px-2 py-2">
                      {row.is_global_hit ? "✅" : "—"}
                    </td>

                    <td className="px-2 py-2">
                      {row.snippet_type ?? "other"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {progress && (
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="bg-yellow-400 h-2 rounded-full transition-all"
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                }}
              />
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={loading}
            className="bg-yellow-400 text-black font-bold rounded-lg py-3 text-sm hover:bg-yellow-300 disabled:opacity-50 transition"
          >
            {loading
              ? `Import en cours… (${progress?.current ?? 0}/${progress?.total ?? 0})`
              : `Lancer l'import (${validRows.length} lignes)`}
          </button>
        </div>
      )}

      {report && (
        <div className="bg-green-500/20 border border-green-500 text-green-400 text-sm rounded-lg p-3">
          {report}
        </div>
      )}

      {errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex flex-col gap-1">
          <p className="text-red-400 text-sm font-medium">
            {errors.length} erreur(s)
          </p>

          {errors.map((e, i) => (
            <p key={i} className="text-red-300 text-xs">
              {e}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}