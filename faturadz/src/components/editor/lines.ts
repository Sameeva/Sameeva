import type { DocumentLine } from "@/db/schema";
import type { TvaRateBp } from "@/lib/fiscal-config";
import { MAX_UNIT_PRICE_CENTIMES, amountToInput, parseAmount, parsePercent, parseQuantity, percentToInput, quantityToInput } from "@/lib/money";

/** A line as typed in the editor: numbers stay as text until they parse. */
export interface EditorLine {
  key: string;
  designation: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  tvaRateBp: TvaRateBp;
}

export interface LineErrors {
  quantity: boolean;
  unitPrice: boolean;
  discount: boolean;
}

export function toEditorLine(line: DocumentLine, key: string): EditorLine {
  return {
    key,
    designation: line.designation,
    unit: line.unit,
    quantity: quantityToInput(line.quantityMilli),
    unitPrice: amountToInput(line.unitPriceCentimes),
    discount: line.discountBp ? percentToInput(line.discountBp) : "",
    tvaRateBp: line.tvaRateBp,
  };
}

/** Parses an editor line. Returns the stored line, or which fields are invalid. */
export function parseEditorLine(line: EditorLine): { line: DocumentLine; errors: null } | { line: null; errors: LineErrors } {
  const quantityMilli = parseQuantity(line.quantity);
  const unitPriceCentimes = parseAmount(line.unitPrice, MAX_UNIT_PRICE_CENTIMES);
  const discountBp = line.discount.trim() === "" ? 0 : parsePercent(line.discount);
  if (quantityMilli === null || unitPriceCentimes === null || discountBp === null) {
    return { line: null, errors: { quantity: quantityMilli === null, unitPrice: unitPriceCentimes === null, discount: discountBp === null } };
  }
  return {
    line: { designation: line.designation, unit: line.unit, quantityMilli, unitPriceCentimes, discountBp, tvaRateBp: line.tvaRateBp },
    errors: null,
  };
}
