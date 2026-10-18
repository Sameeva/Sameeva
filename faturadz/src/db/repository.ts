import { computeTotals, type Totals } from "@/lib/tax";
import { counterKey, formatDocumentNumber, yearOfIsoDate, type DocumentType } from "@/lib/numbering";
import type { FaturaDb } from "./index";
import {
  businessSchema,
  clientSchema,
  draftDocumentSchema,
  finalDocumentSchema,
  productSchema,
  sellerSnapshotSchema,
  type Business,
  type Client,
  type ClientSnapshot,
  type DraftDocument,
  type FinalDocument,
  type InvoiceDocument,
  type Product,
  type SellerSnapshot,
} from "./schema";

export function newId(): string {
  return crypto.randomUUID();
}

/** Today's date as YYYY-MM-DD in the user's local time zone. */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const emptyClient = (): ClientSnapshot => ({
  name: "",
  address: "",
  phone: "",
  email: "",
  nif: "",
  nis: "",
  rc: "",
  articleImposition: "",
});

export function documentTotals(doc: Pick<InvoiceDocument, "lines" | "paymentMethod" | "applyTimbre">): Totals {
  return computeTotals(doc.lines, { paymentMethod: doc.paymentMethod, applyTimbre: doc.applyTimbre });
}

// ---------- business profile ----------

export async function saveBusiness(db: FaturaDb, business: Business): Promise<void> {
  await db.settings.put(businessSchema.parse(business));
}

export async function getBusiness(db: FaturaDb): Promise<Business | undefined> {
  return db.settings.get("business");
}

// ---------- clients & products ----------

export async function saveClient(db: FaturaDb, client: Client): Promise<void> {
  await db.clients.put(clientSchema.parse(client));
}

export async function saveProduct(db: FaturaDb, product: Product): Promise<void> {
  await db.products.put(productSchema.parse(product));
}

// ---------- documents ----------

export function newDraft(type: DocumentType, now = Date.now()): DraftDocument {
  return {
    id: newId(),
    type,
    status: "draft",
    number: null,
    seller: null,
    finalizedAt: null,
    issueDate: todayIso(new Date(now)),
    dueDate: null,
    client: emptyClient(),
    lines: [],
    paymentMethod: "especes",
    applyTimbre: true,
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

export async function saveDraft(db: FaturaDb, draft: DraftDocument): Promise<DraftDocument> {
  const parsed = draftDocumentSchema.parse({ ...draft, updatedAt: Date.now() });
  await db.transaction("rw", db.documents, async () => {
    const existing = await db.documents.get(parsed.id);
    if (existing?.status === "final") throw new Error("Un document finalisé ne peut pas être modifié.");
    await db.documents.put(parsed);
  });
  return parsed;
}

export async function deleteDraft(db: FaturaDb, id: string): Promise<void> {
  await db.documents.delete(id); // the "deleting" hook refuses final documents
}

/** The business profile as printed on a document (validated, without its id). */
export function sellerFromBusiness(business: Business): SellerSnapshot {
  return sellerSnapshotSchema.parse(business);
}

async function latestFinalIssueDate(db: FaturaDb, type: DocumentType): Promise<string | null> {
  let latest: string | null = null;
  await db.documents.where("type").equals(type).each((d) => {
    if (d.status === "final" && (latest === null || d.issueDate > latest)) latest = d.issueDate;
  });
  return latest;
}

/**
 * Finalizes a draft: assigns the next number for its type and year, freezes the
 * seller details, and locks the document. All in one transaction so two tabs
 * can never get the same number.
 */
export async function finalizeDocument(db: FaturaDb, id: string): Promise<FinalDocument> {
  return db.transaction("rw", [db.documents, db.counters, db.settings], async () => {
    const doc = await db.documents.get(id);
    if (!doc) throw new Error("Document introuvable.");
    if (doc.status === "final") throw new Error("Ce document est déjà finalisé.");
    if (doc.lines.length === 0) throw new Error("Ajoutez au moins une ligne avant de finaliser.");
    if (doc.lines.some((l) => l.designation.trim() === "")) {
      throw new Error("Chaque ligne doit avoir une désignation.");
    }
    if (doc.type === "facture" && doc.client.name.trim() === "") {
      throw new Error("Le nom du client est obligatoire sur une facture.");
    }

    const business = await db.settings.get("business");
    if (!business) throw new Error("Renseignez d'abord les informations de votre entreprise (Paramètres).");

    if (!business.tvaLiable && doc.lines.some((l) => l.tvaRateBp !== 0)) {
      throw new Error("Votre entreprise n'est pas assujettie à la TVA : toutes les lignes doivent être à 0 %.");
    }

    try {
      documentTotals(doc);
    } catch {
      throw new Error("Montants trop élevés : vérifiez les quantités et les prix.");
    }

    // Numbers must follow the dates: refuse a date earlier than the last finalized document of this type.
    const lastDate = await latestFinalIssueDate(db, doc.type);
    if (lastDate && doc.issueDate < lastDate) {
      const [y, m, d] = lastDate.split("-");
      throw new Error(`La date ne peut pas être antérieure à celle du dernier document finalisé (${d}/${m}/${y}).`);
    }

    const year = yearOfIsoDate(doc.issueDate);
    const key = counterKey(doc.type, year);
    const counter = await db.counters.get(key);
    const sequence = (counter?.last ?? 0) + 1;
    const number = formatDocumentNumber(doc.type, year, sequence);

    if (await db.documents.where("number").equals(number).count()) {
      throw new Error(`Le numéro ${number} existe déjà.`);
    }

    const final = finalDocumentSchema.parse({
      ...doc,
      status: "final",
      number,
      seller: sellerFromBusiness(business),
      finalizedAt: Date.now(),
      updatedAt: Date.now(),
    });

    await db.counters.put({ key, last: sequence });
    await db.documents.put(final);
    return final;
  });
}

/** Copy of any document (final or draft) as a new draft dated today. */
export function duplicateAsDraft(doc: InvoiceDocument, now = Date.now()): DraftDocument {
  return {
    ...newDraft(doc.type, now),
    client: { ...doc.client },
    lines: doc.lines.map((l) => ({ ...l })),
    paymentMethod: doc.paymentMethod,
    applyTimbre: doc.applyTimbre,
    notes: doc.notes,
  };
}
