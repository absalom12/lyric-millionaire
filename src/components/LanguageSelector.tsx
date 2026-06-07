import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { LanguageCode, languageLabels } from "../i18n/translations";

const languages: LanguageCode[] = ["en", "fr", "pt", "es"];

export default function LanguageSelector({ isLight }: { isLight: boolean }) {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={[
          "rounded-full border px-4 py-2 text-xs font-black tracking-[-0.01em] transition",
          isLight
            ? "border-orange-200 bg-white/80 text-orange-700 hover:bg-orange-50"
            : "border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08]",
        ].join(" ")}
      >
        {languageLabels[language]} ▾
      </button>

      {open && (
        <div
          className={[
            "absolute right-0 top-11 z-50 w-32 overflow-hidden rounded-2xl border shadow-2xl",
            isLight
              ? "border-orange-100 bg-white text-slate-900 shadow-orange-100"
              : "border-white/10 bg-gray-950 text-white shadow-black/50",
          ].join(" ")}
        >
          {languages.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setLanguage(item);
                setOpen(false);
              }}
              className={[
                "flex w-full items-center justify-between px-4 py-3 text-left text-xs font-black tracking-[-0.01em] transition",
                item === language
                  ? isLight
                    ? "bg-orange-50 text-orange-700"
                    : "bg-yellow-400/10 text-yellow-300"
                  : isLight
                  ? "hover:bg-orange-50"
                  : "hover:bg-white/[0.06]",
              ].join(" ")}
            >
              <span>{languageLabels[item]}</span>
              {item === language && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}