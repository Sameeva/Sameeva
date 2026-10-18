import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { amountInWords, numberToFrenchWords } from "./amountInWords";

describe("numberToFrenchWords", () => {
  it.each([
    [0, "zéro"],
    [1, "un"],
    [16, "seize"],
    [17, "dix-sept"],
    [21, "vingt et un"],
    [22, "vingt-deux"],
    [61, "soixante et un"],
    [70, "soixante-dix"],
    [71, "soixante et onze"],
    [77, "soixante-dix-sept"],
    [80, "quatre-vingts"],
    [81, "quatre-vingt-un"],
    [90, "quatre-vingt-dix"],
    [91, "quatre-vingt-onze"],
    [99, "quatre-vingt-dix-neuf"],
    [100, "cent"],
    [101, "cent un"],
    [180, "cent quatre-vingts"],
    [200, "deux cents"],
    [201, "deux cent un"],
    [1000, "mille"],
    [1001, "mille un"],
    [2000, "deux mille"],
    [80_000, "quatre-vingt mille"],
    [200_000, "deux cent mille"],
    [1_000_000, "un million"],
    [1_500_000, "un million cinq cent mille"],
    [2_000_000, "deux millions"],
    [80_000_000, "quatre-vingts millions"],
    [200_000_000, "deux cents millions"],
    [1_000_000_000, "un milliard"],
    [2_345_678_901, "deux milliards trois cent quarante-cinq millions six cent soixante-dix-huit mille neuf cent un"],
  ])("%i -> %s", (n, words) => {
    expect(numberToFrenchWords(n)).toBe(words);
  });

  it("rejects negative and non-integer input", () => {
    expect(() => numberToFrenchWords(-1)).toThrow(RangeError);
    expect(() => numberToFrenchWords(1.5)).toThrow(RangeError);
  });
});

describe("amountInWords", () => {
  it.each([
    [0, "zéro dinar algérien"],
    [1, "zéro dinar algérien et un centime"],
    [100, "un dinar algérien"],
    [2100, "vingt et un dinars algériens"],
    [123456, "mille deux cent trente-quatre dinars algériens et cinquante-six centimes"],
    [440928, "quatre mille quatre cent neuf dinars algériens et vingt-huit centimes"],
    [100_000_000, "un million de dinars algériens"],
    [200_000_000, "deux millions de dinars algériens"],
    [150_000_000, "un million cinq cent mille dinars algériens"],
    [100_000_050, "un million de dinars algériens et cinquante centimes"],
  ])("%i centimes -> %s", (c, words) => {
    expect(amountInWords(c)).toBe(words);
  });
});

/**
 * Independent parser (different algorithm from the generator) used to check
 * that every generated text reads back as the original number.
 */
const VALUES: Record<string, number> = {
  "zéro": 0, un: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
  vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
};
const SCALES: Record<string, number> = {
  million: 1e6, millions: 1e6, milliard: 1e9, milliards: 1e9, billion: 1e12, billions: 1e12,
};

function parseFrench(text: string): number {
  let total = 0;
  let current = 0;
  let previous = "";
  for (const token of text.split(/[\s-]+/)) {
    if (token === "et") continue;
    if ((token === "vingt" || token === "vingts") && previous === "quatre") current += 80 - 4;
    else if (token in VALUES) current += VALUES[token];
    else if (token === "cent" || token === "cents") current = (current || 1) * 100;
    else if (token === "mille") {
      total += (current || 1) * 1000;
      current = 0;
    } else if (token in SCALES) {
      total += current * SCALES[token];
      current = 0;
    } else throw new Error(`unknown token ${token}`);
    previous = token;
  }
  return total + current;
}

describe("amountInWords properties", () => {
  it("reads back to the original number", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 999_999_999_999_999 }), (n) => {
        expect(parseFrench(numberToFrenchWords(n))).toBe(n);
      }),
      { numRuns: 2000 },
    );
  });

  it("only writes plural cents/quatre-vingts at the end or before a noun", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 999_999_999_999_999 }), (n) => {
        const words = numberToFrenchWords(n);
        expect(words).not.toMatch(/(?:cents|quatre-vingts) (?!millions?|milliards?|billions?)/);
        // exactly 1000 / 100 is "mille" / "cent", never "un mille" / "un cent"
        // ("quarante et un mille" = 41 000 is correct).
        expect(words).not.toMatch(/(?:^|(?:millions?|milliards?|billions?) )un (?:mille|cent)\b/);
      }),
      { numRuns: 2000 },
    );
  });

  it("dinars and centimes read back separately", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e14 }), (c) => {
        const match = /^(.*?) (?:de )?dinars? algériens?(?: et (.*) centimes?)?$/.exec(amountInWords(c));
        expect(match).not.toBeNull();
        expect(parseFrench(match![1])).toBe(Math.floor(c / 100));
        expect(match![2] === undefined ? 0 : parseFrench(match![2])).toBe(c % 100);
      }),
      { numRuns: 1000 },
    );
  });
});
