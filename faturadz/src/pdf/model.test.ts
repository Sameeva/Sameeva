import { describe, expect, it } from "vitest";
import type { FinalDocument, SellerSnapshot } from "@/db/schema";
import { buildPdfModel, formatDateFr } from "./model";

const seller: SellerSnapshot = {
  name: "SARL Exemple",
  legalForm: "SARL",
  capitalCentimes: 10_000_000,
  activity: "",
  address: "Alger",
  phone: "",
  email: "",
  nif: "000016001234567",
  nis: "000016123456789",
  rc: "16/00-1234567 B 18",
  articleImposition: "16012345678",
  rib: "",
  bank: "",
  logo: null,
  tvaLiable: true,
  defaultTvaRateBp: 1900,
  footer: "Merci",
};

const final: FinalDocument = {
  id: "d1",
  type: "facture",
  status: "final",
  number: "FA-2026-0001",
  seller,
  finalizedAt: 1,
  issueDate: "2026-03-10",
  dueDate: null,
  client: { name: "Client SPA", address: "", phone: "", email: "", nif: "000016009876543", nis: "", rc: "", articleImposition: "" },
  lines: [{ designation: "Produit", unit: "u", quantityMilli: 2000, unitPriceCentimes: 1_000_000, discountBp: 0, tvaRateBp: 1900 }],
  paymentMethod: "especes",
  applyTimbre: true,
  notes: "",
  createdAt: 1,
  updatedAt: 1,
};

describe("buildPdfModel", () => {
  it("prints the legal identifiers, totals and amount in words", () => {
    const m = buildPdfModel(final, { ...seller, name: "Changed later" });
    expect(m.seller.name).toBe("SARL Exemple"); // frozen seller, not the current one
    expect(m.seller.ids).toEqual([
      ["NIF", "000016001234567"],
      ["NIS", "000016123456789"],
      ["RC", "16/00-1234567 B 18"],
      ["Art. imp.", "16012345678"],
    ]);
    expect(m.client?.ids).toEqual([["NIF", "000016009876543"]]);
    // 2 × 10 000 = 20 000 HT ; TVA 3 800 ; TTC 23 800 ; timbre 238 tranches × 1 DA = 238 DA
    expect(m.totals).toEqual([
      ["Total HT", "20 000,00 DA"],
      ["TVA 19 % (base 20 000,00)", "3 800,00 DA"],
      ["Total TTC", "23 800,00 DA"],
      ["Droit de timbre", "238,00 DA"],
    ]);
    expect(m.net).toEqual(["Net à payer", "24 038,00 DA"]);
    expect(m.inWords).toBe("Vingt-quatre mille trente-huit dinars algériens");
    expect(m.number).toBe("FA-2026-0001");
    expect(m.isDraft).toBe(false);
    expect(m.issueDate).toBe("10/03/2026");
  });

  it("marks drafts and uses the current seller for previews", () => {
    const draft = { ...final, status: "draft" as const, number: null, seller: null, finalizedAt: null };
    const m = buildPdfModel(draft, { ...seller, name: "Current", tvaLiable: false });
    expect(m.isDraft).toBe(true);
    expect(m.number).toBeNull();
    expect(m.seller.name).toBe("Current");
    expect(m.tvaNotice).toBe("Non assujetti à la TVA");
  });

  it("formats dates as DD/MM/YYYY", () => {
    expect(formatDateFr("2026-12-31")).toBe("31/12/2026");
  });
});
