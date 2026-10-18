import { TVA_RATES_BP, type TvaRateBp } from "./fiscal-config";
import { assertCentimes, divRoundHalfUp, toSafeNumber } from "./money";
import { computeTimbre } from "./timbre";

export type PaymentMethod = "especes" | "cheque" | "virement" | "carte" | "autre";

export interface LineInput {
  /** Quantity in thousandths (2,5 -> 2500). Must be > 0. */
  quantityMilli: number;
  /** Unit price excluding TVA, in centimes. */
  unitPriceCentimes: number;
  /** Line discount in basis points (0..10000). */
  discountBp: number;
  tvaRateBp: TvaRateBp;
}

export interface TvaBreakdown {
  rateBp: TvaRateBp;
  baseHTCentimes: number;
  tvaCentimes: number;
}

export interface Totals {
  lineHTCentimes: number[];
  totalHTCentimes: number;
  /** One entry per rate actually used, highest rate first. */
  tva: TvaBreakdown[];
  totalTVACentimes: number;
  totalTTCCentimes: number;
  timbreCentimes: number;
  netAPayerCentimes: number;
}

function assertLine(line: LineInput, index: number): void {
  if (!Number.isSafeInteger(line.quantityMilli) || line.quantityMilli <= 0) {
    throw new RangeError(`line ${index + 1}: quantity must be a positive integer of thousandths`);
  }
  assertCentimes(line.unitPriceCentimes, `line ${index + 1} unit price`);
  if (!Number.isInteger(line.discountBp) || line.discountBp < 0 || line.discountBp > 10000) {
    throw new RangeError(`line ${index + 1}: discount must be between 0 and 10000 bp`);
  }
  if (!TVA_RATES_BP.includes(line.tvaRateBp)) {
    throw new RangeError(`line ${index + 1}: unsupported TVA rate ${line.tvaRateBp}`);
  }
}

/**
 * Line total excluding TVA: unit price × quantity × (1 − discount),
 * computed exactly then rounded once (half up) to the centime.
 */
export function computeLineHT(line: LineInput): number {
  const exact =
    BigInt(line.unitPriceCentimes) * BigInt(line.quantityMilli) * BigInt(10000 - line.discountBp);
  return toSafeNumber(divRoundHalfUp(exact, BigInt(1000 * 10000)), "line total");
}

/**
 * Computes every total of a document from its lines only.
 *
 * TVA is computed per rate on the sum of the HT lines at that rate (not per line),
 * then rounded half up once per rate. TTC = HT + TVA. The timbre (cash only) is
 * computed on the TTC and added to give the net à payer.
 */
export function computeTotals(
  lines: readonly LineInput[],
  options: { paymentMethod: PaymentMethod; applyTimbre: boolean },
): Totals {
  lines.forEach(assertLine);

  const lineHTCentimes = lines.map(computeLineHT);
  const baseByRate = new Map<TvaRateBp, bigint>();
  lines.forEach((line, i) => {
    baseByRate.set(line.tvaRateBp, (baseByRate.get(line.tvaRateBp) ?? BigInt(0)) + BigInt(lineHTCentimes[i]));
  });

  const tva: TvaBreakdown[] = TVA_RATES_BP.filter((rate) => baseByRate.has(rate)).map((rateBp) => {
    const base = baseByRate.get(rateBp)!;
    return {
      rateBp,
      baseHTCentimes: toSafeNumber(base, "TVA base"),
      tvaCentimes: toSafeNumber(divRoundHalfUp(base * BigInt(rateBp), BigInt(10000)), "TVA"),
    };
  });

  const totalHT = lineHTCentimes.reduce((sum, v) => sum + BigInt(v), BigInt(0));
  const totalTVA = tva.reduce((sum, t) => sum + BigInt(t.tvaCentimes), BigInt(0));
  const totalTTCCentimes = toSafeNumber(totalHT + totalTVA, "total TTC");

  const timbreCentimes =
    options.paymentMethod === "especes" && options.applyTimbre ? computeTimbre(totalTTCCentimes) : 0;

  return {
    lineHTCentimes,
    totalHTCentimes: toSafeNumber(totalHT, "total HT"),
    tva,
    totalTVACentimes: toSafeNumber(totalTVA, "total TVA"),
    totalTTCCentimes,
    timbreCentimes,
    netAPayerCentimes: toSafeNumber(BigInt(totalTTCCentimes) + BigInt(timbreCentimes), "net à payer"),
  };
}
