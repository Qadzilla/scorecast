// Currency handling for the prize pool. Amounts are integer MINOR units (the
// 1/100 subunit) everywhere; formatting is the only place we go to major units.
// All three currencies use 2dp: GBP/USD symbol-prefixed, JOD suffixed as "JD"
// (a dinar is technically 1000 fils, but we display it to 2dp like the others).

export type Currency = "GBP" | "USD" | "JOD";

export const CURRENCIES: Currency[] = ["GBP", "USD", "JOD"];

const CONFIG: Record<Currency, { decimals: number; symbol: string; suffix: boolean; label: string }> = {
  GBP: { decimals: 2, symbol: "£", suffix: false, label: "British Pound" },
  USD: { decimals: 2, symbol: "$", suffix: false, label: "US Dollar" },
  JOD: { decimals: 2, symbol: "JD", suffix: true, label: "Jordanian Dinar" },
};

export function minorPerUnit(currency: Currency): number {
  return 10 ** CONFIG[currency].decimals;
}

export function currencyDecimals(currency: Currency): number {
  return CONFIG[currency].decimals;
}

export function currencySymbol(currency: Currency): string {
  return CONFIG[currency].symbol;
}

export function currencyLabel(currency: Currency): string {
  return CONFIG[currency].label;
}

// Format integer minor units for display, e.g. formatMoney(2000, "GBP") → "£20.00".
export function formatMoney(amountMinor: number, currency: Currency): string {
  const { decimals, symbol, suffix } = CONFIG[currency];
  const major = (amountMinor / minorPerUnit(currency)).toFixed(decimals);
  return suffix ? `${major} ${symbol}` : `${symbol}${major}`;
}

// Parse a user-entered major-unit string (e.g. "5", "5.50", "2.500") into integer
// minor units for the currency. Returns null when invalid or negative.
export function parseMoneyToMinor(input: string, currency: Currency): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * minorPerUnit(currency));
}

// Minor units → an editable major-unit string at the right precision (for
// seeding the fee input from a saved pool).
export function minorToMajorString(amountMinor: number, currency: Currency): string {
  return (amountMinor / minorPerUnit(currency)).toFixed(currencyDecimals(currency));
}
