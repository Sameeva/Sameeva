/**
 * Every Algerian tax rule the app relies on lives in this file, with its source.
 *
 * Status legend:
 *   CONFIRMED  - consistent across several sources and long-standing practice.
 *   TO VERIFY  - sources disagree or no official text could be read; the value is
 *                the most cited interpretation. Check with an accountant / the DGI
 *                and change it here only (all logic reads from this file).
 *
 * All money values are in centimes (1 DA = 100 centimes).
 */

/**
 * TVA rates in basis points (1900 = 19%).
 * CONFIRMED: normal rate 19%, reduced rate 9% (Code des taxes sur le chiffre
 * d'affaires; reduced-rate goods/services listed in the code, art. 23).
 * 0 is used for exempt operations or for sellers not liable to TVA (IFU regime).
 */
export const TVA_RATES_BP = [1900, 900, 0] as const;
export type TvaRateBp = (typeof TVA_RATES_BP)[number];

/**
 * Droit de timbre on documents paid in cash (espèces).
 * Source: Code du timbre, art. 100, as amended by the Loi de finances 2025
 * (circular n° 14/MF/DGI/LF.2025 as cited by secondary sources).
 *
 * CONFIRMED (consistent across sources):
 *   - applies only when payment is made in cash;
 *   - amount <= 300 DA: no duty;
 *   - 300 DA < amount <= 30 000 DA: 1 DA per 100 DA tranche;
 *   - 30 000 DA < amount <= 100 000 DA: 1.5 DA per 100 DA tranche;
 *   - amount > 100 000 DA: 2 DA per 100 DA tranche;
 *   - a started tranche counts as a full tranche;
 *   - the duty cannot be lower than 5 DA.
 *
 * TO VERIFY:
 *   - Whole-amount vs progressive brackets: the most cited reading (used here)
 *     is that the bracket of the TOTAL amount sets the rate applied to every
 *     tranche (50 000 DA -> 500 x 1.5 = 750 DA), not a progressive scale.
 *   - Maximum: sources say LF 2025 removed the former 10 000 DA cap; one source
 *     mentions a "readjusted cap". null = no cap.
 *   - Base: the total amount paid (TTC) is used, as stated by the sources.
 */
export const TIMBRE = {
  exemptUpToCentimes: 300_00,
  trancheCentimes: 100_00,
  /** Upper bound (inclusive) of each bracket and duty per tranche, in centimes. */
  brackets: [
    { upToCentimes: 30_000_00, dutyPerTrancheCentimes: 1_00 },
    { upToCentimes: 100_000_00, dutyPerTrancheCentimes: 1_50 },
    { upToCentimes: Number.POSITIVE_INFINITY, dutyPerTrancheCentimes: 2_00 },
  ],
  minimumCentimes: 5_00,
  maximumCentimes: null as number | null,
} as const;

/**
 * Legal identifier formats. These are used for WARNINGS only, never to block,
 * because formats vary (main vs secondary establishment, old documents).
 *
 * - NIF: 15 digits, 20 digits for some legal entities / secondary
 *   establishments (sources disagree on the exact criterion). TO VERIFY.
 * - NIS: 15 digits; 18 for a secondary establishment (15 + 3 sequential digits).
 * - Article d'imposition: digits only; commonly 11 digits but no source
 *   confirmed the length, so only "digits only" is checked. TO VERIFY.
 * - RC: free format (e.g. "16/00-1234567 B 18"), not checked.
 * - RIB: 20 digits (bank code, branch, account, key).
 */
export const ID_FORMATS = {
  nif: { lengths: [15, 20] },
  nis: { lengths: [15, 18] },
  rib: { lengths: [20] },
} as const;
