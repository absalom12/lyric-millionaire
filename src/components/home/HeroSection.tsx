import { TranslationDictionary } from "../../i18n/translations";
import { useLanguage } from "../../i18n/LanguageContext";
import { cn, getMutedText } from "../../theme/styles";
import { displayFontClass } from "../../theme/fonts";

type HeroSectionProps = {
  t?: TranslationDictionary;
  isLight: boolean;
};

export default function HeroSection({ t, isLight }: HeroSectionProps) {
  const { t: contextT } = useLanguage();
  const copy = t ?? contextT;

  return (
    <div className="max-w-3xl">

      <h1
        className={cn(
          "max-w-3xl text-5xl font-black leading-[0.88] tracking-tight sm:text-7xl lg:text-8xl",
          displayFontClass
        )}
      >
        {copy.home.headlineTop}
        <span
          className={cn(
            "block",
            isLight
              ? "text-orange-600 drop-shadow-[0_0_26px_rgba(249,115,22,0.28)]"
              : "text-yellow-400 drop-shadow-[0_0_28px_rgba(250,204,21,0.25)]"
          )}
        >
          {copy.home.headlineBottom}
        </span>
      </h1>

      <p className={cn("mt-6 max-w-xl text-base font-medium leading-7 sm:text-lg sm:leading-8", getMutedText(isLight))}>
        {copy.home.description}
      </p>
    </div>
  );
}
