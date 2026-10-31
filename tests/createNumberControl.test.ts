/**
 * createNumberControl.test.ts
 *
 * The logarithmic controls (the Flash sliders with scalingMode = "logarithmic"): the slider moves
 * a log₁₀ proxy, a dragged value is rounded to the readout's figures, a value set on the model
 * (a preset) is not rounded, and the readout shows the value, not its log.
 */

import { NumberProperty, StringProperty } from "scenerystack/axon";
import { Range } from "scenerystack/dot";
import { type Node, RichText } from "scenerystack/scenery";
import { NumberDisplay } from "scenerystack/scenery-phet";
import { describe, expect, it } from "vitest";
import {
  createLogarithmicProxy,
  createNumberControl,
  roundForDisplay,
} from "../src/common/view/createNumberControl.js";

const MASS_RANGE = new Range(0.001, 100);
const threeFigures = (value: number): number => roundForDisplay(value, 3, 0);

/** The readout text of a NumberControl. */
function readout(control: Node): string {
  const find = <T extends Node>(node: Node, type: abstract new (...args: never[]) => T): T | null =>
    node instanceof type ? node : (node.children.map((child) => find(child, type)).find((n) => n !== null) ?? null);
  const display = find(control, NumberDisplay);
  return (display && find(display, RichText)?.string) ?? "";
}

describe("createLogarithmicProxy", () => {
  it("maps the value to its log and back, rounded to the shown figures", () => {
    const mass = new NumberProperty(1, { range: MASS_RANGE });
    const proxy = createLogarithmicProxy(mass, MASS_RANGE, threeFigures);
    expect(proxy.range.min).toBeCloseTo(-3, 12);
    expect(proxy.range.max).toBeCloseTo(2, 12);
    expect(proxy.value).toBe(0);
    proxy.value = Math.log10(0.0031462); // about one Earth mass
    expect(mass.value).toBe(0.00315);
  });

  it("stays inside the range at the slider's ends", () => {
    const mass = new NumberProperty(1, { range: MASS_RANGE });
    const proxy = createLogarithmicProxy(mass, MASS_RANGE, threeFigures);
    proxy.value = proxy.range.max;
    expect(mass.value).toBe(100);
    proxy.value = proxy.range.min;
    expect(mass.value).toBe(0.001);
  });

  it("follows a value set on the model without rounding it", () => {
    const axis = new NumberProperty(1, { range: new Range(0.015, 2) });
    const proxy = createLogarithmicProxy(axis, axis.range, threeFigures);
    axis.value = 0.04747; // a preset with more figures than the readout
    expect(proxy.value).toBeCloseTo(Math.log10(0.04747), 12);
    expect(axis.value).toBe(0.04747);
  });

  it("rounds a count to a whole number", () => {
    const count = new NumberProperty(150, { range: new Range(10, 300) });
    const proxy = createLogarithmicProxy(count, count.range, (value) => roundForDisplay(value, undefined, 0));
    proxy.value = 2.1;
    expect(count.value).toBe(126);
  });
});

describe("createNumberControl", () => {
  it("shows the value with its units on a logarithmic control", () => {
    const mass = new NumberProperty(1, { range: MASS_RANGE });
    const control = createNumberControl(new StringProperty("Mass"), mass, MASS_RANGE, {
      unitsProperty: new StringProperty("MJ"),
      logarithmic: true,
      significantFigures: 3,
    });
    expect(readout(control)).toBe("1 MJ");
    mass.value = 0.00315;
    expect(readout(control)).toBe("0.00315 MJ");
  });
});
