import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FaturaDb } from "./index";
import { exportBackup, parseBackup, reconcileCounters, restoreBackup } from "./backup";
import { deleteDraft, duplicateAsDraft, finalizeDocument, newDraft, saveBusiness, saveDraft } from "./repository";
import type { Business, DraftDocument } from "./schema";

const business: Business = {
  id: "business",
  name: "SARL Exemple",
  legalForm: "SARL",
  capitalCentimes: 10_000_000,
  activity: "Commerce",
  address: "Alger",
  phone: "",
  email: "",
  nif: "000016001234567",
  nis: "",
  rc: "16/00-1234567 B 18",
  articleImposition: "16012345678",
  rib: "",
  bank: "",
  logo: null,
  tvaLiable: true,
  defaultTvaRateBp: 1900,
  footer: "",
};

const draftWith = (over: Partial<DraftDocument> = {}): DraftDocument => ({
  ...newDraft("facture"),
  issueDate: "2026-03-10",
  client: { name: "Client SPA", address: "", phone: "", email: "", nif: "", nis: "", rc: "", articleImposition: "" },
  lines: [{ designation: "Produit", unit: "u", quantityMilli: 1000, unitPriceCentimes: 100000, discountBp: 0, tvaRateBp: 1900 }],
  ...over,
});

let db: FaturaDb;
let n = 0;

beforeEach(async () => {
  db = new FaturaDb(`test-${n++}`);
  await saveBusiness(db, business);
});
afterEach(async () => {
  await db.delete();
});

describe("finalizeDocument", () => {
  it("assigns sequential numbers per type and year", async () => {
    const a = await saveDraft(db, draftWith());
    const b = await saveDraft(db, draftWith());
    const r = await saveDraft(db, draftWith({ type: "recu" }));
    const nextYear = await saveDraft(db, draftWith({ issueDate: "2027-01-02" }));

    expect((await finalizeDocument(db, a.id)).number).toBe("FA-2026-0001");
    expect((await finalizeDocument(db, b.id)).number).toBe("FA-2026-0002");
    expect((await finalizeDocument(db, r.id)).number).toBe("RE-2026-0001");
    expect((await finalizeDocument(db, nextYear.id)).number).toBe("FA-2027-0001");
  });

  it("never gives the same number to concurrent finalizations", async () => {
    const drafts = await Promise.all([1, 2, 3, 4, 5].map(() => saveDraft(db, draftWith())));
    const finals = await Promise.all(drafts.map((d) => finalizeDocument(db, d.id)));
    expect(new Set(finals.map((f) => f.number)).size).toBe(5);
  });

  it("freezes the seller details", async () => {
    const d = await saveDraft(db, draftWith());
    const final = await finalizeDocument(db, d.id);
    await saveBusiness(db, { ...business, name: "Nouveau nom" });
    expect((await db.documents.get(final.id))?.seller?.name).toBe("SARL Exemple");
  });

  it("refuses empty documents, invoices without client and missing business", async () => {
    const empty = await saveDraft(db, draftWith({ lines: [] }));
    await expect(finalizeDocument(db, empty.id)).rejects.toThrow(/au moins une ligne/);

    const noClient = await saveDraft(db, draftWith({ client: { ...draftWith().client, name: "" } }));
    await expect(finalizeDocument(db, noClient.id)).rejects.toThrow(/client/);

    await db.settings.clear();
    const ok = await saveDraft(db, draftWith());
    await expect(finalizeDocument(db, ok.id)).rejects.toThrow(/entreprise/);
    expect(await db.counters.count()).toBe(0); // no number consumed on failure
  });

  it("lets unfinished drafts be saved but refuses to finalize blank lines", async () => {
    const blank = { ...draftWith().lines[0], designation: "" };
    const d = await saveDraft(db, draftWith({ client: { ...draftWith().client, name: "" }, lines: [blank] }));
    await expect(finalizeDocument(db, d.id)).rejects.toThrow();
    const r = await saveDraft(db, draftWith({ type: "recu", client: { ...draftWith().client, name: "" }, lines: [blank] }));
    await expect(finalizeDocument(db, r.id)).rejects.toThrow(/désignation/);
  });

  it("keeps numbers in date order", async () => {
    await finalizeDocument(db, (await saveDraft(db, draftWith({ issueDate: "2026-03-01" }))).id);
    const earlier = await saveDraft(db, draftWith({ issueDate: "2026-01-15" }));
    await expect(finalizeDocument(db, earlier.id)).rejects.toThrow(/01\/03\/2026/);
    const lastYear = await saveDraft(db, draftWith({ issueDate: "2025-12-31" }));
    await expect(finalizeDocument(db, lastYear.id)).rejects.toThrow(/antérieure/);
    const sameDay = await saveDraft(db, draftWith({ issueDate: "2026-03-01" }));
    expect((await finalizeDocument(db, sameDay.id)).number).toBe("FA-2026-0002");
    // receipts have their own sequence and dates
    const receipt = await saveDraft(db, draftWith({ type: "recu", issueDate: "2026-01-15" }));
    expect((await finalizeDocument(db, receipt.id)).number).toBe("RE-2026-0001");
  });

  it("explains out-of-range amounts in French", async () => {
    const big = { ...draftWith().lines[0], quantityMilli: 1_000_000_000, unitPriceCentimes: 10_000_000_000_000 };
    const d = await saveDraft(db, draftWith({ lines: [big] }));
    await expect(finalizeDocument(db, d.id)).rejects.toThrow(/Montants trop élevés/);
  });

  it("refuses TVA lines when the business is not liable to TVA", async () => {
    await saveBusiness(db, { ...business, tvaLiable: false });
    const d = await saveDraft(db, draftWith());
    await expect(finalizeDocument(db, d.id)).rejects.toThrow(/assujettie/);
  });
});

describe("finalized documents are immutable", () => {
  it("cannot be saved over, modified or deleted", async () => {
    const d = await saveDraft(db, draftWith());
    const final = await finalizeDocument(db, d.id);

    await expect(saveDraft(db, { ...d, notes: "changed" })).rejects.toThrow();
    await expect(db.documents.update(final.id, { notes: "changed" })).rejects.toThrow();
    await expect(deleteDraft(db, final.id)).rejects.toThrow();
    await expect(finalizeDocument(db, final.id)).rejects.toThrow(/déjà/);
    expect((await db.documents.get(final.id))?.notes).toBe("");
  });

  it("can be duplicated into a new draft", async () => {
    const final = await finalizeDocument(db, (await saveDraft(db, draftWith())).id);
    const copy = duplicateAsDraft(final);
    expect(copy.id).not.toBe(final.id);
    expect(copy.status).toBe("draft");
    expect(copy.number).toBeNull();
    expect(copy.lines).toEqual(final.lines);
    copy.lines[0].designation = "edited";
    expect(final.lines[0].designation).toBe("Produit");
  });
});

describe("backup", () => {
  it("round-trips all data", async () => {
    await finalizeDocument(db, (await saveDraft(db, draftWith())).id);
    await saveDraft(db, draftWith());
    const backup = await exportBackup(db);

    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const other = new FaturaDb(`restore-${n++}`);
    await restoreBackup(other, parsed.backup);
    expect(await exportBackup(other, new Date(backup.exportedAt))).toEqual(backup);
    await other.delete();
  });

  it("restores over a database that already holds finalized documents", async () => {
    await finalizeDocument(db, (await saveDraft(db, draftWith())).id);
    const backup = await exportBackup(db);
    await finalizeDocument(db, (await saveDraft(db, draftWith())).id); // 2 finals now
    await restoreBackup(db, backup);
    expect(await db.documents.count()).toBe(1);
    // the immutability guard still applies after the restore
    const [final] = await db.documents.toArray();
    await expect(db.documents.delete(final.id)).rejects.toThrow();
  });

  it("rejects documents whose totals would overflow", async () => {
    const backup = await exportBackup(db);
    backup.documents.push({ ...draftWith(), lines: [{ ...draftWith().lines[0], quantityMilli: 1_000_000_000, unitPriceCentimes: 10_000_000_000_000 }] });
    const result = parseBackup(JSON.stringify(backup));
    expect(result.ok).toBe(false);
  });

  it("rejects invalid JSON, wrong format and bad values", () => {
    expect(parseBackup("{not json").ok).toBe(false);
    expect(parseBackup(JSON.stringify({ format: "other" })).ok).toBe(false);
    const bad = { format: "faturadz-backup", version: 1, exportedAt: "", business: null, clients: [], products: [], documents: [], counters: [{ key: "x", last: -1 }] };
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false);
  });

  it("drops unknown and __proto__ keys instead of storing them", async () => {
    const backup = await exportBackup(db);
    const text = JSON.stringify(backup).replace('"id":"business"', '"id":"business","__proto__":{"polluted":true},"extra":"x"');
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(Object.keys(parsed.backup.business!)).not.toContain("extra");
    expect(Object.prototype.hasOwnProperty.call(parsed.backup.business, "__proto__")).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("rejects SVG or script logos", async () => {
    const backup = await exportBackup(db);
    backup.business!.logo = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=";
    expect(parseBackup(JSON.stringify(backup)).ok).toBe(false);
    backup.business!.logo = "javascript:alert(1)";
    expect(parseBackup(JSON.stringify(backup)).ok).toBe(false);
  });

  it("rejects duplicate document numbers", async () => {
    const final = await finalizeDocument(db, (await saveDraft(db, draftWith())).id);
    const backup = await exportBackup(db);
    backup.documents.push({ ...final, id: "other-id" });
    const result = parseBackup(JSON.stringify(backup));
    expect(result.ok).toBe(false);
  });

  it("raises stale counters to the highest number used", async () => {
    const final = await finalizeDocument(db, (await saveDraft(db, draftWith())).id);
    const backup = await exportBackup(db);
    backup.documents.push({ ...final, id: "other", number: "FA-2026-0007" });
    backup.counters = [];
    expect(reconcileCounters(backup)).toEqual([{ key: "facture-2026", last: 7 }]);
  });
});
