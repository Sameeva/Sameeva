"use client";

import { useState } from "react";
import { tvaOptions } from "@/components/BusinessForm";
import { Button, Card, Notice, SelectField, TextField } from "@/components/ui";
import { useDbQuery } from "@/components/useDb";
import { getDb } from "@/db";
import { newId, saveProduct } from "@/db/repository";
import type { Product } from "@/db/schema";
import { fr } from "@/i18n/fr";
import type { TvaRateBp } from "@/lib/fiscal-config";
import { MAX_UNIT_PRICE_CENTIMES, amountToInput, formatDA, formatPercent, parseAmount } from "@/lib/money";

function ProductForm({ initial, defaultRate, onDone }: { initial: Product | null; defaultRate: TvaRateBp; onDone: () => void }) {
  const [designation, setDesignation] = useState(initial?.designation ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [price, setPrice] = useState(initial ? amountToInput(initial.unitPriceCentimes) : "");
  const [rate, setRate] = useState<TvaRateBp>(initial?.tvaRateBp ?? defaultRate);
  const [error, setError] = useState<string | null>(null);

  const designationError = designation.trim() === "" ? fr.errors.required : null;
  const priceCentimes = parseAmount(price, MAX_UNIT_PRICE_CENTIMES);
  const priceError = priceCentimes === null ? fr.errors.amount : null;

  async function onSave() {
    if (designationError || priceCentimes === null) return;
    try {
      await saveProduct(getDb(), {
        id: initial?.id ?? newId(),
        designation,
        unit,
        unitPriceCentimes: priceCentimes,
        tvaRateBp: rate,
        createdAt: initial?.createdAt ?? Date.now(),
      });
      onDone();
    } catch {
      setError(fr.errors.generic);
    }
  }

  return (
    <Card title={initial ? initial.designation : "Nouveau produit"}>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <TextField label={fr.fields.designation} value={designation} onChange={setDesignation} error={designationError} required />
        </div>
        <TextField label={fr.fields.unit} value={unit} onChange={setUnit} placeholder="u, kg, h…" />
        <TextField label={fr.fields.unitPrice} value={price} onChange={setPrice} error={price === "" ? null : priceError} inputMode="decimal" />
        <SelectField
          label={fr.fields.tvaRate}
          value={String(rate) as `${TvaRateBp}`}
          options={tvaOptions}
          onChange={(v) => setRate(Number(v) as TvaRateBp)}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={onSave} disabled={Boolean(designationError || priceError)}>
          {fr.common.save}
        </Button>
        <Button onClick={onDone}>{fr.common.cancel}</Button>
      </div>
      {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
    </Card>
  );
}

export default function ProductsPage() {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ key: string; product: Product | null } | null>(null);
  const products = useDbQuery((db) => db.products.orderBy("designation").toArray());
  const business = useDbQuery((db) => db.settings.get("business"));
  const defaultRate: TvaRateBp = business ? (business.tvaLiable ? business.defaultTvaRateBp : 0) : 1900;

  const q = query.trim().toLowerCase();
  const visible = (products ?? []).filter((p) => !q || p.designation.toLowerCase().includes(q));

  async function onDelete(p: Product) {
    if (window.confirm(fr.common.confirmDelete)) await getDb().products.delete(p.id);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{fr.nav.products}</h1>
        <Button variant="primary" onClick={() => setEditing({ key: newId(), product: null })}>
          {fr.common.add}
        </Button>
      </div>
      {editing && <ProductForm key={editing.key} initial={editing.product} defaultRate={defaultRate} onDone={() => setEditing(null)} />}
      <TextField label={fr.common.search} value={query} onChange={setQuery} type="search" />
      {products && visible.length === 0 && <p className="text-sm text-muted">{fr.common.none}</p>}
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {visible.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="font-medium">{p.designation}</p>
              <p className="text-xs text-muted">
                {formatDA(p.unitPriceCentimes)} HT{p.unit && ` / ${p.unit}`} · TVA {formatPercent(p.tvaRateBp)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setEditing({ key: p.id, product: p })}>{fr.common.edit}</Button>
              <Button variant="danger" onClick={() => onDelete(p)}>
                {fr.common.delete}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
