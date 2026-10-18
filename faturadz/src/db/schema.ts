import { z } from "zod";
import { TVA_RATES_BP } from "@/lib/fiscal-config";
import { MAX_QUANTITY_MILLI, MAX_UNIT_PRICE_CENTIMES } from "@/lib/money";

/**
 * Shape of everything stored in the browser. These schemas validate data
 * coming from outside the app (backup import) and from forms before saving.
 * z.object strips unknown keys, so extra/hostile properties (e.g. "__proto__")
 * never reach the database.
 */

const text = (max: number) => z.string().trim().max(max);
const centimes = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const id = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
const isoDate = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
const timestamp = z.number().int().nonnegative();
export const tvaRate = z.union(TVA_RATES_BP.map((r) => z.literal(r)) as [z.ZodLiteral<1900>, z.ZodLiteral<900>, z.ZodLiteral<0>]);

/** PNG or JPEG data URL only (never SVG: it can carry scripts). ~1 MB max. */
export const MAX_LOGO_DATA_URL_LENGTH = 1_400_000;
export const logoDataUrl = z
  .string()
  .max(MAX_LOGO_DATA_URL_LENGTH)
  .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/);

export const legalIds = {
  nif: text(30),
  nis: text(30),
  rc: text(40),
  articleImposition: text(30),
};

export const businessSchema = z.object({
  id: z.literal("business"),
  name: text(120).min(1),
  legalForm: text(40),
  capitalCentimes: centimes.nullable(),
  activity: text(160),
  address: text(240),
  phone: text(40),
  email: text(120),
  ...legalIds,
  rib: text(40),
  bank: text(80),
  logo: logoDataUrl.nullable(),
  tvaLiable: z.boolean(),
  defaultTvaRateBp: tvaRate,
  footer: text(500),
});
export type Business = z.infer<typeof businessSchema>;

export const clientSchema = z.object({
  id,
  name: text(120).min(1),
  address: text(240),
  phone: text(40),
  email: text(120),
  ...legalIds,
  createdAt: timestamp,
});
export type Client = z.infer<typeof clientSchema>;

export const productSchema = z.object({
  id,
  designation: text(200).min(1),
  unit: text(20),
  unitPriceCentimes: centimes.max(MAX_UNIT_PRICE_CENTIMES),
  tvaRateBp: tvaRate,
  createdAt: timestamp,
});
export type Product = z.infer<typeof productSchema>;

/** Drafts may hold unfinished lines; finalDocumentSchema requires a designation. */
export const documentLineSchema = z.object({
  designation: text(300),
  unit: text(20),
  quantityMilli: z.number().int().positive().max(MAX_QUANTITY_MILLI),
  unitPriceCentimes: centimes.max(MAX_UNIT_PRICE_CENTIMES),
  discountBp: z.number().int().min(0).max(10000),
  tvaRateBp: tvaRate,
});
export type DocumentLine = z.infer<typeof documentLineSchema>;

export const paymentMethodSchema = z.enum(["especes", "cheque", "virement", "carte", "autre"]);

/**
 * Client as printed on the document (copied, so later edits don't change it).
 * The name may be empty on drafts and receipts; finalizing an invoice requires it.
 */
export const clientSnapshotSchema = clientSchema.omit({ id: true, createdAt: true }).extend({ name: text(120) });
export type ClientSnapshot = z.infer<typeof clientSnapshotSchema>;

/** Seller as printed on the document, frozen at finalization. */
export const sellerSnapshotSchema = businessSchema.omit({ id: true });
export type SellerSnapshot = z.infer<typeof sellerSnapshotSchema>;

const documentBase = {
  id,
  type: z.enum(["facture", "recu"]),
  issueDate: isoDate,
  dueDate: isoDate.nullable(),
  client: clientSnapshotSchema,
  lines: z.array(documentLineSchema).max(500),
  paymentMethod: paymentMethodSchema,
  applyTimbre: z.boolean(),
  notes: text(1000),
  createdAt: timestamp,
  updatedAt: timestamp,
};

export const draftDocumentSchema = z.object({
  ...documentBase,
  status: z.literal("draft"),
  number: z.null(),
  seller: z.null(),
  finalizedAt: z.null(),
});

export const finalDocumentSchema = z.object({
  ...documentBase,
  status: z.literal("final"),
  number: text(40).min(1),
  seller: sellerSnapshotSchema,
  lines: z.array(documentLineSchema.extend({ designation: text(300).min(1) })).min(1).max(500),
  finalizedAt: timestamp,
});

export const documentSchema = z.discriminatedUnion("status", [draftDocumentSchema, finalDocumentSchema]);
export type InvoiceDocument = z.infer<typeof documentSchema>;
export type DraftDocument = z.infer<typeof draftDocumentSchema>;
export type FinalDocument = z.infer<typeof finalDocumentSchema>;

export const counterSchema = z.object({
  key: z.string().regex(/^(facture|recu)-\d{4}$/),
  last: z.number().int().nonnegative(),
});
export type Counter = z.infer<typeof counterSchema>;

export const BACKUP_FORMAT = "faturadz-backup";
export const BACKUP_VERSION = 1;

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string().max(40),
  business: businessSchema.nullable(),
  clients: z.array(clientSchema).max(10_000),
  products: z.array(productSchema).max(10_000),
  documents: z.array(documentSchema).max(50_000),
  counters: z.array(counterSchema).max(1_000),
});
export type Backup = z.infer<typeof backupSchema>;
