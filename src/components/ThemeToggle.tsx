import { useEffect, useState } from "react";

export type AppTheme = "dark" | "light";

export function useAppTheme() {
  const [theme, setTheme] = useState<AppTheme>(() => {
    const stored = localStorage.getItem("lyric-theme");

    if (stored === "light" || stored === "dark") {
      return stored;
    }

    return "dark";
  });

  useEffect(() => {
    localStorage.setItem("lyric-theme", theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (document.getElementById("lyric-millionaire-fonts")) return;

    const preconnectGoogle = document.createElement("link");
    preconnectGoogle.rel = "preconnect";
    preconnectGoogle.href = "https://fonts.googleapis.com";

    const preconnectGstatic = document.createElement("link");
    preconnectGstatic.rel = "preconnect";
    preconnectGstatic.href = "https://fonts.gstatic.com";
    preconnectGstatic.crossOrigin = "anonymous";

    const fontLink = document.createElement("link");
    fontLink.id = "lyric-millionaire-fonts";
    fontLink.rel = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Montserrat:wght@700;800;900&display=swap";

    document.head.appendChild(preconnectGoogle);
    document.head.appendChild(preconnectGstatic);
    document.head.appendChild(fontLink);
  }, []);

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  return {
    theme,
    isLight: theme === "light",
    toggleTheme,
  };
}

export default function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: AppTheme;
  onToggle: () => void;
}) {
  const isLight = theme === "light";

  return (
    <button
      onClick={onToggle}
      className={[
        "rounded-full border px-4 py-2 text-xs font-black tracking-[-0.01em] transition",
        isLight
          ? "border-orange-200 bg-white/80 text-orange-700 shadow-sm hover:bg-orange-50"
          : "border-white/10 bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/[0.08]",
      ].join(" ")}
    >
      {isLight ? "☀️ Light" : "🌙 Dark"}
    </button>
  );
}