import { ReactNode, useEffect } from "react";
import { ensureAppFonts, appFontClass } from "../../theme/fonts";
import { cn, getPageBg } from "../../theme/styles";

type PageShellProps = {
  isLight: boolean;
  children: ReactNode;
  maxWidth?: string;
  background?: "home" | "game" | "result" | "none";
};

function FloatingBackground({ isLight, variant }: { isLight: boolean; variant: "home" | "game" | "result" }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {variant === "home" && (
        <>
          <div
            className={cn(
              "absolute inset-0 bg-cover bg-center bg-no-repeat",
              isLight ? "opacity-[0.22]" : "opacity-[0.52]"
            )}
            style={{ backgroundImage: 'url("/home-stage-bg.png")' }}
          />
          <div
            className={cn(
              "absolute inset-0",
              isLight
                ? "bg-gradient-to-br from-orange-50/85 via-amber-50/72 to-yellow-100/75"
                : "bg-gradient-to-br from-black/78 via-[#050509]/60 to-black/72"
            )}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_22%,rgba(250,204,21,0.18),transparent_32%),radial-gradient(circle_at_88%_72%,rgba(168,85,247,0.16),transparent_34%),radial-gradient(circle_at_8%_82%,rgba(249,115,22,0.16),transparent_26%)]" />
        </>
      )}

      <div
        className={cn(
          "absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full blur-3xl soft-pulse",
          isLight ? "bg-orange-400/20" : "bg-yellow-400/10"
        )}
      />
      <div
        className={cn(
          "absolute bottom-[-8rem] right-[-8rem] h-96 w-96 rounded-full blur-3xl soft-pulse",
          isLight ? "bg-emerald-400/16" : "bg-green-400/10"
        )}
      />
      <div
        className={cn(
          "absolute left-[-9rem] top-1/2 h-80 w-80 rounded-full blur-3xl soft-pulse",
          isLight ? "bg-violet-400/12" : "bg-violet-500/10"
        )}
      />

      {variant === "game" && (
        <>
          <p className={cn("lyric-float absolute -left-10 top-32 text-6xl font-black", isLight ? "text-orange-700/10" : "text-white/10")}>
            “lyrics”
          </p>
          <p className={cn("lyric-float absolute -right-16 bottom-40 text-6xl font-black [animation-delay:1.4s]", isLight ? "text-emerald-600/10" : "text-yellow-400/10")}>
            “million”
          </p>
          <div className="mic-float absolute left-[7%] bottom-[18%] text-7xl opacity-10">🎙️</div>
        </>
      )}

      {variant === "result" && (
        <>
          <p className={cn("lyric-float absolute left-5 top-32 text-5xl font-black", isLight ? "text-orange-700/10" : "text-white/10")}>
            “final answer”
          </p>
          <p className={cn("lyric-float absolute -right-10 bottom-44 text-6xl font-black [animation-delay:1.2s]", isLight ? "text-emerald-700/10" : "text-yellow-400/10")}>
            “jackpot”
          </p>
        </>
      )}
    </div>
  );
}

export default function PageShell({ isLight, children, maxWidth = "max-w-7xl", background = "none" }: PageShellProps) {
  useEffect(() => {
    ensureAppFonts();
  }, []);

  return (
    <div className={cn("relative min-h-screen overflow-hidden", appFontClass, getPageBg(isLight))}>
      {background !== "none" && <FloatingBackground isLight={isLight} variant={background} />}
      <main className={cn("relative z-10 mx-auto flex min-h-screen w-full flex-col px-5 py-5 lg:px-8", maxWidth)}>{children}</main>
    </div>
  );
}
