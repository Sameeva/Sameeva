"use client";

import { useState, type ChangeEvent } from "react";
import { getDb } from "@/db";
import { saveBusiness } from "@/db/repository";
import type { Business } from "@/db/schema";
import { fr } from "@/i18n/fr";
import { TVA_RATES_BP, type TvaRateBp } from "@/lib/fiscal-config";
import { processLogo } from "@/lib/logo";
import { amountToInput, parseAmount } from "@/lib/money";
import { checkArticleImposition, checkNif, checkNis, checkRib } from "@/lib/validators";
import { Button, Card, Checkbox, Notice, SelectField, TextArea, TextField } from "./ui";

type TextKey = "name" | "legalForm" | "activity" | "address" | "phone" | "email" | "nif" | "nis" | "rc" | "articleImposition" | "rib" | "bank";

const emptyBusiness = (): Business => ({
  id: "business",
  name: "",
  legalForm: "",
  capitalCentimes: null,
  activity: "",
  address: "",
  phone: "",
  email: "",
  nif: "",
  nis: "",
  rc: "",
  articleImposition: "",
  rib: "",
  bank: "",
  logo: null,
  tvaLiable: true,
  defaultTvaRateBp: 1900,
  footer: "",
});

export const tvaOptions = TVA_RATES_BP.map((r) => ({ value: String(r) as `${TvaRateBp}`, label: fr.tva[r] }));

export function BusinessForm({ initial }: { initial: Business | null }) {
  const [form, setForm] = useState<Business>(initial ?? emptyBusiness());
  const [capital, setCapital] = useState(initial?.capitalCentimes != null ? amountToInput(initial.capitalCentimes) : "");
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const set = <K extends keyof Business>(key: K, value: Business[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setMessage(null);
  };
  const textField = (key: TextKey, extra: { warning?: string | null; inputMode?: "numeric" | "email" | "tel"; required?: boolean } = {}) => (
    <TextField label={fr.fields[key]} value={form[key]} onChange={(v) => set(key, v)} warning={extra.warning} inputMode={extra.inputMode} required={extra.required} />
  );

  const capitalError = capital.trim() !== "" && parseAmount(capital) === null ? fr.errors.amount : null;
  const nameError = form.name.trim() === "" ? fr.errors.required : null;

  async function onLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const result = await processLogo(file);
    if (result.ok) set("logo", result.dataUrl);
    else setMessage({ tone: "danger", text: { type: fr.errors.logoType, size: fr.errors.logoSize, read: fr.errors.logoRead }[result.error] });
  }

  async function onSave() {
    if (nameError || capitalError) return;
    const business: Business = {
      ...form,
      capitalCentimes: capital.trim() === "" ? null : parseAmount(capital),
      defaultTvaRateBp: form.tvaLiable ? form.defaultTvaRateBp : 0,
    };
    try {
      await saveBusiness(getDb(), business);
      setMessage({ tone: "success", text: fr.common.saved });
    } catch {
      setMessage({ tone: "danger", text: fr.errors.generic });
    }
  }

  return (
    <Card title="Mon entreprise">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label={fr.fields.name} value={form.name} onChange={(v) => set("name", v)} error={nameError} required />
        {textField("legalForm")}
        <TextField label={fr.fields.capital} value={capital} onChange={(v) => { setCapital(v); setMessage(null); }} error={capitalError} inputMode="decimal" />
        {textField("activity")}
        {textField("address")}
        {textField("phone", { inputMode: "tel" })}
        {textField("email", { inputMode: "email" })}
        {textField("nif", { warning: checkNif(form.nif), inputMode: "numeric" })}
        {textField("nis", { warning: checkNis(form.nis), inputMode: "numeric" })}
        {textField("rc")}
        {textField("articleImposition", { warning: checkArticleImposition(form.articleImposition), inputMode: "numeric" })}
        {textField("rib", { warning: checkRib(form.rib), inputMode: "numeric" })}
        {textField("bank")}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Checkbox label={fr.fields.tvaLiable} hint={fr.fields.tvaLiableHint} checked={form.tvaLiable} onChange={(v) => set("tvaLiable", v)} />
        <SelectField
          label={fr.fields.defaultTva}
          value={String(form.defaultTvaRateBp) as `${TvaRateBp}`}
          options={tvaOptions}
          disabled={!form.tvaLiable}
          onChange={(v) => set("defaultTvaRateBp", Number(v) as TvaRateBp)}
        />
      </div>

      <div className="mt-4">
        <TextArea label={fr.fields.footer} value={form.footer} onChange={(v) => set("footer", v)} maxLength={500} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm">
          <span className="me-2 text-xs font-medium text-muted">{fr.fields.logo}</span>
          <input type="file" accept="image/png,image/jpeg" onChange={onLogo} className="text-sm" />
        </label>
        {form.logo && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URL, not optimizable */}
            <img src={form.logo} alt="Logo" className="h-12 w-auto rounded border border-border bg-white" />
            <Button variant="danger" onClick={() => set("logo", null)}>
              {fr.common.delete}
            </Button>
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={onSave} disabled={Boolean(nameError || capitalError)}>
          {fr.common.save}
        </Button>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </div>
    </Card>
  );
}
