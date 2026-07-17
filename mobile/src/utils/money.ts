// Currency handling for the prize pool. Amounts are integer MINOR units;
// formatting is the only place we go to major units.
//
// Two separate concepts (this is the bit that bit us):
//  - minorDecimals = the STORAGE scale — how many decimal places one minor unit
//    represents. This must stay stable or existing stored amounts change value.
//  - displayDecimals = how many decimals we SHOW.
//
// GBP/USD: both 2 (pence/cents). JOD: a dinar is 1000 fils, so it's stored to 3
// decimals (keeping already-created JOD pools correct), but DISPLAYED to 2 like
// the others.

export type Currency = "GBP" | "USD" | "JOD";

export const CURRENCIES: Currency[] = ["GBP", "USD", "JOD"];

const CONFIG: Record<
  Currency,
  { minorDecimals: number; displayDecimals: number; symbol: string; suffix: boolean; label: string }
> = {
  GBP: { minorDecimals: 2, displayDecimals: 2, symbol: "£", suffix: false, label: "British Pound" },
  USD: { minorDecimals: 2, displayDecimals: 2, symbol: "$", suffix: false, label: "US Dollar" },
  JOD: { minorDecimals: 3, displayDecimals: 2, symbol: "JD", suffix: true, label: "Jordanian Dinar" },
};

// Scale factor for STORAGE/parse (10^minorDecimals). Keep JOD at 1000.
export function minorPerUnit(currency: Currency): number {
  return 10 ** CONFIG[currency].minorDecimals;
}

// Decimals shown in the UI (and used to render the editable fee string).
export function currencyDecimals(currency: Currency): number {
  return CONFIG[currency].displayDecimals;
}

export function currencySymbol(currency: Currency): string {
  return CONFIG[currency].symbol;
}

export function currencyLabel(currency: Currency): string {
  return CONFIG[currency].label;
}

// Format integer minor units for display, e.g. formatMoney(2000, "GBP") → "£20.00",
// formatMoney(100000, "JOD") → "100.00 JD" (stored as 100000 fils, shown to 2dp).
export function formatMoney(amountMinor: number, currency: Currency): string {
  const { displayDecimals, symbol, suffix } = CONFIG[currency];
  const major = (amountMinor / minorPerUnit(currency)).toFixed(displayDecimals);
  return suffix ? `${major} ${symbol}` : `${symbol}${major}`;
}

// Parse a user-entered major-unit string (e.g. "5", "5.50", "100") into integer
// minor units for the currency. Returns null when invalid or negative.
export function parseMoneyToMinor(input: string, currency: Currency): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * minorPerUnit(currency));
}

// Minor units → an editable major-unit string at display precision (for seeding
// the fee input from a saved pool).
export function minorToMajorString(amountMinor: number, currency: Currency): string {
  return (amountMinor / minorPerUnit(currency)).toFixed(currencyDecimals(currency));
}
