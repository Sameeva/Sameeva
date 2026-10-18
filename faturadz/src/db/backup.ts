import { counterKey, type DocumentType } from "@/lib/numbering";
import type { FaturaDb } from "./index";
import { documentTotals } from "./repository";
import { BACKUP_FORMAT, BACKUP_VERSION, backupSchema, type Backup, type Counter } from "./schema";

/** Refuse backup files above this size before even parsing them. */
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export async function exportBackup(db: FaturaDb, now = new Date()): Promise<Backup> {
  return db.transaction("r", [db.settings, db.clients, db.products, db.documents, db.counters], async () => ({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    business: (await db.settings.get("business")) ?? null,
    clients: await db.clients.toArray(),
    products: await db.products.toArray(),
    documents: await db.documents.toArray(),
    counters: await db.counters.toArray(),
  }));
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

const NUMBER_RE = /^(FA|RE)-(\d{4})-(\d+)$/;
const TYPE_BY_PREFIX: Record<string, DocumentType> = { FA: "facture", RE: "recu" };

/**
 * Parses and validates a backup file's text. Nothing is written here.
 * Checks: size, JSON syntax, strict schema (unknown keys dropped), unique ids,
 * unique document numbers.
 */
export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: "Fichier trop volumineux." };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Le fichier n'est pas un JSON valide." };
  }
  const result = backupSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { ok: false, error: `Sauvegarde invalide (${issue.path.join(".") || "racine"} : ${issue.message}).` };
  }
  const backup = result.data;

  for (const [label, ids] of [
    ["clients", backup.clients.map((c) => c.id)],
    ["produits", backup.products.map((p) => p.id)],
    ["documents", backup.documents.map((d) => d.id)],
  ] as const) {
    if (new Set(ids).size !== ids.length) return { ok: false, error: `Identifiants en double (${label}).` };
  }
  const numbers = backup.documents.flatMap((d) => (d.status === "final" ? [d.number] : []));
  if (new Set(numbers).size !== numbers.length) return { ok: false, error: "Numéros de documents en double." };

  // Every document's totals must be computable (no overflow), so no page can crash on them.
  for (const doc of backup.documents) {
    try {
      documentTotals(doc);
    } catch {
      return { ok: false, error: "Sauvegarde invalide (montants hors limites)." };
    }
  }

  return { ok: true, backup };
}

/**
 * Counters never go below the highest number already used, so a restored
 * backup with stale counters can't make the app reissue an existing number.
 */
export function reconcileCounters(backup: Backup): Counter[] {
  const last = new Map(backup.counters.map((c) => [c.key, c.last]));
  for (const doc of backup.documents) {
    if (doc.status !== "final") continue;
    const match = NUMBER_RE.exec(doc.number);
    if (!match) continue;
    const key = counterKey(TYPE_BY_PREFIX[match[1]], Number(match[2]));
    last.set(key, Math.max(last.get(key) ?? 0, Number(match[3])));
  }
  return [...last].map(([key, value]) => ({ key, last: value }));
}

/** Replaces all local data with the backup, atomically. */
export async function restoreBackup(db: FaturaDb, backup: Backup): Promise<void> {
  const counters = reconcileCounters(backup);
  await db.replaceAll(async () => {
    if (backup.business) await db.settings.add(backup.business);
    await db.clients.bulkAdd(backup.clients);
    await db.products.bulkAdd(backup.products);
    await db.documents.bulkAdd(backup.documents);
    await db.counters.bulkAdd(counters);
  });
}
