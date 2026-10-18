import { assertCentimes } from "./money";

/**
 * French number to words, traditional spelling (hyphens below 100 only), as
 * commonly used on Algerian invoices:
 *   21 -> "vingt et un", 71 -> "soixante et onze", 81 -> "quatre-vingt-un",
 *   80 -> "quatre-vingts", 200 -> "deux cents", 201 -> "deux cent un",
 *   200 000 -> "deux cent mille", 2 000 000 -> "deux millions",
 *   80 000 000 -> "quatre-vingts millions" (million/milliard are nouns).
 */

const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

/** 0..99. `terminal` = nothing follows (only "quatre-vingts" depends on it). */
function below100(n: number, terminal: boolean): string {
  if (n < 20) return UNITS[n];
  if (n < 70) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    if (unit === 0) return TENS[ten];
    if (unit === 1) return `${TENS[ten]} et un`;
    return `${TENS[ten]}-${UNITS[unit]}`;
  }
  if (n < 80) {
    // 70..79 = soixante + 10..19
    const rest = n - 60;
    return rest === 11 ? "soixante et onze" : `soixante-${UNITS[rest]}`;
  }
  // 80..99 = quatre-vingt + 0..19 (no "et")
  const rest = n - 80;
  if (rest === 0) return terminal ? "quatre-vingts" : "quatre-vingt";
  return `quatre-vingt-${UNITS[rest]}`;
}

/** 0..999 (0 returns ""). `terminal`: no word follows, or a noun (million) follows. */
function below1000(n: number, terminal: boolean): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds === 1) parts.push("cent");
  else if (hundreds > 1) {
    parts.push(UNITS[hundreds]);
    parts.push(rest === 0 && terminal ? "cents" : "cent");
  }
  if (rest > 0) parts.push(below100(rest, terminal));
  return parts.join(" ");
}

const SCALES = [
  { value: 1_000_000_000_000, singular: "billion", plural: "billions" },
  { value: 1_000_000_000, singular: "milliard", plural: "milliards" },
  { value: 1_000_000, singular: "million", plural: "millions" },
] as const;

/** Integer to French words. Supports 0 .. Number.MAX_SAFE_INTEGER. */
export function numberToFrenchWords(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`unsupported number ${n}`);
  if (n === 0) return UNITS[0];

  const parts: string[] = [];
  let rest = n;
  for (const scale of SCALES) {
    const count = Math.floor(rest / scale.value);
    rest %= scale.value;
    if (count > 0) {
      // million/milliard are nouns, so the count is written as if terminal
      // ("deux cents millions", "quatre-vingts milliards").
      parts.push(numberToFrenchWords(count), count === 1 ? scale.singular : scale.plural);
    }
  }
  const thousands = Math.floor(rest / 1000);
  const units = rest % 1000;
  if (thousands === 1) parts.push("mille");
  else if (thousands > 1) parts.push(below1000(thousands, false), "mille");
  if (units > 0) parts.push(below1000(units, true));
  return parts.join(" ");
}

/**
 * "Arrêtée la présente facture à la somme de : <result>".
 *   123456 -> "mille deux cent trente-quatre dinars algériens et cinquante-six centimes"
 *   100 -> "un dinar algérien"
 *   100000000 -> "un million de dinars algériens"
 */
export function amountInWords(centimes: number): string {
  assertCentimes(centimes);
  const dinars = Math.floor(centimes / 100);
  const cents = centimes % 100;

  const dinarWords = numberToFrenchWords(dinars);
  // "de" after a bare million/milliard: "deux millions de dinars".
  const needsDe = /(?:million|millions|milliard|milliards|billion|billions)$/.test(dinarWords);
  const unit = dinars <= 1 ? "dinar algérien" : "dinars algériens";
  let result = `${dinarWords} ${needsDe ? "de " : ""}${unit}`;

  if (cents > 0) {
    result += ` et ${numberToFrenchWords(cents)} ${cents === 1 ? "centime" : "centimes"}`;
  }
  return result;
}
