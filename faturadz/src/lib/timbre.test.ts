import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeTimbre } from "./timbre";

const DA = (v: number) => Math.round(v * 100);

describe("computeTimbre (art. 100 Code du timbre, LF 2025)", () => {
  // Expected values computed by hand: ceil(amount / 100 DA) × rate, min 5 DA.
  it.each([
    ["0 DA", DA(0), 0],
    ["300 DA: exempt (<= 300 DA)", DA(300), 0],
    ["300,01 DA: 4 tranches × 1 DA = 4 DA -> minimum 5 DA", DA(300.01), DA(5)],
    ["450 DA: 5 tranches × 1 DA = 5 DA", DA(450), DA(5)],
    ["1 000 DA: 10 × 1 DA", DA(1000), DA(10)],
    ["1 000,01 DA: 11 started tranches", DA(1000.01), DA(11)],
    ["30 000 DA: 300 × 1 DA (upper bound of bracket 1)", DA(30000), DA(300)],
    ["30 000,01 DA: 301 × 1,5 DA", DA(30000.01), DA(451.5)],
    ["50 000 DA: 500 × 1,5 DA", DA(50000), DA(750)],
    ["100 000 DA: 1 000 × 1,5 DA (upper bound of bracket 2)", DA(100000), DA(1500)],
    ["100 000,01 DA: 1 001 × 2 DA", DA(100000.01), DA(2002)],
    ["1 000 000 DA: 10 000 × 2 DA (no cap)", DA(1000000), DA(20000)],
  ])("%s", (_label, amount, expected) => {
    expect(computeTimbre(amount)).toBe(expected);
  });

  it("rejects invalid amounts", () => {
    expect(() => computeTimbre(-1)).toThrow(RangeError);
    expect(() => computeTimbre(10.5)).toThrow(RangeError);
  });

  it("is never below 5 DA above the exemption, and between 1 % and 2 % (+ one tranche)", () => {
    fc.assert(
      fc.property(fc.integer({ min: DA(300) + 1, max: 1e13 }), (amount) => {
        const t = computeTimbre(amount);
        expect(t).toBeGreaterThanOrEqual(DA(5));
        expect(t * 100).toBeGreaterThanOrEqual(amount); // >= 1 %
        expect(t).toBeLessThanOrEqual(Math.max(DA(5), (Math.floor(amount / 10000) + 1) * 200)); // <= 2 DA per started tranche
      }),
    );
  });

  it("never decreases when the amount increases", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e12 }), fc.integer({ min: 0, max: 1e9 }), (a, delta) => {
        expect(computeTimbre(a + delta)).toBeGreaterThanOrEqual(computeTimbre(a));
      }),
    );
  });
});
