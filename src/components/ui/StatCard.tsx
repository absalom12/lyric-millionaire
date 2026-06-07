import { ReactNode } from "react";
import { cn, getMutedText } from "../../theme/styles";

type StatCardProps = {
  label: string;
  value: ReactNode;
  isLight: boolean;
};

export default function StatCard({ label, value, isLight }: StatCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 shadow-lg backdrop-blur-xl",
        isLight ? "border-orange-100 bg-white/75 shadow-orange-100/70" : "border-white/10 bg-white/[0.045] shadow-black/30"
      )}
    >
      <div className={cn("absolute -right-5 -top-5 h-16 w-16 rounded-full blur-xl", isLight ? "bg-orange-200/50" : "bg-yellow-400/10")} />
      <p className={cn("relative text-[10px] font-black uppercase tracking-[0.2em]", getMutedText(isLight))}>{label}</p>
      <p className="relative mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}
