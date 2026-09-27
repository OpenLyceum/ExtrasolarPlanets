/**
 * EclipseGeometry.test.ts
 *
 * Exercises the transit light-curve physics: disk-overlap edge cases, the
 * blackbody factors, an out-of-eclipse flux of 1, and the HD 209458 b preset
 *.
 */

import { describe, expect, it } from "vitest";
import { deriveStarProperties } from "../src/common/StarProperties.js";
import { AU_M, R_JUP_M } from "../src/ExtrasolarPlanetsConstants.js";
import {
  blackbodyVisualFactor,
  circleCircleOverlapArea,
  eclipseDepth,
  findEclipseInterval,
  normalizedFluxAtPhase,
  normalizedFluxAtTrueAnomaly,
  TRANSIT_WINDOW_MARGIN,
  type TransitSystem,
  transitPhaseWindow,
  unwrapPhaseIntoWindow,
} from "../src/transit/model/EclipseGeometry.js";

const DEG: number = Math.PI / 180;

/** Build a TransitSystem from transit-screen preset values (star props derived from mass). */
function makeSystem(preset: {
  planetRadius: number;
  starMass: number;
  separation: number;
  eccentricity: number;
  inclination: number;
  longitude: number;
}): TransitSystem {
  const star = deriveStarProperties(preset.starMass);
  return {
    separationM: preset.separation * AU_M,
    eccentricity: preset.eccentricity,
    inclinationRad: preset.inclination * DEG,
    argumentRad: preset.longitude * DEG,
    starRadiusM: star.radiusM,
    planetRadiusM: preset.planetRadius * R_JUP_M,
    starTempK: star.temperatureK,
    planetTempK: 500,
  };
}

const HD209458b = {
  planetRadius: 1.32,
  starMass: 1.01,
  separation: 0.045,
  eccentricity: 0.07,
  inclination: 86.929,
  longitude: 83,
};

describe("circleCircleOverlapArea", () => {
  it("is π·r² for two coincident equal disks (full overlap)", () => {
    const r = 3;
    expect(circleCircleOverlapArea(0, r, r)).toBeCloseTo(Math.PI * r * r, 6);
  });

  it("is π·r_small² when the smaller disk sits fully inside the larger", () => {
    expect(circleCircleOverlapArea(0, 2, 1)).toBeCloseTo(Math.PI * 1 * 1, 6);
  });

  it("is 0 when the disks merely touch (d = r₁ + r₂)", () => {
    expect(circleCircleOverlapArea(3, 2, 1)).toBeCloseTo(0, 6);
  });

  it("lies strictly between 0 and the smaller disk's area for partial overlap", () => {
    const area = circleCircleOverlapArea(1.5, 2, 1);
    expect(area).toBeGreaterThan(0);
    expect(area).toBeLessThan(Math.PI * 1 * 1);
  });
});

describe("blackbodyVisualFactor", () => {
  it("is positive and far larger for a hot star than a 500 K planet", () => {
    const star = blackbodyVisualFactor(5800);
    const planet = blackbodyVisualFactor(500);
    expect(star).toBeGreaterThan(0);
    expect(planet).toBeGreaterThan(0);
    expect(star / planet).toBeGreaterThan(1000);
  });
});

describe("HD 209458 b transit", () => {
  const system = makeSystem(HD209458b);

  it("produces a transit", () => {
    expect(findEclipseInterval(system).occurs).toBe(true);
  });

  it("has an eclipse depth in the expected shallow range (~0.01–0.025)", () => {
    const depth = eclipseDepth(system);
    expect(depth).toBeGreaterThan(0.01);
    expect(depth).toBeLessThan(0.025);
  });

  it("reads full flux (=1) outside the transit and dips inside it", () => {
    let maxFlux = -Infinity;
    let minFlux = Infinity;
    const n = 1000;
    for (let k = 0; k < n; k++) {
      const flux = normalizedFluxAtPhase(k / n, system);
      maxFlux = Math.max(maxFlux, flux);
      minFlux = Math.min(minFlux, flux);
    }
    expect(maxFlux).toBe(1); // some samples are fully unocculted
    expect(minFlux).toBeLessThan(1); // the transit dip
    expect(1 - minFlux).toBeCloseTo(eclipseDepth(system), 3);
  });

  it("has a sensible transit duration (a few percent of the orbit)", () => {
    const { durationPhase } = findEclipseInterval(system);
    expect(durationPhase).toBeGreaterThan(0);
    expect(durationPhase).toBeLessThan(0.1);
  });
});

describe("non-transiting geometry", () => {
  const system = makeSystem({ ...HD209458b, inclination: 45 });

  it("reports no eclipse and zero depth", () => {
    expect(findEclipseInterval(system).occurs).toBe(false);
    expect(eclipseDepth(system)).toBe(0);
  });

  it("reads full flux at every phase", () => {
    for (let k = 0; k < 64; k++) {
      expect(normalizedFluxAtTrueAnomaly((k / 64) * 2 * Math.PI, system)).toBe(1);
    }
  });
});

describe("transit light-curve window (NAAP 'eclipse of body 1' region)", () => {
  const optionA = makeSystem({
    planetRadius: 1,
    starMass: 1,
    separation: 1,
    eccentricity: 0,
    inclination: 90,
    longitude: 0,
  });

  it("centres Option A's transit (phase 0.25 from periapsis) with 15 % margins", () => {
    const interval = findEclipseInterval(optionA);
    const window = transitPhaseWindow(optionA, interval);
    expect(window.getCenter()).toBeCloseTo(0.25, 6);
    expect(window.getLength()).toBeCloseTo(interval.durationPhase / (1 - 2 * TRANSIT_WINDOW_MARGIN), 9);
    // The transit dip is actually sampled inside the window (not a one-point hairline).
    expect(normalizedFluxAtPhase(window.getCenter(), optionA)).toBeLessThan(0.995);
  });

  it("unwraps a phase into a window that straddles the 0/1 wrap", () => {
    // ω = 90° puts the transit at ν = π/2 − ω = 0, i.e. right at the wrap. The
    // window starts from a wrapped first-contact phase, so it spans [≈0.98, ≈1.03].
    const system = makeSystem({ ...HD209458b, longitude: 90 });
    const window = transitPhaseWindow(system, findEclipseInterval(system));
    expect(window.min).toBeLessThan(1);
    expect(window.max).toBeGreaterThan(1);
    expect(unwrapPhaseIntoWindow(0.0001, window)).toBeCloseTo(1.0001, 9);
    expect(unwrapPhaseIntoWindow(0.5, window)).toBeNull();
  });

  it("finds transits narrower than the coarse true-anomaly scan", () => {
    // 0.1 R☉ star, 2 AU orbit: the transit arc (~5e-4 rad) is much smaller than
    // the 2π/2048 scan step, which previously reported "no transit".
    const narrow: TransitSystem = { ...optionA, separationM: 2 * AU_M, starRadiusM: 6.96e7 };
    const interval = findEclipseInterval(narrow);
    expect(interval.occurs).toBe(true);
    expect(interval.durationPhase).toBeGreaterThan(0);
    expect(interval.durationPhase).toBeLessThan(1e-3);
  });
});
