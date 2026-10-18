import { ID_FORMATS } from "./fiscal-config";

/**
 * Format checks for Algerian identifiers. They return a warning message (French)
 * or null. They never block saving: see ID_FORMATS in fiscal-config.ts.
 */

const digitsOnly = (value: string) => value.replace(/[\s.-]/g, "");

function checkDigits(value: string, lengths: readonly number[], label: string): string | null {
  const v = digitsOnly(value);
  if (v === "") return null;
  if (!/^\d+$/.test(v)) return `${label} : chiffres uniquement.`;
  if (!lengths.includes(v.length)) {
    return `${label} : ${lengths.join(" ou ")} chiffres attendus (${v.length} saisis).`;
  }
  return null;
}

export const checkNif = (v: string) => checkDigits(v, ID_FORMATS.nif.lengths, "NIF");
export const checkNis = (v: string) => checkDigits(v, ID_FORMATS.nis.lengths, "NIS");
export const checkRib = (v: string) => checkDigits(v, ID_FORMATS.rib.lengths, "RIB");

export function checkArticleImposition(value: string): string | null {
  const v = digitsOnly(value);
  if (v === "") return null;
  return /^\d+$/.test(v) ? null : "Article d'imposition : chiffres uniquement.";
}
