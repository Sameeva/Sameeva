import type { InvoiceDocument, SellerSnapshot } from "@/db/schema";
import { downloadBlob, safeFilename } from "@/lib/download";
import { buildPdfModel } from "./model";

/** Renders the PDF in the browser and saves it. The PDF library is loaded on demand. */
export async function downloadDocumentPdf(doc: InvoiceDocument, currentSeller: SellerSnapshot): Promise<void> {
  const model = buildPdfModel(doc, currentSeller);
  const [{ pdf }, { DocumentPdf }] = await Promise.all([import("@react-pdf/renderer"), import("./DocumentPdf")]);
  const blob = await pdf(<DocumentPdf model={model} />).toBlob();
  const name = doc.status === "final" ? doc.number : `brouillon-${doc.type}-${doc.issueDate}`;
  downloadBlob(blob, `${safeFilename(name)}.pdf`);
}
