import LanguageSelector from "../LanguageSelector";
import ThemeToggle, { AppTheme } from "../ThemeToggle";
import BrandLogo from "./BrandLogo";

type HeaderProps = {
  brand: string;
  subtitle?: string;
  isLight: boolean;
  theme: AppTheme;
  onToggleTheme: () => void;
  onBrandClick?: () => void;
};

export default function Header({ brand, subtitle, isLight, theme, onToggleTheme, onBrandClick }: HeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4">
      <BrandLogo brand={brand} subtitle={subtitle} isLight={isLight} onClick={onBrandClick} />

      <div className="flex items-center gap-2">
        <LanguageSelector isLight={isLight} />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}
