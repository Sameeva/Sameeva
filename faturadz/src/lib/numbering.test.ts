import { describe, expect, it } from "vitest";
import { counterKey, formatDocumentNumber, yearOfIsoDate } from "./numbering";
import { checkArticleImposition, checkNif, checkNis, checkRib } from "./validators";

describe("numbering", () => {
  it("formats numbers per type and year", () => {
    expect(formatDocumentNumber("facture", 2026, 1)).toBe("FA-2026-0001");
    expect(formatDocumentNumber("recu", 2026, 42)).toBe("RE-2026-0042");
    expect(formatDocumentNumber("facture", 2026, 12345)).toBe("FA-2026-12345");
  });

  it("uses a separate counter per type and year", () => {
    expect(counterKey("facture", 2026)).not.toBe(counterKey("facture", 2027));
    expect(counterKey("facture", 2026)).not.toBe(counterKey("recu", 2026));
  });

  it("reads the year from the date string without time zone shifts", () => {
    expect(yearOfIsoDate("2026-12-31")).toBe(2026);
    expect(yearOfIsoDate("2027-01-01")).toBe(2027);
    expect(() => yearOfIsoDate("31/12/2026")).toThrow(RangeError);
  });

  it("rejects invalid sequences", () => {
    expect(() => formatDocumentNumber("facture", 2026, 0)).toThrow(RangeError);
    expect(() => formatDocumentNumber("facture", 1999, 1)).toThrow(RangeError);
  });
});

describe("validators (warnings only)", () => {
  it("accepts empty values", () => {
    expect(checkNif("")).toBeNull();
    expect(checkRib("")).toBeNull();
  });

  it("checks digit counts", () => {
    expect(checkNif("123456789012345")).toBeNull();
    expect(checkNif("12345678901234567890")).toBeNull();
    expect(checkNif("1234")).toMatch(/15 ou 20/);
    expect(checkNif("12345678901234A")).toMatch(/chiffres uniquement/);
    expect(checkNis("123 456 789 012 345")).toBeNull();
    expect(checkRib("00799999000123456789")).toBeNull();
    expect(checkRib("0079")).toMatch(/20/);
    expect(checkArticleImposition("16012345678")).toBeNull();
    expect(checkArticleImposition("16A")).toMatch(/chiffres/);
  });
});
