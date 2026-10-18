"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Checkbox, Notice, SelectField, TextArea, TextField } from "@/components/ui";
import { useDbQuery } from "@/components/useDb";
import { tvaOptions } from "@/components/BusinessForm";
import { getDb } from "@/db";
import { deleteDraft, finalizeDocument, newId, saveDraft, sellerFromBusiness } from "@/db/repository";
import type { Business, ClientSnapshot, DocumentLine, DraftDocument } from "@/db/schema";
import { fr } from "@/i18n/fr";
import type { TvaRateBp } from "@/lib/fiscal-config";
import { amountToInput } from "@/lib/money";
import { computeTotals, type PaymentMethod, type Totals } from "@/lib/tax";
import { checkArticleImposition, checkNif, checkNis } from "@/lib/validators";
import { downloadDocumentPdf } from "@/pdf/download";
import { parseEditorLine, toEditorLine, type EditorLine } from "./lines";
import { TotalsPanel } from "./TotalsPanel";

const paymentOptions = (Object.keys(fr.payment) as PaymentMethod[]).map((p) => ({ value: p, label: fr.payment[p] }));
type ClientKey = keyof ClientSnapshot;

const AUTOSAVE_MS = 600;

export function DraftEditor({ initial, business }: { initial: DraftDocument; business: Business | null }) {
  const router = useRouter();
  const tvaLiable = business?.tvaLiable ?? true;
  const defaultRate: TvaRateBp = tvaLiable ? (business?.defaultTvaRateBp ?? 1900) : 0;

  const [meta, setMeta] = useState(() => ({
    issueDate: initial.issueDate,
    dueDate: initial.dueDate ?? "",
    paymentMethod: initial.paymentMethod,
    applyTimbre: initial.applyTimbre,
    notes: initial.notes,
  }));
  const [client, setClient] = useState<ClientSnapshot>(initial.client);
  // A business not liable to TVA can only use 0 % (the rate selector is locked).
  const [lines, setLines] = useState<EditorLine[]>(() =>
    initial.lines.map((l) => toEditorLine(tvaLiable ? l : { ...l, tvaRateBp: 0 }, newId())),
  );
  const [status, setStatus] = useState<{ tone: "info" | "danger" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const clients = useDbQuery((db) => db.clients.orderBy("name").toArray());
  const products = useDbQuery((db) => db.products.orderBy("designation").toArray());

  // Parse every line; the draft is only saved when all lines are valid.
  const parsed = useMemo(() => lines.map(parseEditorLine), [lines]);
  const validLines = parsed.every((p) => p.line !== null) ? parsed.map((p) => p.line as DocumentLine) : null;
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(meta.issueDate) && (meta.dueDate === "" || /^\d{4}-\d{2}-\d{2}$/.test(meta.dueDate));

  const draft: DraftDocument | null =
    validLines && dateValid
      ? {
          ...initial,
          issueDate: meta.issueDate,
          dueDate: meta.dueDate || null,
          paymentMethod: meta.paymentMethod,
          applyTimbre: meta.applyTimbre,
          notes: meta.notes,
          client,
          lines: validLines,
        }
      : null;

  let totals: Totals | null = null;
  let totalsError: string | null = null;
  if (validLines) {
    try {
      totals = computeTotals(validLines, { paymentMethod: meta.paymentMethod, applyTimbre: meta.applyTimbre });
    } catch {
      totalsError = "Montants trop élevés.";
    }
  }

  // Debounced autosave of the latest valid draft.
  const draftJson = draft ? JSON.stringify({ ...draft, updatedAt: 0 }) : null;
  const lastSavedJson = useRef(JSON.stringify({ ...initial, updatedAt: 0 }));
  const finalizing = useRef(false);

  useEffect(() => {
    if (!draftJson || draftJson === lastSavedJson.current) return;
    const timer = setTimeout(() => {
      if (finalizing.current) return;
      saveDraft(getDb(), JSON.parse(draftJson) as DraftDocument)
        .then(() => {
          lastSavedJson.current = draftJson;
          setStatus({ tone: "info", text: fr.doc.draftSaved });
        })
        .catch(() => setStatus({ tone: "danger", text: fr.errors.generic }));
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [draftJson]);

  const updateLine = (key: string, patch: Partial<EditorLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = (from?: Partial<EditorLine>) =>
    setLines((ls) => [...ls, { key: newId(), designation: "", unit: "", quantity: "1", unitPrice: "", discount: "", tvaRateBp: defaultRate, ...from }]);

  function pickProduct(id: string) {
    const p = products?.find((x) => x.id === id);
    if (!p) return;
    addLine({ designation: p.designation, unit: p.unit, unitPrice: amountToInput(p.unitPriceCentimes), tvaRateBp: tvaLiable ? p.tvaRateBp : 0 });
  }

  function pickClient(id: string) {
    const c = clients?.find((x) => x.id === id);
    if (!c) return;
    setClient({ name: c.name, address: c.address, phone: c.phone, email: c.email, nif: c.nif, nis: c.nis, rc: c.rc, articleImposition: c.articleImposition });
  }

  async function onFinalize() {
    if (!draft) return;
    if (!window.confirm(fr.doc.finalizeConfirm)) return;
    setBusy(true);
    finalizing.current = true;
    try {
      await saveDraft(getDb(), draft); // flush the latest edits first
      await finalizeDocument(getDb(), draft.id);
      // The page re-renders with the finalized view (live query).
    } catch (e) {
      finalizing.current = false;
      setStatus({ tone: "danger", text: e instanceof Error ? e.message : fr.errors.generic });
    } finally {
      setBusy(false);
    }
  }

  async function onPreview() {
    if (!draft || !business) return;
    try {
      await downloadDocumentPdf(draft, sellerFromBusiness(business));
    } catch {
      setStatus({ tone: "danger", text: fr.errors.generic });
    }
  }

  async function onDelete() {
    if (!window.confirm(fr.common.confirmDelete)) return;
    finalizing.current = true; // stop autosave from recreating the draft
    try {
      await deleteDraft(getDb(), initial.id);
      router.push("/");
    } catch (e) {
      finalizing.current = false;
      setStatus({ tone: "danger", text: e instanceof Error ? e.message : fr.errors.generic });
    }
  }

  const clientField = (key: ClientKey, label: string, warning?: string | null) => (
    <TextField label={label} value={client[key]} onChange={(v) => setClient((c) => ({ ...c, [key]: v }))} warning={warning} />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">
          {fr.docType[initial.type]} <span className="text-sm font-normal text-muted">({fr.status.draft})</span>
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onPreview} disabled={!draft || !business}>Aperçu PDF</Button>
          <Button variant="danger" onClick={onDelete}>{fr.doc.deleteDraft}</Button>
          <Button variant="primary" onClick={onFinalize} disabled={!draft || busy || Boolean(totalsError)}>
            {fr.doc.finalize}
          </Button>
        </div>
      </div>

      {!business && <Notice tone="warn">{fr.dashboard.setupFirst}</Notice>}
      {status && <Notice tone={status.tone}>{status.text}</Notice>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={initial.type === "facture" ? fr.fields.client : `${fr.doc.received} (facultatif)`}>
          {clients && clients.length > 0 && (
            <div className="mb-3">
              <SelectField
                label={fr.doc.fromClient}
                value=""
                options={[{ value: "", label: "—" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
                onChange={pickClient}
              />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {clientField("name", fr.fields.name)}
            {clientField("address", fr.fields.address)}
            {clientField("phone", fr.fields.phone)}
            {clientField("email", fr.fields.email)}
            {initial.type === "facture" && (
              <>
                {clientField("nif", fr.fields.nif, checkNif(client.nif))}
                {clientField("nis", fr.fields.nis, checkNis(client.nis))}
                {clientField("rc", fr.fields.rc)}
                {clientField("articleImposition", fr.fields.articleImposition, checkArticleImposition(client.articleImposition))}
              </>
            )}
          </div>
        </Card>

        <Card title="Informations">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label={fr.fields.issueDate} type="date" value={meta.issueDate} onChange={(v) => setMeta((m) => ({ ...m, issueDate: v }))} error={dateValid ? null : fr.errors.required} required />
            {initial.type === "facture" && (
              <TextField label={fr.fields.dueDate} type="date" value={meta.dueDate} onChange={(v) => setMeta((m) => ({ ...m, dueDate: v }))} />
            )}
            <SelectField label={fr.fields.paymentMethod} value={meta.paymentMethod} options={paymentOptions} onChange={(v) => setMeta((m) => ({ ...m, paymentMethod: v }))} />
          </div>
          <div className="mt-3">
            <Checkbox
              label={fr.fields.applyTimbre}
              checked={meta.applyTimbre}
              disabled={meta.paymentMethod !== "especes"}
              onChange={(v) => setMeta((m) => ({ ...m, applyTimbre: v }))}
              hint={fr.doc.timbreHint}
            />
          </div>
          <div className="mt-3">
            <TextArea label={fr.fields.notes} value={meta.notes} onChange={(v) => setMeta((m) => ({ ...m, notes: v }))} maxLength={1000} />
          </div>
        </Card>
      </div>

      <Card
        title="Lignes"
        actions={
          <div className="flex flex-wrap items-end gap-2">
            {products && products.length > 0 && (
              <SelectField
                label={fr.doc.fromProduct}
                value=""
                options={[{ value: "", label: "—" }, ...products.map((p) => ({ value: p.id, label: p.designation }))]}
                onChange={pickProduct}
              />
            )}
            <Button onClick={() => addLine()}>{fr.doc.addLine}</Button>
          </div>
        }
      >
        {lines.length === 0 && <p className="text-sm text-muted">{fr.doc.emptyLines}</p>}
        <div className="flex flex-col gap-3">
          {lines.map((l, i) => {
            const errors = parsed[i].errors;
            return (
              <div key={l.key} className="grid items-start gap-2 border-b border-border pb-3 sm:grid-cols-12">
                <div className="sm:col-span-4">
                  <TextField label={fr.fields.designation} value={l.designation} onChange={(v) => updateLine(l.key, { designation: v })} maxLength={300} />
                </div>
                <div className="sm:col-span-1">
                  <TextField label={fr.fields.unit} value={l.unit} onChange={(v) => updateLine(l.key, { unit: v })} maxLength={20} />
                </div>
                <div className="sm:col-span-1">
                  <TextField label={fr.fields.quantity} value={l.quantity} onChange={(v) => updateLine(l.key, { quantity: v })} inputMode="decimal" error={errors?.quantity ? fr.errors.quantity : null} />
                </div>
                <div className="sm:col-span-2">
                  <TextField label={fr.fields.unitPrice} value={l.unitPrice} onChange={(v) => updateLine(l.key, { unitPrice: v })} inputMode="decimal" error={errors?.unitPrice ? fr.errors.amount : null} />
                </div>
                <div className="sm:col-span-1">
                  <TextField label={fr.fields.discount} value={l.discount} onChange={(v) => updateLine(l.key, { discount: v })} inputMode="decimal" error={errors?.discount ? fr.errors.percent : null} />
                </div>
                <div className="sm:col-span-2">
                  <SelectField
                    label={fr.fields.tvaRate}
                    value={String(l.tvaRateBp) as `${TvaRateBp}`}
                    options={tvaOptions}
                    disabled={!tvaLiable}
                    onChange={(v) => updateLine(l.key, { tvaRateBp: Number(v) as TvaRateBp })}
                  />
                </div>
                <div className="flex items-end sm:col-span-1 sm:h-full">
                  <Button variant="danger" aria-label={`Supprimer la ligne ${i + 1}`} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                    ✕
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {totalsError && <Notice tone="danger">{totalsError}</Notice>}
      {totals && <TotalsPanel totals={totals} type={initial.type} />}
    </div>
  );
}
