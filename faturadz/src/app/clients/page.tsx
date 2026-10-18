"use client";

import { useState } from "react";
import { Button, Card, Notice, TextField } from "@/components/ui";
import { useDbQuery } from "@/components/useDb";
import { getDb } from "@/db";
import { newId, saveClient } from "@/db/repository";
import type { Client } from "@/db/schema";
import { fr } from "@/i18n/fr";
import { checkArticleImposition, checkNif, checkNis } from "@/lib/validators";

type EditableKey = "name" | "address" | "phone" | "email" | "nif" | "nis" | "rc" | "articleImposition";

const emptyClient = (): Client => ({
  id: newId(),
  name: "",
  address: "",
  phone: "",
  email: "",
  nif: "",
  nis: "",
  rc: "",
  articleImposition: "",
  createdAt: Date.now(),
});

function ClientForm({ initial, onDone }: { initial: Client; onDone: () => void }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const set = (key: EditableKey, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const field = (key: EditableKey, warning?: string | null) => (
    <TextField label={fr.fields[key]} value={form[key]} onChange={(v) => set(key, v)} warning={warning} />
  );
  const nameError = form.name.trim() === "" ? fr.errors.required : null;

  async function onSave() {
    if (nameError) return;
    try {
      await saveClient(getDb(), form);
      onDone();
    } catch {
      setError(fr.errors.generic);
    }
  }

  return (
    <Card title={initial.name ? initial.name : "Nouveau client"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label={fr.fields.name} value={form.name} onChange={(v) => set("name", v)} error={nameError} required />
        {field("address")}
        {field("phone")}
        {field("email")}
        {field("nif", checkNif(form.nif))}
        {field("nis", checkNis(form.nis))}
        {field("rc")}
        {field("articleImposition", checkArticleImposition(form.articleImposition))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={onSave} disabled={Boolean(nameError)}>
          {fr.common.save}
        </Button>
        <Button onClick={onDone}>{fr.common.cancel}</Button>
      </div>
      {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
    </Card>
  );
}

export default function ClientsPage() {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const clients = useDbQuery((db) => db.clients.orderBy("name").toArray());

  const q = query.trim().toLowerCase();
  const visible = (clients ?? []).filter((c) => !q || c.name.toLowerCase().includes(q) || c.nif.includes(q));

  async function onDelete(c: Client) {
    if (window.confirm(fr.common.confirmDelete)) await getDb().clients.delete(c.id);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{fr.nav.clients}</h1>
        <Button variant="primary" onClick={() => setEditing(emptyClient())}>
          {fr.common.add}
        </Button>
      </div>
      {editing && <ClientForm key={editing.id} initial={editing} onDone={() => setEditing(null)} />}
      <TextField label={fr.common.search} value={query} onChange={setQuery} type="search" />
      {clients && visible.length === 0 && <p className="text-sm text-muted">{fr.common.none}</p>}
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {visible.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted">{[c.address, c.nif && `NIF ${c.nif}`].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setEditing(c)}>{fr.common.edit}</Button>
              <Button variant="danger" onClick={() => onDelete(c)}>
                {fr.common.delete}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
