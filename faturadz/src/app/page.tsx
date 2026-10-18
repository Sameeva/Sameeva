"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, Notice, SelectField, TextField } from "@/components/ui";
import { useDbQuery } from "@/components/useDb";
import { getDb } from "@/db";
import { documentTotals, newDraft, saveDraft } from "@/db/repository";
import type { InvoiceDocument } from "@/db/schema";
import { fr } from "@/i18n/fr";
import { formatDA } from "@/lib/money";
import type { DocumentType } from "@/lib/numbering";
import { formatDateFr } from "@/pdf/model";

type Filter = "all" | DocumentType | "draft";
const filterOptions: { value: Filter; label: string }[] = [
  { value: "all", label: fr.dashboard.all },
  { value: "facture", label: "Factures" },
  { value: "recu", label: "Reçus" },
  { value: "draft", label: "Brouillons" },
];

function netOf(doc: InvoiceDocument): string {
  try {
    return formatDA(documentTotals(doc).netAPayerCentimes);
  } catch {
    return "—";
  }
}

/** Net amount per document id, recomputed only when the documents change (not on each keystroke). */
function useNetAmounts(documents: InvoiceDocument[] | undefined): Map<string, string> {
  return useMemo(() => new Map((documents ?? []).map((d) => [d.id, netOf(d)])), [documents]);
}

export default function DashboardPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const documents = useDbQuery((db) => db.documents.orderBy("updatedAt").reverse().toArray());
  const business = useDbQuery(async (db) => (await db.settings.get("business")) ?? null);
  const nets = useNetAmounts(documents);

  async function create(type: DocumentType) {
    const draft = await saveDraft(getDb(), newDraft(type));
    router.push(`/documents/${draft.id}`);
  }

  const q = query.trim().toLowerCase();
  const visible = (documents ?? []).filter((d) => {
    if (filter === "draft" ? d.status !== "draft" : filter !== "all" && d.type !== filter) return false;
    return !q || d.client.name.toLowerCase().includes(q) || (d.number ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{fr.dashboard.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => create("facture")}>
            {fr.doc.newFacture}
          </Button>
          <Button onClick={() => create("recu")}>{fr.doc.newRecu}</Button>
        </div>
      </div>

      {business === null && (
        <Notice tone="warn">
          {fr.dashboard.setupFirst}{" "}
          <Link href="/settings" className="underline">
            {fr.dashboard.goSettings}
          </Link>
        </Notice>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <TextField label={fr.common.search} value={query} onChange={setQuery} type="search" placeholder="Client ou numéro" />
        </div>
        <SelectField label="Filtre" value={filter} options={filterOptions} onChange={setFilter} />
      </div>

      {documents && visible.length === 0 && <p className="text-sm text-muted">{fr.dashboard.empty}</p>}

      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {visible.map((d) => (
          <li key={d.id}>
            <Link href={`/documents/${d.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-background">
              <div>
                <p className="font-medium">
                  {fr.docType[d.type]} {d.number ?? ""}
                  {d.status === "draft" && <span className="ms-2 rounded bg-background px-1.5 py-0.5 text-xs text-warn">{fr.status.draft}</span>}
                </p>
                <p className="text-xs text-muted">
                  {formatDateFr(d.issueDate)} · {d.client.name || "—"}
                </p>
              </div>
              <span className="tabular-nums text-sm font-medium">{nets.get(d.id)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
