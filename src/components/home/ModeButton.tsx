import { cn, getPrimaryButtonStyle, getSecondaryButtonStyle, getMutedText } from "../../theme/styles";
import { displayFontClass } from "../../theme/fonts";

type ModeButtonProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: string;
  isLight: boolean;
  isPrimary?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  backgroundImageUrl?: string;
  onClick: () => void;
};

export default function ModeButton({
  eyebrow,
  title,
  subtitle,
  icon,
  isLight,
  isPrimary,
  loading,
  loadingLabel,
  disabled,
  backgroundImageUrl,
  onClick,
}: ModeButtonProps) {
  const hasBackground = Boolean(backgroundImageUrl?.trim());

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "group relative min-h-[164px] overflow-hidden rounded-[2rem] border p-5 text-left shadow-2xl backdrop-blur-xl transition hover:-translate-y-1 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        hasBackground
          ? isLight
            ? "border-orange-300 bg-slate-950 text-white shadow-orange-200/70"
            : "border-yellow-400/20 bg-black text-white shadow-black/40"
          : isPrimary
          ? getPrimaryButtonStyle(isLight)
          : getSecondaryButtonStyle(isLight)
      )}
    >
      {hasBackground && (
        <>
          <img
            src={backgroundImageUrl}
            alt=""
            aria-hidden="true"
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover opacity-100 transition duration-500 group-hover:scale-105"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />

          {/* Soft readability layers: enough contrast for the text, but the artist cover stays visible. */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/24 to-black/0" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-yellow-400/5" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" />
        </>
      )}

      <div className="relative z-10 flex h-full items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className={cn(
              "text-xs font-black uppercase tracking-[0.22em] opacity-80",
              displayFontClass,
              hasBackground && "text-yellow-300 opacity-100 drop-shadow"
            )}
          >
            {eyebrow}
          </p>
          <h2 className={cn("mt-3 text-2xl font-black", displayFontClass, hasBackground && "drop-shadow-lg")}>
            {loading ? loadingLabel : title}
          </h2>
          <p
            className={cn(
              "mt-2 text-sm font-bold leading-6",
              hasBackground ? "max-w-[90%] text-white/88 drop-shadow" : isPrimary ? "opacity-80" : getMutedText(isLight)
            )}
          >
            {subtitle}
          </p>
        </div>
        <span
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-3xl transition group-hover:scale-110",
            hasBackground ? "bg-black/28 shadow-lg backdrop-blur-sm" : ""
          )}
        >
          {loading ? "⏳" : icon}
        </span>
      </div>
    </button>
  );
}
