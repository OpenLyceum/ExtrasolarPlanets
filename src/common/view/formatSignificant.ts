/**
 * formatSignificant.ts
 *
 * Rounds a value to a number of significant figures for display, using dot's
 * toFixed rather than the native Number.toPrecision / toFixed, and drops
 * trailing zeros (3.40 → "3.4", 5808 → "5810"). Non-finite values read "—".
 */

import { roundSymmetric, toFixed } from "scenerystack/dot";

const DEFAULT_SIGNIFICANT_FIGURES = 3;

export function formatSignificant(value: number, digits = DEFAULT_SIGNIFICANT_FIGURES): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (value === 0) {
    return "0";
  }

  // Power of ten of the last significant digit, e.g. -2 for 3.47 at three figures.
  const lastDigitPower = Math.floor(Math.log10(Math.abs(value))) - digits + 1;
  const scale = 10 ** lastDigitPower;
  const rounded = roundSymmetric(value / scale) * scale;
  return lastDigitPower < 0 ? String(Number(toFixed(rounded, -lastDigitPower))) : String(Math.round(rounded));
}
