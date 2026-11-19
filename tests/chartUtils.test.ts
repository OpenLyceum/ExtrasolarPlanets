/**
 * chartUtils.test.ts
 *
 * Covers the shared chart helpers, with emphasis on the noise-margin path of
 * computeCurveYRange: the y-axis must leave room for the ±kσ measurement scatter
 * so the simulated points are not clipped by the plotting area (the Flash
 * `noMeasurementsNoise` behaviour). See RadialVelocity/Transit chart nodes.
 */

import { Vector2 } from "scenerystack/dot";
import { describe, expect, it } from "vitest";
import {
  applyChartRescale,
  computeCurveYRange,
  decimalPlacesForStep,
  formatTickValue,
  niceStep,
} from "../src/common/view/chartUtils.js";

/** A shallow transit dip: flux 1.0 with a small excursion down to 1 − depth. */
function dipCurve(depth: number): Vector2[] {
  return [new Vector2(0, 1), new Vector2(0.5, 1 - depth), new Vector2(1, 1)];
}

describe("niceStep", () => {
  it("picks round 1/2/5·10ⁿ steps for ~5 divisions", () => {
    expect(niceStep(100)).toBe(20);
    expect(niceStep(24)).toBe(5);
    expect(niceStep(1)).toBe(0.2);
  });

  it("never returns 0 for a non-positive span", () => {
    expect(niceStep(0)).toBeGreaterThan(0);
    expect(niceStep(-5)).toBeGreaterThan(0);
  });

  it("returns a finite step for a non-finite span", () => {
    expect(niceStep(Number.POSITIVE_INFINITY)).toBe(niceStep(1));
    expect(niceStep(Number.NaN)).toBe(niceStep(1));
  });
});

describe("formatTickValue", () => {
  it("formats to the requested decimals", () => {
    expect(formatTickValue(1.234, 2)).toBe("1.23");
  });

  it("prints -0 as 0", () => {
    expect(formatTickValue(-0, 2)).toBe("0.00");
  });

  it("shows an em dash instead of NaN or Infinity", () => {
    expect(formatTickValue(Number.NaN, 2)).toBe("—");
    expect(formatTickValue(Number.POSITIVE_INFINITY, 2)).toBe("—");
  });
});

describe("decimalPlacesForStep", () => {
  it("matches the step's magnitude", () => {
    expect(decimalPlacesForStep(20)).toBe(0);
    expect(decimalPlacesForStep(0.2)).toBe(1);
    expect(decimalPlacesForStep(0.02)).toBe(2);
  });
});

describe("applyChartRescale", () => {
  it("applies spacing before range when the span grows", () => {
    const order: string[] = [];
    applyChartRescale(
      1,
      100,
      () => order.push("range"),
      () => order.push("spacing"),
    );
    expect(order).toEqual(["spacing", "range"]);
  });

  it("applies range before spacing when the span shrinks", () => {
    const order: string[] = [];
    applyChartRescale(
      100,
      1,
      () => order.push("range"),
      () => order.push("spacing"),
    );
    expect(order).toEqual(["range", "spacing"]);
  });
});

describe("computeCurveYRange without a noise margin", () => {
  it("pads the curve extent by 10 %", () => {
    const range = computeCurveYRange(dipCurve(0.1), 0.01);
    // span 0.1, pad 0.01 → [0.89, 1.01]
    expect(range.min).toBeCloseTo(0.89, 10);
    expect(range.max).toBeCloseTo(1.01, 10);
  });

  it("collapses a flat curve to the ± flat-window fallback", () => {
    const flat = [new Vector2(0, 1), new Vector2(0.5, 1), new Vector2(1, 1)];
    const range = computeCurveYRange(flat, 0.01);
    expect(range.min).toBeCloseTo(0.99, 10);
    expect(range.max).toBeCloseTo(1.01, 10);
  });

  it("falls back to the symmetric window for an empty curve", () => {
    const range = computeCurveYRange([], 12);
    expect(range.min).toBe(-12);
    expect(range.max).toBe(12);
  });
});

describe("computeCurveYRange with a noise margin", () => {
  it("widens the window so ±kσ scatter is not clipped", () => {
    const depth = 0.02; // 2 % dip
    const sigma = 0.1; // default transit noise
    const margin = 3 * sigma; // ±3σ
    const range = computeCurveYRange(dipCurve(depth), 0.01, margin);

    // The lowest possible scatter point sits at curveMin − 3σ; it must be visible.
    const lowestScatter = 1 - depth - margin;
    const highestScatter = 1 + margin;
    expect(range.min).toBeLessThan(lowestScatter);
    expect(range.max).toBeGreaterThan(highestScatter);
  });

  it("keeps a flat (non-transiting) curve visible once noisy points appear", () => {
    const flat = [new Vector2(0, 1), new Vector2(1, 1)];
    const sigma = 0.1;
    const noMargin = computeCurveYRange(flat, 0.01, 0);
    const withMargin = computeCurveYRange(flat, 0.01, 3 * sigma);
    // Without scatter the window is the tight ±flatHalfWindow; with scatter it
    // must open up well past that so the points are in view.
    expect(withMargin.max - withMargin.min).toBeGreaterThan(noMargin.max - noMargin.min);
    expect(withMargin.max).toBeGreaterThan(1 + 3 * sigma);
    expect(withMargin.min).toBeLessThan(1 - 3 * sigma);
  });

  it("is a no-op for a zero or negative margin (prior behaviour preserved)", () => {
    const base = computeCurveYRange(dipCurve(0.1), 0.01);
    const zero = computeCurveYRange(dipCurve(0.1), 0.01, 0);
    const negative = computeCurveYRange(dipCurve(0.1), 0.01, -5);
    expect(zero.min).toBeCloseTo(base.min, 10);
    expect(zero.max).toBeCloseTo(base.max, 10);
    expect(negative.min).toBeCloseTo(base.min, 10);
    expect(negative.max).toBeCloseTo(base.max, 10);
  });
});
