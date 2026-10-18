/**
 * Money helpers. Every amount in the app is an integer number of centimes.
 * Floats are never used for money: they only appear when a user types a value,
 * and parseAmount turns that text straight into integer centimes.
 */

/** Largest amount accepted anywhere (≈ 90 trillion DA), keeps all sums exact. */
export const MAX_CENTIMES = Number.MAX_SAFE_INTEGER;
/** Input limits of a document line (shared by the editor parsers and the stored schema). */
export const MAX_QUANTITY_MILLI = 1_000_000_000; // 1 000 000 units
export const MAX_UNIT_PRICE_CENTIMES = 10_000_000_000_000; // 100 000 000 000 DA

export function assertCentimes(value: number, label = "amount"): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer of centimes, got ${value}`);
  }
}

/**
 * Integer division rounded half up (away from zero for non-negative values).
 * The single rounding rule of the app: 0.5 centime and above rounds up.
 */
export function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= BigInt(0)) throw new RangeError("denominator must be positive");
  if (numerator < BigInt(0)) throw new RangeError("numerator must be non-negative");
  return (numerator * BigInt(2) + denominator) / (denominator * BigInt(2));
}

export function toSafeNumber(value: bigint, label = "amount"): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`${label} is too large`);
  }
  return Number(value);
}

const AMOUNT_RE = /^(\d{1,15})(?:[.,](\d{1,2}))?$/;

/**
 * Parses a user-typed amount in DA into centimes.
 * Accepts "1234", "1234,5", "1234.50", "1 234,50" (spaces as thousand separators).
 * Returns null for anything else (negative, more than 2 decimals, letters...).
 */
export function parseAmount(input: string, max = MAX_CENTIMES): number | null {
  const compact = input.trim().replace(/[\s  ]/g, "");
  const match = AMOUNT_RE.exec(compact);
  if (!match) return null;
  const units = BigInt(match[1]);
  const decimals = BigInt((match[2] ?? "").padEnd(2, "0"));
  const centimes = units * BigInt(100) + decimals;
  return centimes > BigInt(max) ? null : Number(centimes);
}

const QTY_RE = /^(\d{1,9})(?:[.,](\d{1,3}))?$/;

/**
 * Parses a quantity into thousandths ("2,5" -> 2500). Max 3 decimals.
 * Returns null when invalid, zero or above MAX_QUANTITY_MILLI.
 */
export function parseQuantity(input: string): number | null {
  const match = QTY_RE.exec(input.trim().replace(/[\s  ]/g, ""));
  if (!match) return null;
  const milli = Number(match[1]) * 1000 + Number((match[2] ?? "").padEnd(3, "0"));
  return milli > 0 && milli <= MAX_QUANTITY_MILLI ? milli : null;
}

/** Parses a percentage with up to 2 decimals into basis points ("12,5" -> 1250). Max 100%. */
export function parsePercent(input: string): number | null {
  const match = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const bp = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return bp <= 10000 ? bp : null;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** 123456789 -> "1 234 567,89" (French format, plain spaces so every PDF font renders it). */
export function formatAmount(centimes: number): string {
  assertCentimes(centimes);
  const units = Math.floor(centimes / 100);
  const cents = centimes % 100;
  return `${groupThousands(String(units))},${String(cents).padStart(2, "0")}`;
}

export function formatDA(centimes: number): string {
  return `${formatAmount(centimes)} DA`;
}

/** 2500 -> "2,5"; 1000 -> "1". */
export function formatQuantity(milli: number): string {
  const units = Math.floor(milli / 1000);
  const frac = String(milli % 1000).padStart(3, "0").replace(/0+$/, "");
  return frac ? `${groupThousands(String(units))},${frac}` : groupThousands(String(units));
}

/** 1900 -> "19 %"; 1250 -> "12,5 %". */
export function formatPercent(bp: number): string {
  const units = Math.floor(bp / 100);
  const frac = String(bp % 100).padStart(2, "0").replace(/0+$/, "");
  return `${units}${frac ? `,${frac}` : ""} %`;
}

/** Amount for an input field: 123450 -> "1234,50". */
export function amountToInput(centimes: number): string {
  return `${Math.floor(centimes / 100)},${String(centimes % 100).padStart(2, "0")}`;
}

export function quantityToInput(milli: number): string {
  return formatQuantity(milli).replace(/ /g, "");
}

export function percentToInput(bp: number): string {
  return formatPercent(bp).replace(" %", "");
}
