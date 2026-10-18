import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { TVA_RATES_BP } from "@/lib/fiscal-config";
import { parseEditorLine, toEditorLine } from "./lines";

describe("editor lines", () => {
  it("parses typed values", () => {
    const result = parseEditorLine({ key: "k", designation: "A", unit: "kg", quantity: "2,5", unitPrice: "120,40", discount: "10", tvaRateBp: 900 });
    expect(result.line).toEqual({ designation: "A", unit: "kg", quantityMilli: 2500, unitPriceCentimes: 12040, discountBp: 1000, tvaRateBp: 900 });
  });

  it("reports invalid fields", () => {
    const result = parseEditorLine({ key: "k", designation: "A", unit: "", quantity: "0", unitPrice: "abc", discount: "150", tvaRateBp: 1900 });
    expect(result.errors).toEqual({ quantity: true, unitPrice: true, discount: true });
  });

  it("round-trips stored lines through the editor", () => {
    fc.assert(
      fc.property(
        fc.record({
          designation: fc.string({ maxLength: 50 }),
          unit: fc.string({ maxLength: 10 }),
          quantityMilli: fc.integer({ min: 1, max: 999_999_999 }),
          unitPriceCentimes: fc.integer({ min: 0, max: 1e13 }),
          discountBp: fc.integer({ min: 0, max: 10000 }),
          tvaRateBp: fc.constantFrom(...TVA_RATES_BP),
        }),
        (line) => {
          expect(parseEditorLine(toEditorLine(line, "k")).line).toEqual(line);
        },
      ),
    );
  });
});
