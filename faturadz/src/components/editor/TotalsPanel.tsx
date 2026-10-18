import { Card } from "@/components/ui";
import { fr } from "@/i18n/fr";
import { amountInWords } from "@/lib/amountInWords";
import { formatDA } from "@/lib/money";
import type { DocumentType } from "@/lib/numbering";
import type { Totals } from "@/lib/tax";
import { totalsRows } from "@/lib/totalsRows";

export function TotalsPanel({ totals, type }: { totals: Totals; type: DocumentType }) {
  return (
    <Card title="Totaux">
      <dl className="ms-auto flex max-w-md flex-col gap-1 text-sm">
        {totalsRows(totals).map(([label, value]) => (
          <Row key={label} label={label} value={value} />
        ))}
        <div className="mt-1 border-t border-foreground pt-1 text-base font-bold">
          <Row label={fr.totals.net} value={formatDA(totals.netAPayerCentimes)} />
        </div>
      </dl>
      <p className="mt-3 text-sm text-muted">
        {type === "facture" ? fr.totals.inWordsFacture : fr.totals.inWordsRecu}{" "}
        <span className="font-medium text-foreground">{amountInWords(totals.netAPayerCentimes)}</span>
      </p>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
