import { useRef, useState } from "react";
import {
  runSnippetGeneration,
  GenerationReport,
  SongProcessResult,
} from "../../lib/snippetMaker";

type LogEntry = {
  id: number;
  type: "info" | "success" | "warning" | "error";
};

type LogEntryFull = LogEntry & { message: string };

const LOG_ICON: Record<LogEntry["type"], string> = {
  info: "·",
  success: "✓",
  warning: "⚠",
  error: "✗",
};

const LOG_COLOR: Record<LogEntry["type"], string> = {
  info: "text-gray-400",
  success: "text-green-400",
  warning: "text-yellow-400",
  error: "text-red-400",
};

function SummaryCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "green" | "yellow" | "red";
}) {
  const valueClass =
    tone === "green" ? "text-green-400" :
    tone === "yellow" ? "text-yellow-400" :
    tone === "red" ? "text-red-400" : "text-white";

  return (
    <div className="bg-gray-950/70 border border-white/10 rounded-2xl p-4">
      <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wide">{label}</p>
      <p className={`${valueClass} text-2xl font-black mt-1`}>{value}</p>
      {sub && <p className="text-gray-600 text-[10px] mt-1">{sub}</p>}
    </div>
  );
}

function SongRow({ song, index }: { song: SongProcessResult; index: number }) {
  return (
    <tr className="border-t border-white/10 hover:bg-white/[0.02] transition">
      <td className="px-4 py-2.5 text-gray-500 text-xs tabular-nums">{index + 1}</td>
      <td className="px-4 py-2.5 font-bold text-white text-xs">{song.title}</td>
      <td className="px-4 py-2.5 text-xs">
        {song.lyricsFound ? (
          <span className="text-green-400">✓ OK</span>
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-xs">
        {song.snippetsCreated > 0 ? (
          <span className="text-yellow-300 font-black">{song.snippetsCreated}</span>
        ) : (
          <span className="text-gray-600">0</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-xs">
        {song.alreadyExisted ? (
          <span className="bg-white/[0.06] text-gray-500 border border-white/10 rounded-full px-2 py-0.5 text-[10px] font-bold">Existant</span>
        ) : song.snippetsCreated > 0 ? (
          <span className="bg-green-500/15 text-green-300 border border-green-500/25 rounded-full px-2 py-0.5 text-[10px] font-bold">Créé</span>
        ) : song.error ? (
          <span className="bg-red-500/15 text-red-400 border border-red-500/25 rounded-full px-2 py-0.5 text-[10px] font-bold" title={song.error}>Erreur</span>
        ) : (
          <span className="bg-yellow-400/10 text-yellow-500 border border-yellow-400/20 rounded-full px-2 py-0.5 text-[10px] font-bold">Sans paroles</span>
        )}
      </td>
    </tr>
  );
}

export default function AdminSnippetGen() {
  const [artistQuery, setArtistQuery] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0, message: "" });
  const [logs, setLogs] = useState<LogEntryFull[]>([]);
  const [report, setReport] = useState<GenerationReport | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const logIdRef = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (type: LogEntry["type"], message: string) => {
    const id = ++logIdRef.current;
    setLogs(prev => [...prev, { id, type, message }]);
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
  };

  const handleRun = async () => {
    if (!artistQuery.trim() || isRunning) return;
    setIsRunning(true);
    setLogs([]);
    setReport(null);
    setFatalError(null);
    setCurrentStep("");
    setProgress({ current: 0, total: 0, message: "" });

    try {
      const result = await runSnippetGeneration(artistQuery.trim(), {
        onStep: setCurrentStep,
        onProgress: (current, total, message) => setProgress({ current, total, message }),
        onLog: addLog,
      });
      setReport(result);
      addLog("success", `Terminé en ${(result.durationMs / 1000).toFixed(1)}s — ${result.snippetsCreated} snippets créés.`);
    } catch (err) {
      setFatalError(String(err));
      addLog("error", String(err));
    } finally {
      setIsRunning(false);
      setCurrentStep("");
      setProgress({ current: 0, total: 0, message: "" });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-yellow-400 font-black">
          Génération automatique
        </p>
        <h2 className="text-3xl font-black tracking-tight mt-1">
          Snippets auto
        </h2>
        <p className="text-gray-500 text-sm mt-2 max-w-2xl">
          Entrez le nom d'un artiste pour générer automatiquement des snippets de paroles via{" "}
          <span className="text-gray-300 font-bold">lrclib.net</span>.
          Top 30 chansons + 20 aléatoires, 3 snippets par chanson avec difficultés variées,
          publiés avec <code className="text-yellow-300 bg-white/[0.05] px-1 rounded text-xs">isApproved: false</code> pour review dans l'onglet Snippets.
        </p>
      </div>

      {/* Input card */}
      <div className="bg-gray-950/70 border border-white/10 rounded-3xl p-6 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="artist-name"
            name="artist-name"
            type="text"
            value={artistQuery}
            onChange={e => setArtistQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleRun()}
            placeholder="Nom de l'artiste (ex : Booba, Taylor Swift, Drake…)"
            disabled={isRunning}
            className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-sm font-bold text-white placeholder-gray-600 focus:outline-none focus:border-yellow-400/40 focus:bg-black/60 transition disabled:opacity-50"
            autoComplete="off"
          />
          <button
            onClick={handleRun}
            disabled={isRunning || !artistQuery.trim()}
            className="shrink-0 bg-yellow-400 text-black font-black rounded-2xl px-8 py-3.5 text-sm hover:bg-yellow-300 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {isRunning ? "En cours…" : "Lancer"}
          </button>
        </div>

        {/* Progress */}
        {isRunning && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="h-3.5 w-3.5 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin shrink-0" />
              <span className="text-sm font-bold text-yellow-300">{currentStep}</span>
            </div>
            {progress.total > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="truncate max-w-[70%]">{progress.message}</span>
                  <span className="shrink-0 tabular-nums">{progress.current} / {progress.total}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-all duration-200"
                    style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fatal error */}
      {fatalError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-400 text-sm font-bold">
          {fatalError}
        </div>
      )}

      {/* Live log */}
      {logs.length > 0 && (
        <div className="bg-gray-950/70 border border-white/10 rounded-3xl p-5 flex flex-col gap-3">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-600">
            Journal d'exécution
          </p>
          <div className="max-h-72 overflow-y-auto font-mono text-xs space-y-0.5 pr-1">
            {logs.map(log => (
              <div key={log.id} className={`flex gap-2 ${LOG_COLOR[log.type]}`}>
                <span className="shrink-0 w-3">{LOG_ICON[log.type]}</span>
                <span className="break-words min-w-0">{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* Report */}
      {report && (
        <div className="flex flex-col gap-6">
          <p className="text-xs uppercase tracking-[0.3em] text-yellow-400 font-black -mb-2">
            Résumé
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <SummaryCard
              label="Artiste"
              value={report.artistName}
              sub={`${(report.deezerFans / 1000).toFixed(0)}K fans Deezer`}
            />
            <SummaryCard
              label="Chansons traitées"
              value={report.totalSongs}
              sub={`${report.topCount} top · ${report.randomCount} aléatoires`}
            />
            <SummaryCard
              label="Paroles trouvées"
              value={report.songsWithLyrics}
              sub="lrclib.net"
              tone="green"
            />
            <SummaryCard
              label="Sans paroles"
              value={report.songsWithoutLyrics}
              sub="introuvables / trop courtes"
              tone={report.songsWithoutLyrics > 0 ? "yellow" : "default"}
            />
            <SummaryCard
              label="Snippets créés"
              value={report.snippetsCreated}
              sub="isApproved: false"
              tone="green"
            />
            <SummaryCard
              label="Déjà existants"
              value={report.existingSongsSkipped}
              sub="ignorés (déjà en base)"
            />
          </div>

          {report.errors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-4 flex flex-col gap-1">
              <p className="text-red-400 text-xs font-black uppercase tracking-wide">
                {report.errors.length} erreur(s)
              </p>
              {report.errors.map((e, i) => (
                <p key={i} className="text-red-300 text-xs font-mono">{e}</p>
              ))}
            </div>
          )}

          <div className="bg-gray-950/70 border border-white/10 rounded-3xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-white">Détail par chanson</p>
              <p className="text-xs text-gray-600">{report.songs.length} chansons · {(report.durationMs / 1000).toFixed(1)}s</p>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
              <table className="w-full min-w-[560px] text-xs text-gray-300">
                <thead className="bg-white/[0.04] text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left w-8">#</th>
                    <th className="px-4 py-3 text-left">Chanson</th>
                    <th className="px-4 py-3 text-left">Paroles</th>
                    <th className="px-4 py-3 text-left">Snippets</th>
                    <th className="px-4 py-3 text-left">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {report.songs.map((song, i) => (
                    <SongRow key={`${song.title}-${i}`} song={song} index={i} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
