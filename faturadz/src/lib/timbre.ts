import { TIMBRE } from "./fiscal-config";
import { assertCentimes } from "./money";

/**
 * Droit de timbre for a document paid in cash, in centimes.
 * See TIMBRE in fiscal-config.ts for the rule and its sources.
 *
 * @param amountCentimes total amount paid (TTC), in centimes
 */
export function computeTimbre(amountCentimes: number): number {
  assertCentimes(amountCentimes);
  if (amountCentimes <= TIMBRE.exemptUpToCentimes) return 0;

  // A started tranche counts as a full one: ceil(amount / tranche).
  // Integer arithmetic so huge amounts can't hit float rounding.
  const amount = BigInt(amountCentimes);
  const tranche = BigInt(TIMBRE.trancheCentimes);
  const tranches = Number((amount + tranche - BigInt(1)) / tranche);
  const bracket = TIMBRE.brackets.find((b) => amountCentimes <= b.upToCentimes);
  if (!bracket) throw new Error("timbre brackets must end with an unbounded bracket");

  let duty = Math.max(tranches * bracket.dutyPerTrancheCentimes, TIMBRE.minimumCentimes);
  if (TIMBRE.maximumCentimes !== null) duty = Math.min(duty, TIMBRE.maximumCentimes);
  return duty;
}
