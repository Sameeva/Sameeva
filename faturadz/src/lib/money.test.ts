import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  amountToInput,
  divRoundHalfUp,
  formatAmount,
  formatPercent,
  formatQuantity,
  parseAmount,
  parsePercent,
  parseQuantity,
} from "./money";

describe("parseAmount", () => {
  it.each([
    ["1234", 123400],
    ["1234,5", 123450],
    ["1234.50", 123450],
    ["1 234,56", 123456],
    ["0,01", 1],
    ["0", 0],
    ["  12  ", 1200],
  ])("%s -> %i", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(["", "-5", "1,234", "12,345", "abc", "1e5", "1.2.3", "１２", "99999999999999999"])("rejects %s", (input) => {
    expect(parseAmount(input)).toBeNull();
  });

  it("honours an explicit maximum", () => {
    expect(parseAmount("100", 10000)).toBe(10000);
    expect(parseAmount("100,01", 10000)).toBeNull();
  });

  it("round-trips with amountToInput", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e15 }), (c) => {
        expect(parseAmount(amountToInput(c))).toBe(c);
      }),
    );
  });
});

describe("parseQuantity / parsePercent", () => {
  it("parses quantities into thousandths", () => {
    expect(parseQuantity("2,5")).toBe(2500);
    expect(parseQuantity("1")).toBe(1000);
    expect(parseQuantity("0,001")).toBe(1);
    expect(parseQuantity("0")).toBeNull();
    expect(parseQuantity("1,2345")).toBeNull();
    expect(parseQuantity("-1")).toBeNull();
    expect(parseQuantity("1000000")).toBe(1_000_000_000);
    expect(parseQuantity("1000000,001")).toBeNull(); // above MAX_QUANTITY_MILLI
  });

  it("parses percentages into basis points, max 100 %", () => {
    expect(parsePercent("10")).toBe(1000);
    expect(parsePercent("12,5")).toBe(1250);
    expect(parsePercent("100")).toBe(10000);
    expect(parsePercent("100,01")).toBeNull();
    expect(parsePercent("-1")).toBeNull();
  });
});

describe("formatting", () => {
  it("formats amounts in French style", () => {
    expect(formatAmount(0)).toBe("0,00");
    expect(formatAmount(5)).toBe("0,05");
    expect(formatAmount(123456789)).toBe("1 234 567,89");
    expect(() => formatAmount(-1)).toThrow(RangeError);
  });

  it("formats quantities and percentages", () => {
    expect(formatQuantity(2500)).toBe("2,5");
    expect(formatQuantity(1000)).toBe("1");
    expect(formatQuantity(1234567)).toBe("1 234,567");
    expect(formatPercent(1900)).toBe("19 %");
    expect(formatPercent(1250)).toBe("12,5 %");
  });
});

describe("divRoundHalfUp", () => {
  it("rounds half up", () => {
    expect(divRoundHalfUp(BigInt(5), BigInt(10))).toBe(BigInt(1));
    expect(divRoundHalfUp(BigInt(4), BigInt(10))).toBe(BigInt(0));
    expect(divRoundHalfUp(BigInt(15), BigInt(10))).toBe(BigInt(2));
    expect(divRoundHalfUp(BigInt(25), BigInt(10))).toBe(BigInt(3));
  });
});
