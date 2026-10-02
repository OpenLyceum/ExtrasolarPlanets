/**
 * ExtrasolarPlanetsConstants.ts
 *
 * Central repository for every named numeric constant used across the
 * simulation. Bare numbers that carry semantic meaning (sizes, margins,
 * physics defaults, ranges) belong here rather than inline in model or view
 * code, so they are named, documented, and changed in one place.
 *
 * Conventions
 * ───────────
 *  - Physics / model values use SI units (metres, seconds, kilograms, …);
 *    note the unit in a comment on each value.
 *  - Layout / chrome values are in screen pixels.
 *  - Colour strings live in ExtrasolarPlanetsColors.ts, not here.
 *  - Computed expressions (e.g. `2 * Math.PI`) may stay inline.
 *
 * The physics constants are transcribed verbatim from the original NAAP Flash
 * simulators (`radialVelocitySimulator012`, `transitSimulator017`) so the
 * SceneryStack port reproduces their numbers exactly. */

import { Range } from "scenerystack/dot";
import ExtrasolarPlanetsNamespace from "./ExtrasolarPlanetsNamespace.js";

// ── Layout / chrome (screen pixels) ───────────────────────────────────────────

/** Margin between the screen edge and edge-anchored controls (e.g. Reset All). */
export const SCREEN_VIEW_MARGIN = 20;

/** Corner radius shared by control panels and dialogs. */
export const PANEL_CORNER_RADIUS = 6;

/** Plotting area (px) for the radial-velocity / light-curve bamboo charts. */
export const CHART_VIEW_WIDTH = 420;
export const CHART_VIEW_HEIGHT = 230;

/** Square pixel size of each orbit / transit visualization sub-view. */
export const ORBIT_VIEW_SIZE = 220;

/**
 * Number of samples used to draw a theoretical curve (RV velocity / transit
 * flux) across one orbital phase [0, 1]. The curve has SAMPLES + 1 points.
 */
export const CHART_CURVE_SAMPLES = 200;

// ── Shared physics constants (SI units; exact Flash values) ───────────────────

/** Gravitational constant (m³ kg⁻¹ s⁻²) — the Flash value, not CODATA. */
export const G_SI = 6.673e-11;

/** Solar mass (kg). */
export const M_SUN_KG = 1.98892e30;

/** Solar radius (m). */
export const R_SUN_M = 6.955e8;

/** Astronomical unit (m). */
export const AU_M = 1.49598e11;

/** Seconds in one day. */
export const SECONDS_PER_DAY = 86400;

/** 4·π², precomputed to the exact Flash literal used in Kepler's third law. */
export const FOUR_PI_SQUARED = 39.47841760435743;

/**
 * Jupiter mass (kg). The two simulators use slightly different values; this is a
 * deliberate fidelity quirk preserved from the originals — do NOT unify them.
 */
export const RV_M_JUP_KG = 1.899e27; // radialVelocitySimulator012
export const TRANSIT_M_JUP_KG = 1.8987e27; // transitSimulator017

/** Jupiter radius (m) — transit screen. */
export const R_JUP_M = 7.1492e7;

/** Fixed planet blackbody temperature (K) used by the transit flux model. */
export const PLANET_TEMP_K = 500;

/**
 * Blackbody → visual-flux constant (the `1.89553328524593e-43` literal from
 * `EclipsingBinary.as` / `Lightcurve Component II.as`).
 */
export const FLUX_CONSTANT = 1.89553328524593e-43;

/**
 * Newton's-method convergence tolerance for Kepler's equation. The Flash sources
 * iterate to 1e-3; we tighten to 1e-8 — strictly more accurate, same algorithm and seed (E₀ = M).
 */
export const KEPLER_TOLERANCE = 1e-8;

/** Hard cap on Kepler Newton iterations (Flash used 100). */
export const KEPLER_MAX_ITERATIONS = 100;

// ── Radial Velocity screen — slider ranges + defaults ─────────────────────────
// Ranges/defaults transcribed from the slider `on(initialize)` records and the
// reset handler (DoAction_7) of radialVelocitySimulator012.

export const RV_PLANET_MASS_RANGE = new Range(0.001, 100); // M_jupiter
export const RV_PLANET_MASS_DEFAULT = 1;

export const RV_STAR_MASS_RANGE = new Range(0.2, 2); // M_sun
export const RV_STAR_MASS_DEFAULT = 1;

export const RV_SEMIMAJOR_AXIS_RANGE = new Range(0.01, 10); // AU
export const RV_SEMIMAJOR_AXIS_DEFAULT = 1;

export const RV_ECCENTRICITY_RANGE = new Range(0, 0.8);
// Default = Option A (preset #1) so the preset combo, model defaults, and Reset all agree.
export const RV_ECCENTRICITY_DEFAULT = 0;

export const RV_INCLINATION_RANGE = new Range(0, 180); // degrees
export const RV_INCLINATION_DEFAULT = 90;

export const RV_LONGITUDE_RANGE = new Range(0, 360); // degrees
export const RV_LONGITUDE_DEFAULT = 0;

export const RV_NOISE_RANGE = new Range(1, 100); // m/s
export const RV_NOISE_DEFAULT = 15;

/**
 * Velocity-noise value used for the chart's y-axis margin when simulated
 * measurements are hidden — the RV analogue of the transit `noMeasurementsNoise`
 * (see below). Zero means "no extra margin, the theoretical curve fills the
 * view", matching the port's prior behaviour when scatter is off. The Flash RV
 * sim's exact hidden-state value is unverified against the decompiled source.
 */
export const RV_NO_MEASUREMENTS_NOISE = 0; // m/s

export const RV_NUMBER_OF_MEASUREMENTS_RANGE = new Range(10, 300);
export const RV_NUMBER_OF_MEASUREMENTS_DEFAULT = 150;

export const RV_PHASE_RANGE = new Range(0, 1);
export const RV_PHASE_DEFAULT = 0;

export const RV_ANIMATION_SPEED_RANGE = new Range(0.00001, 0.001);
export const RV_ANIMATION_SPEED_DEFAULT = 0.0005;

// ── Transit screen — slider ranges + defaults ─────────────────────────────────
// Transcribed from transitSimulator017 slider records + onResetClicked (DoAction_3).

export const TRANSIT_PLANET_MASS_RANGE = new Range(0.001, 100); // M_jupiter
// Defaults = Option A (preset #1): same Jupiter-at-1-AU baseline as the RV screen.
export const TRANSIT_PLANET_MASS_DEFAULT = 1;

export const TRANSIT_PLANET_RADIUS_RANGE = new Range(0.01, 2); // R_jupiter
export const TRANSIT_PLANET_RADIUS_DEFAULT = 1;

export const TRANSIT_STAR_MASS_RANGE = new Range(0.5, 2); // M_sun
export const TRANSIT_STAR_MASS_DEFAULT = 1;

export const TRANSIT_SEMIMAJOR_AXIS_RANGE = new Range(0.015, 2); // AU
export const TRANSIT_SEMIMAJOR_AXIS_DEFAULT = 1;

export const TRANSIT_ECCENTRICITY_RANGE = new Range(0, 0.4);
export const TRANSIT_ECCENTRICITY_DEFAULT = 0;

export const TRANSIT_INCLINATION_RANGE = new Range(0, 180); // degrees
export const TRANSIT_INCLINATION_DEFAULT = 90;

export const TRANSIT_LONGITUDE_RANGE = new Range(0, 360); // degrees
export const TRANSIT_LONGITUDE_DEFAULT = 0;

export const TRANSIT_PHASE_RANGE = new Range(0, 1);
// Mid-transit for Option A (e = 0, ω = 0 ⇒ transit at ν = 90°, phase 0.25 from
// periapsis) — the Flash cursor starts in the middle of the eclipse window.
export const TRANSIT_PHASE_DEFAULT = 0.25;

export const TRANSIT_NOISE_RANGE = new Range(0.00001, 0.2);
export const TRANSIT_NOISE_DEFAULT = 0.1;

export const TRANSIT_NUMBER_OF_MEASUREMENTS_RANGE = new Range(5, 250);
export const TRANSIT_NUMBER_OF_MEASUREMENTS_DEFAULT = 50;

export const TRANSIT_ANIMATION_SPEED_RANGE = new Range(0.00001, 0.001);
export const TRANSIT_ANIMATION_SPEED_DEFAULT = 0.0005;

/**
 * Flux-noise value fed to the chart's y-axis margin when measurements are hidden
 * — only sets the plot's vertical margin so the curve fills the view (it is not a
 * measurement floor). Verbatim `noMeasurementsNoise` from transitSimulator017.
 * When measurements are shown the real noise slider σ is used instead, so the
 * scatter (≈ ±CHART_NOISE_MARGIN_SIGMAS·σ) stays inside the plotting area.
 */
export const TRANSIT_NO_MEASUREMENTS_NOISE = 0.00001;

/**
 * How many standard deviations of measurement noise the charts leave as vertical
 * margin so the Gaussian scatter is not clipped by the plotting area. ±3σ covers
 * ~99.7 % of the points. The Flash originals derived the y-axis margin from the
 * noise value directly; the exact multiplier is not recorded in the decompiled
 * source, so 3 is a faithful reconstruction — revisit if the SWF is re-examined.
 */
export const CHART_NOISE_MARGIN_SIGMAS = 3;

/** Pixel radius of the planet disk in the transit visualization (kept visible). */
export const TRANSIT_PLANET_VIEW_RADIUS = 6;
/** Pixel radius of the star disk in the transit visualization. */
export const TRANSIT_STAR_VIEW_RADIUS = 38;

// ── Radial Velocity presets (transcribed from radialVelocitySimulator012 DoAction_2.as) ──
// A preset sets ONLY its six orbital parameters — never noise, number of
// measurements, animation speed, or phase. The names are kept verbatim from the
// Flash ComboBox labels, including the "N. " index prefix. Planet designations
// are proper nouns and are shown as written; the generic "N. Option X" names are
// rebuilt from a localized pattern in the view (common/view/presetName.ts).

/** Parameter tuple for one Radial Velocity preset. */
export type RadialVelocityPreset = {
  readonly name: string;
  readonly starMass: number; // M_Sun
  readonly planetMass: number; // M_Jup
  readonly eccentricity: number;
  readonly separation: number; // AU
  readonly inclination: number; // degrees
  readonly longitude: number; // degrees
};

export const RADIAL_VELOCITY_PRESETS: readonly RadialVelocityPreset[] = Object.freeze([
  { name: "1. Option A", starMass: 1, planetMass: 1, eccentricity: 0, separation: 1, inclination: 90, longitude: 0 },
  { name: "2. Option B", starMass: 1, planetMass: 1, eccentricity: 0.4, separation: 1, inclination: 90, longitude: 0 },
  { name: "3. Option C", starMass: 1, planetMass: 0.05, eccentricity: 0, separation: 1, inclination: 90, longitude: 0 },
  {
    name: "4. Option D",
    starMass: 1,
    planetMass: 0.00315,
    eccentricity: 0,
    separation: 1,
    inclination: 90,
    longitude: 0,
  },
  {
    name: "5. HD 68988 b",
    starMass: 1.2,
    planetMass: 1.9,
    eccentricity: 0.14,
    separation: 0.071,
    inclination: 90,
    longitude: 40,
  },
  {
    name: "6. HD 33564 b",
    starMass: 1.25,
    planetMass: 9.1,
    eccentricity: 0.34,
    separation: 1.1,
    inclination: 90,
    longitude: 205,
  },
  {
    name: "7. HD 39091 b",
    starMass: 1.1,
    planetMass: 10.35,
    eccentricity: 0.62,
    separation: 3.29,
    inclination: 90,
    longitude: 331,
  },
]);

/**
 * Option A — the starting preset and the model's reset target. Defined with a
 * `??` fallback (not a non-null assertion) so the type is `RadialVelocityPreset`
 * with no `undefined`, and stays valid even if the array is emptied.
 */
export const RADIAL_VELOCITY_DEFAULT_PRESET: RadialVelocityPreset = RADIAL_VELOCITY_PRESETS[0] ?? {
  name: "1. Option A",
  starMass: 1,
  planetMass: 1,
  eccentricity: 0,
  separation: 1,
  inclination: 90,
  longitude: 0,
};

// ── Transit presets (transcribed from transitSimulator017 DoAction_2.as) ────────────────
/** Parameter tuple for one Transit preset. */
export type TransitPreset = {
  readonly name: string;
  readonly planetMass: number; // M_Jup
  readonly planetRadius: number; // R_Jup
  readonly starMass: number; // M_Sun
  readonly separation: number; // AU
  readonly eccentricity: number;
  readonly inclination: number; // degrees
  readonly longitude: number; // degrees
};

export const TRANSIT_PRESETS: readonly TransitPreset[] = Object.freeze([
  {
    name: "1. Option A",
    planetMass: 1,
    planetRadius: 1,
    starMass: 1,
    separation: 1,
    eccentricity: 0,
    inclination: 90,
    longitude: 0,
  },
  {
    name: "2. Option B",
    planetMass: 0.0032,
    planetRadius: 0.09,
    starMass: 1,
    separation: 1,
    eccentricity: 0,
    inclination: 90,
    longitude: 0,
  },
  {
    name: "3. OGLE-TR-113 b",
    planetMass: 1.32,
    planetRadius: 1.09,
    starMass: 0.78,
    separation: 0.0229,
    eccentricity: 0,
    inclination: 89.4,
    longitude: 0,
  },
  {
    name: "4. TrES-1",
    planetMass: 0.61,
    planetRadius: 1.08,
    starMass: 0.87,
    separation: 0.0393,
    eccentricity: 0.135,
    inclination: 88.2,
    longitude: 0,
  },
  {
    name: "5. XO-1 b",
    planetMass: 0.9,
    planetRadius: 1.3,
    starMass: 1,
    separation: 0.0488,
    eccentricity: 0,
    inclination: 87.7,
    longitude: 0,
  },
  {
    name: "6. HD 209458 b",
    planetMass: 0.69,
    planetRadius: 1.32,
    starMass: 1.01,
    separation: 0.045,
    eccentricity: 0.07,
    inclination: 86.929,
    longitude: 83,
  },
  {
    name: "7. OGLE-TR-111 b",
    planetMass: 0.53,
    planetRadius: 1,
    starMass: 0.82,
    separation: 0.047,
    eccentricity: 0,
    inclination: 86.5,
    longitude: 0,
  },
  {
    name: "8. OGLE-TR-10 b",
    planetMass: 0.54,
    planetRadius: 1.16,
    starMass: 1.22,
    separation: 0.04162,
    eccentricity: 0,
    inclination: 86.46,
    longitude: 0,
  },
  {
    name: "9. HD 189733 b",
    planetMass: 1.15,
    planetRadius: 1.154,
    starMass: 0.82,
    separation: 0.0313,
    eccentricity: 0,
    inclination: 85.79,
    longitude: 0,
  },
  {
    name: "10. HD 149026 b",
    planetMass: 0.36,
    planetRadius: 0.725,
    starMass: 1.3,
    separation: 0.042,
    eccentricity: 0,
    inclination: 85.3,
    longitude: 0,
  },
  {
    name: "11. OGLE-TR-132 b",
    planetMass: 1.19,
    planetRadius: 1.13,
    starMass: 1.35,
    separation: 0.0306,
    eccentricity: 0,
    inclination: 85,
    longitude: 0,
  },
]);

/** Option A — the starting preset and the model's reset target (see RV note). */
export const TRANSIT_DEFAULT_PRESET: TransitPreset = TRANSIT_PRESETS[0] ?? {
  name: "1. Option A",
  planetMass: 1,
  planetRadius: 1,
  starMass: 1,
  separation: 1,
  eccentricity: 0,
  inclination: 90,
  longitude: 0,
};

ExtrasolarPlanetsNamespace.register("ExtrasolarPlanetsConstants", {
  SCREEN_VIEW_MARGIN,
  PANEL_CORNER_RADIUS,
  CHART_VIEW_WIDTH,
  CHART_VIEW_HEIGHT,
  ORBIT_VIEW_SIZE,
  CHART_CURVE_SAMPLES,
  G_SI,
  M_SUN_KG,
  R_SUN_M,
  AU_M,
  SECONDS_PER_DAY,
  FOUR_PI_SQUARED,
  RV_M_JUP_KG,
  TRANSIT_M_JUP_KG,
  R_JUP_M,
  PLANET_TEMP_K,
  FLUX_CONSTANT,
  KEPLER_TOLERANCE,
  KEPLER_MAX_ITERATIONS,
  RV_ANIMATION_SPEED_DEFAULT,
  TRANSIT_ANIMATION_SPEED_DEFAULT,
  TRANSIT_PLANET_VIEW_RADIUS,
  TRANSIT_STAR_VIEW_RADIUS,
  RV_NO_MEASUREMENTS_NOISE,
  TRANSIT_NO_MEASUREMENTS_NOISE,
  CHART_NOISE_MARGIN_SIGMAS,
});
