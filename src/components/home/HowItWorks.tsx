import { TranslationDictionary } from "../../i18n/translations";
import SectionCard from "../ui/SectionCard";
import { cn, getMutedText } from "../../theme/styles";

export default function HowItWorks({ t, isLight }: { t: TranslationDictionary; isLight: boolean }) {
  const steps = [
    ["1", "Read", t.home.badgeLyrics],
    ["2", "Choose", t.home.badgeChoices],
    ["3", "Survive", t.home.badgeJokers],
    ["4", "Cash out", t.home.badgeScore],
  ];

  return (
    <SectionCard isLight={isLight}>
      <p className={cn("text-xs font-black uppercase tracking-[0.25em]", isLight ? "text-orange-700" : "text-yellow-400")}>How it works</p>
      <div className="mt-4 space-y-3">
        {steps.map(([number, title, label]) => (
          <div key={number} className={cn("flex items-center gap-3 rounded-2xl border p-3", isLight ? "border-orange-100 bg-white/60" : "border-white/10 bg-white/[0.035]")}>
            <span className={cn("grid h-9 w-9 place-items-center rounded-xl text-xs font-black", isLight ? "bg-orange-100 text-orange-700" : "bg-yellow-400/10 text-yellow-300")}>{number}</span>
            <div>
              <p className="text-sm font-black">{title}</p>
              <p className={cn("text-xs font-bold", getMutedText(isLight))}>{label}</p>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
