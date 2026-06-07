export const MONEY_LADDER = [100, 500, 1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 500_000, 1_000_000];

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function getMoneyReached(run: { score?: number; moneyReached?: number }): number {
  return Number(run.score ?? run.moneyReached ?? 0);
}
