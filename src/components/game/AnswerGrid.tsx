import { GameQuestion } from "../../types";
import { cn } from "../../theme/styles";

 type AnswerGridProps = {
  question: GameQuestion;
  answering: boolean;
  isLight: boolean;
  onAnswer: (songId: string) => void;
};

export default function AnswerGrid({ question, answering, isLight, onAnswer }: AnswerGridProps) {
  const getAnswerStyle = (songId: string) => {
    if (!question.selectedSongId) {
      return isLight
        ? "border-orange-100 bg-white/90 text-slate-900 hover:border-orange-300 hover:bg-orange-50"
        : "border-white/10 bg-white/[0.055] text-white hover:bg-white/[0.09]";
    }
    if (songId === question.correctSongId) return "border-green-400/60 bg-green-500/20 text-green-100";
    if (songId === question.selectedSongId) return "border-red-400/60 bg-red-500/20 text-red-100";
    return isLight ? "border-orange-100 bg-white/50 text-slate-300 opacity-60" : "border-white/10 bg-white/[0.02] text-gray-600 opacity-60";
  };

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
      {question.answers.map((answer, index) => (
        <button
          key={answer.songId}
          onClick={() => onAnswer(answer.songId)}
          disabled={!!question.selectedSongId || answering}
          className={cn(
            "group min-h-[82px] rounded-2xl border px-3 py-3 text-left shadow-lg shadow-black/10 transition active:scale-[0.98] disabled:cursor-not-allowed sm:min-h-[96px] sm:px-4 sm:py-4",
            getAnswerStyle(answer.songId)
          )}
        >
          <div className="flex h-full items-start gap-2.5 sm:items-center sm:gap-4">
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black sm:h-11 sm:w-11 sm:text-sm", isLight ? "bg-orange-50 text-orange-700" : "bg-black/35 text-yellow-400")}>
              {String.fromCharCode(65 + index)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-black leading-tight sm:text-lg">{answer.title}</p>
              <p className={cn("mt-1 truncate text-xs font-bold sm:text-sm", isLight ? "text-slate-500" : "text-gray-400")}>{answer.artistName}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
