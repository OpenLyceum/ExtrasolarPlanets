/**
 * formatSignificant.test.ts
 *
 * The readouts used to format with String(Number(value.toPrecision(3))). The
 * replacement must print the same strings without the native method.
 */

import { describe, expect, it } from "vitest";
import { formatSignificant } from "../src/common/view/formatSignificant.js";

describe("formatSignificant", () => {
  it("matches toPrecision(3) with trailing zeros dropped", () => {
    for (const value of [3.469, 5808, 0.012345, 1, 100, 1234567, -2.5, 3.4, 0.5, 99.95, 12.25, 6.02e-5]) {
      expect(formatSignificant(value)).toBe(String(Number(value.toPrecision(3))));
    }
  });

  it("reads zero and non-finite values sensibly", () => {
    expect(formatSignificant(0)).toBe("0");
    expect(formatSignificant(Number.NaN)).toBe("—");
    expect(formatSignificant(Number.POSITIVE_INFINITY)).toBe("—");
  });
});
