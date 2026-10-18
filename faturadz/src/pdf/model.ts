import type { InvoiceDocument, SellerSnapshot } from "@/db/schema";
import { fr } from "@/i18n/fr";
import { amountInWords } from "@/lib/amountInWords";
import { documentTotals } from "@/db/repository";
import { totalsRows } from "@/lib/totalsRows";
import { formatAmount, formatDA, formatPercent, formatQuantity } from "@/lib/money";

/** Everything printed on the PDF, as plain strings. Pure, so it can be tested without rendering. */
export interface PdfModel {
  title: string;
  isDraft: boolean;
  number: string | null;
  issueDate: string;
  dueDate: string | null;
  logo: string | null;
  seller: { name: string; lines: string[]; ids: [string, string][] };
  client: { label: string; name: string; lines: string[]; ids: [string, string][] } | null;
  columns: string[];
  rows: string[][];
  totals: [string, string][];
  net: [string, string];
  inWordsLabel: string;
  inWords: string;
  payment: string;
  notes: string;
  footer: string;
  tvaNotice: string | null;
}

/** "2026-03-10" -> "10/03/2026" */
export function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const nonEmpty = (pairs: [string, string][]) => pairs.filter(([, v]) => v.trim() !== "");

export function buildPdfModel(doc: InvoiceDocument, currentSeller: SellerSnapshot): PdfModel {
  // A final document prints the seller frozen at finalization; a draft previews the current one.
  const seller = doc.status === "final" ? doc.seller : currentSeller;
  const totals = documentTotals(doc);

  const sellerLines = [
    [seller.legalForm, seller.capitalCentimes != null ? `au capital de ${formatDA(seller.capitalCentimes)}` : ""].filter(Boolean).join(" "),
    seller.activity,
    seller.address,
    [seller.phone && `Tél. ${seller.phone}`, seller.email].filter(Boolean).join(" · "),
  ].filter((l) => l.trim() !== "");

  const c = doc.client;
  const hasClient = c.name.trim() !== "";
  const client = hasClient
    ? {
        label: doc.type === "facture" ? fr.fields.client : fr.doc.received,
        name: c.name,
        lines: [c.address, [c.phone && `Tél. ${c.phone}`, c.email].filter(Boolean).join(" · ")].filter((l) => l.trim() !== ""),
        ids: nonEmpty([
          ["NIF", c.nif],
          ["NIS", c.nis],
          ["RC", c.rc],
          ["Art. imp.", c.articleImposition],
        ]),
      }
    : null;

  const rows = doc.lines.map((l, i) => [
    l.designation,
    l.unit,
    formatQuantity(l.quantityMilli),
    formatAmount(l.unitPriceCentimes),
    l.discountBp ? formatPercent(l.discountBp) : "",
    formatPercent(l.tvaRateBp),
    formatAmount(totals.lineHTCentimes[i]),
  ]);

  return {
    title: fr.docType[doc.type].toUpperCase(),
    isDraft: doc.status === "draft",
    number: doc.status === "final" ? doc.number : null,
    issueDate: formatDateFr(doc.issueDate),
    dueDate: doc.dueDate ? formatDateFr(doc.dueDate) : null,
    logo: seller.logo,
    seller: {
      name: seller.name,
      lines: sellerLines,
      ids: nonEmpty([
        ["NIF", seller.nif],
        ["NIS", seller.nis],
        ["RC", seller.rc],
        ["Art. imp.", seller.articleImposition],
        ["RIB", seller.rib],
        ["Banque", seller.bank],
      ]),
    },
    client,
    columns: [fr.fields.designation, fr.fields.unit, fr.fields.quantity, "P.U. HT", "Remise", fr.fields.tvaRate, fr.fields.lineTotal],
    rows,
    totals: totalsRows(totals),
    net: [fr.totals.net, formatDA(totals.netAPayerCentimes)],
    inWordsLabel: doc.type === "facture" ? fr.totals.inWordsFacture : fr.totals.inWordsRecu,
    inWords: capitalize(amountInWords(totals.netAPayerCentimes)),
    payment: `${fr.fields.paymentMethod} : ${fr.payment[doc.paymentMethod]}`,
    notes: doc.notes,
    footer: seller.footer,
    tvaNotice: seller.tvaLiable ? null : "Non assujetti à la TVA",
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
