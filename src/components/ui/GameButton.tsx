import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn, getPrimaryButtonStyle, getSecondaryButtonStyle } from "../../theme/styles";

type GameButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLight: boolean;
  variant?: "primary" | "secondary" | "danger";
  children: ReactNode;
};

export default function GameButton({ isLight, variant = "primary", className, children, ...props }: GameButtonProps) {
  const variantClass =
    variant === "danger"
      ? "border-red-400 bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-red-500/25 hover:from-red-400 hover:to-rose-400"
      : variant === "secondary"
      ? getSecondaryButtonStyle(isLight)
      : getPrimaryButtonStyle(isLight);

  return (
    <button
      {...props}
      className={cn(
        "group relative overflow-hidden rounded-2xl border px-5 py-3 text-sm font-black shadow-xl transition duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0",
        variantClass,
        className
      )}
    >
      <span className="pointer-events-none absolute inset-y-0 -left-16 w-12 rotate-12 bg-white/25 blur-sm transition duration-700 group-hover:left-[120%]" />
      <span className="relative z-10 inline-flex items-center justify-center gap-2">{children}</span>
    </button>
  );
}
