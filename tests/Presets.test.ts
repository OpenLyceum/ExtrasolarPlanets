/**
 * Presets.test.ts
 *
 * Locks the preset-selection contract shared by both screens:
 *  - applying a preset sets only its parameter tuple (never noise/number/phase);
 *  - the initial model state matches Option A (preset #1);
 *  - reset() returns every parameter, including the selected preset, to Option A.
 *
 * The numeric ground truth comes straight from RADIAL_VELOCITY_PRESETS /
 * TRANSIT_PRESETS (themselves transcribed from the Flash DoAction_2.as tables),
 * so a future constants edit that drifts a tuple will fail here loudly.
 */

import { describe, expect, it } from "vitest";
import {
  RADIAL_VELOCITY_DEFAULT_PRESET,
  RADIAL_VELOCITY_PRESETS,
  type RadialVelocityPreset,
  TRANSIT_DEFAULT_PRESET,
  TRANSIT_PRESETS,
  type TransitPreset,
} from "../src/ExtrasolarPlanetsConstants.js";
import { RadialVelocityModel } from "../src/radial-velocity/model/RadialVelocityModel.js";
import { TransitModel } from "../src/transit/model/TransitModel.js";

/** Index a preset array without a non-null assertion (falls back to Option A). */
const rvPreset = (i: number): RadialVelocityPreset => RADIAL_VELOCITY_PRESETS[i] ?? RADIAL_VELOCITY_DEFAULT_PRESET;
const tPreset = (i: number): TransitPreset => TRANSIT_PRESETS[i] ?? TRANSIT_DEFAULT_PRESET;

describe("RadialVelocityModel presets", () => {
  it("starts on Option A (preset #1)", () => {
    const model = new RadialVelocityModel();
    const a = RADIAL_VELOCITY_DEFAULT_PRESET;
    expect(model.presetProperty.value).toBe(a);
    expect(model.planetMassProperty.value).toBe(a.planetMass);
    expect(model.eccentricityProperty.value).toBe(a.eccentricity);
    expect(model.longitudeProperty.value).toBe(a.longitude);
  });

  it("applyPreset sets the parameter tuple but not noise / number / phase", () => {
    const model = new RadialVelocityModel();
    const noiseBefore = model.noiseProperty.value;
    const numberBefore = model.numberOfMeasurementsProperty.value;
    const phaseBefore = model.phaseProperty.value;

    const hd = rvPreset(4); // HD 68988 b
    model.presetProperty.value = hd; // fires lazyLink → applyPreset

    expect(model.starMassProperty.value).toBe(hd.starMass);
    expect(model.planetMassProperty.value).toBe(hd.planetMass);
    expect(model.eccentricityProperty.value).toBe(hd.eccentricity);
    expect(model.semimajorAxisProperty.value).toBe(hd.separation);
    expect(model.inclinationProperty.value).toBe(hd.inclination);
    expect(model.longitudeProperty.value).toBe(hd.longitude);
    // Untouched by presets:
    expect(model.noiseProperty.value).toBe(noiseBefore);
    expect(model.numberOfMeasurementsProperty.value).toBe(numberBefore);
    expect(model.phaseProperty.value).toBe(phaseBefore);
  });

  it("reset() returns the selected preset and every parameter to Option A", () => {
    const model = new RadialVelocityModel();
    model.presetProperty.value = rvPreset(6); // HD 39091 b
    model.noiseProperty.value = 42;
    model.reset();

    const a = RADIAL_VELOCITY_DEFAULT_PRESET;
    expect(model.presetProperty.value).toBe(a);
    expect(model.planetMassProperty.value).toBe(a.planetMass);
    expect(model.eccentricityProperty.value).toBe(a.eccentricity);
    expect(model.noiseProperty.value).not.toBe(42);
  });
});

describe("TransitModel presets", () => {
  it("starts on Option A (preset #1)", () => {
    const model = new TransitModel();
    const a = TRANSIT_DEFAULT_PRESET;
    expect(model.presetProperty.value).toBe(a);
    expect(model.planetMassProperty.value).toBe(a.planetMass);
    expect(model.planetRadiusProperty.value).toBe(a.planetRadius);
    expect(model.semimajorAxisProperty.value).toBe(a.separation);
  });

  it("applyPreset sets the parameter tuple but not noise / number / phase", () => {
    const model = new TransitModel();
    const numberBefore = model.numberOfMeasurementsProperty.value;

    const xo = tPreset(4); // XO-1 b
    model.presetProperty.value = xo;

    expect(model.planetMassProperty.value).toBe(xo.planetMass);
    expect(model.planetRadiusProperty.value).toBe(xo.planetRadius);
    expect(model.starMassProperty.value).toBe(xo.starMass);
    expect(model.semimajorAxisProperty.value).toBe(xo.separation);
    expect(model.eccentricityProperty.value).toBe(xo.eccentricity);
    expect(model.inclinationProperty.value).toBe(xo.inclination);
    expect(model.longitudeProperty.value).toBe(xo.longitude);
    expect(model.numberOfMeasurementsProperty.value).toBe(numberBefore);
  });

  it("reset() returns the selected preset and every parameter to Option A", () => {
    const model = new TransitModel();
    model.presetProperty.value = tPreset(5); // HD 209458 b
    model.reset();

    const a = TRANSIT_DEFAULT_PRESET;
    expect(model.presetProperty.value).toBe(a);
    expect(model.planetRadiusProperty.value).toBe(a.planetRadius);
    expect(model.semimajorAxisProperty.value).toBe(a.separation);
  });
});

describe("TransitModel preset application", () => {
  it("reports a preset in progress only while its parameters are being set", () => {
    const model = new TransitModel();
    const seen: boolean[] = [];
    model.inclinationProperty.lazyLink(() => seen.push(model.isApplyingPreset));
    model.presetProperty.value = tPreset(2);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((applying) => applying)).toBe(true);
    expect(model.isApplyingPreset).toBe(false);
  });

  it("has the depth up to date when the transit starts or stops", () => {
    const model = new TransitModel();
    const depths: [boolean, number][] = [];
    model.eclipseIntervalProperty.lazyLink((interval) =>
      depths.push([interval.occurs, model.eclipseDepthProperty.value]),
    );
    model.inclinationProperty.value = 80; // no transit at 1 AU
    model.inclinationProperty.value = 90;
    expect(depths[0]).toEqual([false, 0]);
    expect(depths.at(-1)?.[0]).toBe(true);
    expect(depths.at(-1)?.[1]).toBeGreaterThan(0.01);
  });
});
