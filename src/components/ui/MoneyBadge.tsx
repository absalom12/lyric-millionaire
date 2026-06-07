import { cn, getMoneyText } from "../../theme/styles";
import { displayFontClass } from "../../theme/fonts";
import { formatMoney } from "../../utils/money";

type MoneyBadgeProps = {
  amount: number;
  isLight: boolean;
  size?: "sm" | "lg";
  className?: string;
};

export default function MoneyBadge({ amount, isLight, size = "lg", className }: MoneyBadgeProps) {
  return (
    <span
      className={cn(
        "font-black tracking-tight",
        displayFontClass,
        className ?? getMoneyText(isLight),
        size === "lg" ? "text-5xl sm:text-7xl" : "text-2xl"
      )}
    >
      {formatMoney(amount)}
    </span>
  );
}
