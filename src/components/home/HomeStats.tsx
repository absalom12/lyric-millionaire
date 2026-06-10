import { TranslationDictionary } from "../../i18n/translations";
import { cn } from "../../theme/styles";

export default function HomeStats({ t, isLight }: { t: TranslationDictionary; isLight: boolean }) {
  const stats = [
    ["🎵", t.home.badgeLyrics],
    ["🎯", t.home.badgeChoices],
    ["💸", t.home.badgeScore],
    ["🏆", t.common.musicQuiz],
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map(([icon, stat]) => (
        <div key={stat} className={cn("relative overflow-hidden rounded-2xl border p-4 text-center text-sm font-black shadow-xl backdrop-blur-xl", isLight ? "border-orange-100 bg-white/75 shadow-orange-100/70" : "border-white/10 bg-white/[0.045] shadow-black/30")}>
          <div className={cn("absolute -right-5 -top-5 h-16 w-16 rounded-full blur-xl", isLight ? "bg-orange-200/50" : "bg-yellow-400/10")} />
          <div className="relative text-2xl">{icon}</div>
          <div className="relative mt-2">{stat}</div>
        </div>
      ))}
    </div>
  );
}
