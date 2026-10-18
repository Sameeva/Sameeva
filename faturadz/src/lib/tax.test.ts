import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { TVA_RATES_BP } from "./fiscal-config";
import { computeLineHT, computeTotals, type LineInput, type PaymentMethod } from "./tax";

const line = (over: Partial<LineInput>): LineInput => ({
  quantityMilli: 1000,
  unitPriceCentimes: 0,
  discountBp: 0,
  tvaRateBp: 1900,
  ...over,
});

describe("computeLineHT", () => {
  it("multiplies quantity and unit price", () => {
    // 3 × 1 000,00 DA = 3 000,00 DA
    expect(computeLineHT(line({ quantityMilli: 3000, unitPriceCentimes: 100000 }))).toBe(300000);
  });

  it("applies decimal quantity and discount with a single rounding", () => {
    // 2,5 × 120,40 = 301,00 ; −10 % = 270,90 DA
    expect(computeLineHT(line({ quantityMilli: 2500, unitPriceCentimes: 12040, discountBp: 1000 }))).toBe(27090);
  });

  it("rounds half up to the centime", () => {
    // 0,333 × 1,00 DA = 33,3 c -> 33 ; 0,335 × 1,00 DA = 33,5 c -> 34
    expect(computeLineHT(line({ quantityMilli: 333, unitPriceCentimes: 100 }))).toBe(33);
    expect(computeLineHT(line({ quantityMilli: 335, unitPriceCentimes: 100 }))).toBe(34);
    // 0,334 -> 33,4 c -> 33
    expect(computeLineHT(line({ quantityMilli: 334, unitPriceCentimes: 100 }))).toBe(33);
  });

  it("gives 0 with a 100 % discount", () => {
    expect(computeLineHT(line({ unitPriceCentimes: 99999, discountBp: 10000 }))).toBe(0);
  });
});

describe("computeTotals", () => {
  const mixed: LineInput[] = [
    line({ quantityMilli: 3000, unitPriceCentimes: 100000, tvaRateBp: 1900 }), // HT 3 000,00
    line({ quantityMilli: 2500, unitPriceCentimes: 12040, discountBp: 1000, tvaRateBp: 900 }), // HT 270,90
    line({ quantityMilli: 1000, unitPriceCentimes: 50000, tvaRateBp: 0 }), // HT 500,00
  ];

  it("computes a mixed 19 % / 9 % / 0 % invoice paid in cash (hand-computed)", () => {
    const t = computeTotals(mixed, { paymentMethod: "especes", applyTimbre: true });
    expect(t.lineHTCentimes).toEqual([300000, 27090, 50000]);
    expect(t.totalHTCentimes).toBe(377090); // 3 770,90
    expect(t.tva).toEqual([
      { rateBp: 1900, baseHTCentimes: 300000, tvaCentimes: 57000 }, // 570,00
      { rateBp: 900, baseHTCentimes: 27090, tvaCentimes: 2438 }, // 24,381 -> 24,38
      { rateBp: 0, baseHTCentimes: 50000, tvaCentimes: 0 },
    ]);
    expect(t.totalTVACentimes).toBe(59438);
    expect(t.totalTTCCentimes).toBe(436528); // 4 365,28
    // 4 365,28 DA -> 44 started tranches × 1 DA = 44 DA
    expect(t.timbreCentimes).toBe(4400);
    expect(t.netAPayerCentimes).toBe(440928); // 4 409,28
  });

  it("adds no timbre for non-cash payments or when disabled", () => {
    for (const paymentMethod of ["cheque", "virement", "carte", "autre"] as const) {
      expect(computeTotals(mixed, { paymentMethod, applyTimbre: true }).timbreCentimes).toBe(0);
    }
    const off = computeTotals(mixed, { paymentMethod: "especes", applyTimbre: false });
    expect(off.timbreCentimes).toBe(0);
    expect(off.netAPayerCentimes).toBe(436528);
  });

  it("computes TVA per rate on the summed base, not per line", () => {
    // 3 lines of 0,03 DA at 19 %: per line 0,57 c -> 1 c each (3 c total),
    // per rate 9 c × 19 % = 1,71 c -> 2 c.
    const lines = [1, 2, 3].map(() => line({ unitPriceCentimes: 3 }));
    expect(computeTotals(lines, { paymentMethod: "virement", applyTimbre: true }).totalTVACentimes).toBe(2);
  });

  it("handles an empty document", () => {
    const t = computeTotals([], { paymentMethod: "especes", applyTimbre: true });
    expect(t).toMatchObject({ totalHTCentimes: 0, totalTVACentimes: 0, totalTTCCentimes: 0, timbreCentimes: 0, netAPayerCentimes: 0, tva: [] });
  });

  it("rejects invalid lines", () => {
    const opts = { paymentMethod: "especes" as const, applyTimbre: true };
    expect(() => computeTotals([line({ quantityMilli: 0 })], opts)).toThrow(RangeError);
    expect(() => computeTotals([line({ unitPriceCentimes: -1 })], opts)).toThrow(RangeError);
    expect(() => computeTotals([line({ unitPriceCentimes: 1.5 })], opts)).toThrow(RangeError);
    expect(() => computeTotals([line({ discountBp: 10001 })], opts)).toThrow(RangeError);
    expect(() => computeTotals([line({ tvaRateBp: 700 as never })], opts)).toThrow(RangeError);
  });

  it("rejects totals that would lose precision", () => {
    const huge = line({ quantityMilli: 1_000_000_000, unitPriceCentimes: 100_000_000_000 });
    expect(() => computeTotals([huge], { paymentMethod: "virement", applyTimbre: false })).toThrow(RangeError);
  });
});

describe("computeTotals invariants (property-based)", () => {
  const lineArb = fc.record({
    quantityMilli: fc.integer({ min: 1, max: 1_000_000 }),
    unitPriceCentimes: fc.integer({ min: 0, max: 100_000_000 }),
    discountBp: fc.integer({ min: 0, max: 10000 }),
    tvaRateBp: fc.constantFrom(...TVA_RATES_BP),
  });
  const paymentArb = fc.constantFrom<PaymentMethod>("especes", "cheque", "virement", "carte", "autre");

  it("HT + TVA = TTC, TTC + timbre = net, breakdown adds up", () => {
    fc.assert(
      fc.property(fc.array(lineArb, { maxLength: 30 }), paymentArb, fc.boolean(), (lines, paymentMethod, applyTimbre) => {
        const t = computeTotals(lines, { paymentMethod, applyTimbre });
        expect(t.totalHTCentimes + t.totalTVACentimes).toBe(t.totalTTCCentimes);
        expect(t.totalTTCCentimes + t.timbreCentimes).toBe(t.netAPayerCentimes);
        expect(t.lineHTCentimes.reduce((a, b) => a + b, 0)).toBe(t.totalHTCentimes);
        expect(t.tva.reduce((a, b) => a + b.baseHTCentimes, 0)).toBe(t.totalHTCentimes);
        expect(t.tva.reduce((a, b) => a + b.tvaCentimes, 0)).toBe(t.totalTVACentimes);
        if (paymentMethod !== "especes" || !applyTimbre) expect(t.timbreCentimes).toBe(0);
        for (const v of [t.totalHTCentimes, t.totalTVACentimes, t.timbreCentimes, t.netAPayerCentimes]) {
          expect(Number.isSafeInteger(v) && v >= 0).toBe(true);
        }
      }),
    );
  });

  it("each rate's TVA is within half a centime of the exact value", () => {
    fc.assert(
      fc.property(fc.array(lineArb, { minLength: 1, maxLength: 30 }), (lines) => {
        const t = computeTotals(lines, { paymentMethod: "virement", applyTimbre: false });
        for (const b of t.tva) {
          const exactTimes10000 = b.baseHTCentimes * b.rateBp; // exact TVA × 10000
          expect(Math.abs(b.tvaCentimes * 10000 - exactTimes10000)).toBeLessThanOrEqual(5000);
        }
      }),
    );
  });

  it("line HT is within half a centime of the exact value", () => {
    fc.assert(
      fc.property(lineArb, (l) => {
        // exact HT × 10^7 = price × qtyMilli × (10000 − discount)
        const exact = BigInt(l.unitPriceCentimes) * BigInt(l.quantityMilli) * BigInt(10000 - l.discountBp);
        const diff = BigInt(computeLineHT(l)) * BigInt(10_000_000) - exact;
        const abs = diff < BigInt(0) ? -diff : diff;
        expect(abs <= BigInt(5_000_000)).toBe(true);
      }),
    );
  });
});
