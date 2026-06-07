import { cn } from "../../theme/styles";
import { displayFontClass } from "../../theme/fonts";

type BrandLogoProps = {
  brand: string;
  subtitle?: string;
  isLight: boolean;
  onClick?: () => void;
};

export default function BrandLogo({ brand, subtitle, isLight, onClick }: BrandLogoProps) {
  const content = (
    <>
      <img
        src="/logo-mark.png"
        alt=""
        aria-hidden="true"
        className={cn(
          "h-12 w-12 shrink-0 object-contain transition sm:h-14 sm:w-14",
          isLight
            ? "drop-shadow-[0_12px_22px_rgba(249,115,22,0.25)]"
            : "drop-shadow-[0_12px_26px_rgba(250,204,21,0.22)]"
        )}
      />

      <div className="min-w-0 leading-none">
        <p
          className={cn(
            "whitespace-nowrap text-base font-black tracking-[0.18em] sm:text-lg",
            displayFontClass,
            isLight
              ? "bg-gradient-to-r from-slate-950 via-orange-700 to-yellow-600 bg-clip-text text-transparent"
              : "bg-gradient-to-r from-white via-yellow-200 to-yellow-500 bg-clip-text text-transparent"
          )}
        >
          {brand || "Lyric Millionaire"}
        </p>
        {subtitle && (
          <p
            className={cn(
              "mt-1 hidden text-[10px] font-extrabold uppercase tracking-[0.24em] sm:block",
              isLight ? "text-orange-700/70" : "text-yellow-300/65"
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
    </>
  );

  if (!onClick) {
    return <div className="flex items-center gap-3">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Go to home page"
      className="flex items-center gap-3 rounded-2xl transition hover:scale-[1.02] active:scale-[0.98]"
    >
      {content}
    </button>
  );
}
