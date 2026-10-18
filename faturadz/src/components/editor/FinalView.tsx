"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Notice } from "@/components/ui";
import { getDb } from "@/db";
import { documentTotals, duplicateAsDraft, saveDraft } from "@/db/repository";
import type { FinalDocument } from "@/db/schema";
import { fr } from "@/i18n/fr";
import { formatAmount, formatPercent, formatQuantity } from "@/lib/money";
import { downloadDocumentPdf } from "@/pdf/download";
import { formatDateFr } from "@/pdf/model";
import { TotalsPanel } from "./TotalsPanel";

export function FinalView({ doc }: { doc: FinalDocument }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Stored documents are validated on import, but never let bad data crash the page.
  let totals: ReturnType<typeof documentTotals> | null = null;
  try {
    totals = documentTotals(doc);
  } catch {
    totals = null;
  }

  async function onDownload() {
    try {
      await downloadDocumentPdf(doc, doc.seller);
    } catch {
      setError(fr.errors.generic);
    }
  }

  async function onDuplicate() {
    const copy = await saveDraft(getDb(), duplicateAsDraft(doc));
    router.push(`/documents/${copy.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">
          {fr.docType[doc.type]} {doc.number}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onDuplicate}>{fr.doc.duplicate}</Button>
          <Button variant="primary" onClick={onDownload}>
            {fr.doc.download}
          </Button>
        </div>
      </div>
      <Notice>{fr.doc.locked}</Notice>
      {error && <Notice tone="danger">{error}</Notice>}
      {!totals && <Notice tone="danger">Montants hors limites : ce document ne peut pas être calculé.</Notice>}

      <Card>
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">{fr.fields.issueDate}</dt>
            <dd>{formatDateFr(doc.issueDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{fr.fields.client}</dt>
            <dd>{doc.client.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{fr.fields.paymentMethod}</dt>
            <dd>{fr.payment[doc.paymentMethod]}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Lignes">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-start text-xs text-muted">
              <tr>
                <th className="py-1 text-start">{fr.fields.designation}</th>
                <th className="py-1 text-end">{fr.fields.quantity}</th>
                <th className="py-1 text-end">{fr.fields.unitPrice}</th>
                <th className="py-1 text-end">{fr.fields.discount}</th>
                <th className="py-1 text-end">{fr.fields.tvaRate}</th>
                <th className="py-1 text-end">{fr.fields.lineTotal}</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1">{l.designation}</td>
                  <td className="py-1 text-end tabular-nums">
                    {formatQuantity(l.quantityMilli)} {l.unit}
                  </td>
                  <td className="py-1 text-end tabular-nums">{formatAmount(l.unitPriceCentimes)}</td>
                  <td className="py-1 text-end tabular-nums">{l.discountBp ? formatPercent(l.discountBp) : ""}</td>
                  <td className="py-1 text-end tabular-nums">{formatPercent(l.tvaRateBp)}</td>
                  <td className="py-1 text-end tabular-nums">{totals ? formatAmount(totals.lineHTCentimes[i]) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {totals && <TotalsPanel totals={totals} type={doc.type} />}
    </div>
  );
}
