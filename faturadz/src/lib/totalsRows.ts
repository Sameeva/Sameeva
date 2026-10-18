import { fr } from "@/i18n/fr";
import { formatAmount, formatDA, formatPercent } from "./money";
import type { Totals } from "./tax";

/** Label/value rows shown above the "Net à payer" line, shared by the screen and the PDF. */
export function totalsRows(totals: Totals): [string, string][] {
  const rows: [string, string][] = [[fr.totals.ht, formatDA(totals.totalHTCentimes)]];
  for (const t of totals.tva) {
    rows.push([`${fr.totals.tva} ${formatPercent(t.rateBp)} (base ${formatAmount(t.baseHTCentimes)})`, formatDA(t.tvaCentimes)]);
  }
  rows.push([fr.totals.ttc, formatDA(totals.totalTTCCentimes)]);
  if (totals.timbreCentimes > 0) rows.push([fr.totals.timbre, formatDA(totals.timbreCentimes)]);
  return rows;
}
