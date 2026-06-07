import { TranslationDictionary } from "../../i18n/translations";
import SectionCard from "../ui/SectionCard";
import GameButton from "../ui/GameButton";
import { cn, getMutedText } from "../../theme/styles";

type ShareActionsProps = {
  sharingImage: boolean;
  sharingLink: boolean;
  restartingGame: boolean;
  message: string;
  isLight: boolean;
  t: TranslationDictionary;
  onShareImage: () => void;
  onShareLink: () => void;
  onPlayAgain: () => void;
};

export default function ShareActions({ sharingImage, sharingLink, restartingGame, message, isLight, t, onShareImage, onShareLink, onPlayAgain }: ShareActionsProps) {
  return (
    <SectionCard isLight={isLight} className="p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={cn("text-xs font-black uppercase tracking-[0.25em]", isLight ? "text-orange-700" : "text-yellow-400")}>{t.result.shareYourRun}</p>
          <p className={cn("mt-2 max-w-xl text-sm font-bold leading-6", getMutedText(isLight))}>{t.result.shareDescription}</p>
        </div>
        <span className={cn("w-fit rounded-full border px-3 py-2 text-xs font-black", isLight ? "border-orange-200 bg-orange-50 text-orange-700" : "border-white/10 bg-white/[0.04] text-yellow-300")}>Viral card</span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <GameButton isLight={isLight} onClick={onShareImage} disabled={sharingImage || sharingLink}>📸 {sharingImage ? t.common.creatingImage : t.common.shareImage}</GameButton>
        <GameButton isLight={isLight} variant="secondary" onClick={onShareLink} disabled={sharingImage || sharingLink}>🔗 {sharingLink ? t.common.sharingLink : t.common.shareLink}</GameButton>
        <GameButton isLight={isLight} variant="secondary" onClick={onPlayAgain} disabled={sharingImage || sharingLink || restartingGame}>🎮 {restartingGame ? "Starting…" : t.common.playAgain}</GameButton>
      </div>

      {message && <div className={cn("mt-4 rounded-2xl border p-3 text-sm font-bold", isLight ? "border-orange-200 bg-orange-50 text-orange-700" : "border-white/10 bg-white/[0.04] text-gray-300")}>{message}</div>}
    </SectionCard>
  );
}
