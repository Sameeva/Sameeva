export type DocumentType = "facture" | "recu";

export const DOCUMENT_PREFIX: Record<DocumentType, string> = {
  facture: "FA",
  recu: "RE",
};

/** Key of the counter that holds the last number used for a type and year. */
export function counterKey(type: DocumentType, year: number): string {
  return `${type}-${year}`;
}

/**
 * Formats a document number: FA-2026-0001. The sequence restarts every year
 * and is padded to at least 4 digits (it keeps growing past 9999).
 */
export function formatDocumentNumber(type: DocumentType, year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) throw new RangeError(`invalid year ${year}`);
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new RangeError(`invalid sequence ${sequence}`);
  return `${DOCUMENT_PREFIX[type]}-${year}-${String(sequence).padStart(4, "0")}`;
}

/** Year of an ISO date (YYYY-MM-DD), read from the string to avoid time zone shifts. */
export function yearOfIsoDate(isoDate: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new RangeError(`invalid ISO date ${isoDate}`);
  return Number(match[1]);
}
