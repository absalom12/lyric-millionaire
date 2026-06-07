import { ReactNode } from "react";
import { cn, getCardStyle } from "../../theme/styles";

type SectionCardProps = {
  isLight: boolean;
  children: ReactNode;
  className?: string;
};

export default function SectionCard({ isLight, children, className }: SectionCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] border p-5 shadow-2xl backdrop-blur-xl",
        getCardStyle(isLight),
        className
      )}
    >
      <div className={cn("pointer-events-none absolute inset-x-6 top-0 h-px", isLight ? "bg-orange-300/70" : "bg-yellow-300/30")} />
      {children}
    </div>
  );
}
