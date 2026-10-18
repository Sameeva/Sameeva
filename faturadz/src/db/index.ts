import Dexie, { type EntityTable, type Transaction } from "dexie";
import type { Business, Client, Counter, InvoiceDocument, Product } from "./schema";

const TABLES = ["settings", "clients", "products", "documents", "counters"] as const;

export class FaturaDb extends Dexie {
  settings!: EntityTable<Business, "id">;
  clients!: EntityTable<Client, "id">;
  products!: EntityTable<Product, "id">;
  documents!: EntityTable<InvoiceDocument, "id">;
  counters!: EntityTable<Counter, "key">;

  /** Transactions allowed to replace finalized documents: only full backup restores. */
  private readonly restoreTransactions = new WeakSet<Transaction>();

  constructor(name = "faturadz") {
    super(name);
    this.version(1).stores({
      settings: "id",
      clients: "id, name",
      products: "id, designation",
      documents: "id, type, status, number, issueDate, updatedAt",
      counters: "key",
    });

    // A finalized document is a legal record: refuse any change or deletion,
    // except inside a full restore (see replaceAll).
    this.documents.hook("updating", (_mods, _key, current, tx) => {
      if (current.status === "final" && !this.restoreTransactions.has(tx)) {
        throw new Error("Un document finalisé ne peut pas être modifié.");
      }
    });
    this.documents.hook("deleting", (_key, current, tx) => {
      if (current.status === "final" && !this.restoreTransactions.has(tx)) {
        throw new Error("Un document finalisé ne peut pas être supprimé.");
      }
    });
  }

  /**
   * Runs `fill` in one transaction after emptying every table. The only code
   * path allowed to remove finalized documents (backup restore).
   */
  async replaceAll(fill: () => Promise<void>): Promise<void> {
    await this.transaction("rw", [...TABLES], async (tx) => {
      this.restoreTransactions.add(tx);
      for (const table of TABLES) await this.table(table).clear();
      await fill();
    });
  }
}

let instance: FaturaDb | null = null;

/** The app database (created lazily so nothing touches IndexedDB during server rendering). */
export function getDb(): FaturaDb {
  instance ??= new FaturaDb();
  return instance;
}
