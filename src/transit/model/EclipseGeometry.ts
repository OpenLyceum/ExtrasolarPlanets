/**
 * EclipseGeometry.ts
 *
 * The transit screen's light-curve physics, ported directly from
 * `Lightcurve Component II.as` (and the shared `EclipsingBinary.as`). Two uniform
 * blackbody disks — body 1 = the star, body 2 = the planet — orbit each other;
 * when the planet passes in front of the star ("eclipse of body 1") it occults
 * part of the stellar disk and the normalized flux dips.
 *
 * Faithful approximations preserved from the Flash original:
 *  - uniform disks, NO limb darkening
 *  - the planet radiates as a fixed 500 K blackbody
 *  - normalized flux = visualFlux / maxVisualFlux (the π factor cancels because
 *    the overlap area itself carries it at full occultation)
 *
 * SI units throughout (m, K, radians). No SceneryStack types are referenced.
 */

import { Range } from "scenerystack/dot";
import { eccentricToTrueAnomaly, meanToEccentricAnomaly, phaseFromTrueAnomaly } from "../../common/OrbitalMechanics.js";
import { FLUX_CONSTANT } from "../../ExtrasolarPlanetsConstants.js";

const TWO_PI = 2 * Math.PI;

const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

/** A fully-specified two-body transit system (the star is body 1, planet body 2). */
export type TransitSystem = {
  /** Semi-major axis of the relative orbit (m). */
  separationM: number;
  eccentricity: number;
  /** Orbital inclination (rad). */
  inclinationRad: number;
  /** Argument of periapsis / longitude (rad). */
  argumentRad: number;
  /** Stellar radius r₁ (m). */
  starRadiusM: number;
  /** Planet radius r₂ (m). */
  planetRadiusM: number;
  /** Stellar effective temperature (K). */
  starTempK: number;
  /** Planet blackbody temperature (K) — fixed at 500 in the sim. */
  planetTempK: number;
};

/** Result of {@link findEclipseInterval} for the planet-in-front (body 1) eclipse. */
export type EclipseInterval = {
  /** Whether the planet transits the star at all. */
  occurs: boolean;
  /** True anomaly (rad) at which the planet's disk first touches the star's. */
  startTrueAnomaly: number;
  /** True anomaly (rad) at last contact. */
  endTrueAnomaly: number;
  /** True anomaly (rad) at mid-transit. */
  midTrueAnomaly: number;
  /** Orbital phase (0–1) at first contact. */
  startPhase: number;
  /** Orbital phase (0–1) at last contact. */
  endPhase: number;
  /** Fraction of the orbital period spent in transit. */
  durationPhase: number;
};

const NO_ECLIPSE: EclipseInterval = {
  occurs: false,
  startTrueAnomaly: 0,
  endTrueAnomaly: 0,
  midTrueAnomaly: 0,
  startPhase: 0,
  endPhase: 0,
  durationPhase: 0,
};

/**
 * Bolometric correction BC(T): a piecewise 5th-order polynomial in log₁₀T,
 * verbatim from `getBolometricCorrection`.
 */
export function bolometricCorrection(temperatureK: number): number {
  const logTeff = Math.log(temperatureK) / Math.LN10; // 2.302585092994046 in the Flash source
  let a: number;
  let b: number;
  let c: number;
  let d: number;
  let e: number;
  let f: number;
  if (logTeff > 3.9) {
    a = -100139.4991;
    b = 116264.1842;
    c = -53931.97541;
    d = 12495.04227;
    e = -1445.868048;
    f = 66.84924471;
  } else if (logTeff < 3.7) {
    a = -13884.14899;
    b = 8595.127427;
    c = -488.3425525;
    d = -627.0092238;
    e = 137.4608131;
    f = -7.549572042;
  } else {
    a = 1439.981506;
    b = -151.9002581;
    c = -995.1089203;
    d = 582.5176671;
    e = -123.3293641;
    f = 9.160761128;
  }
  return a + logTeff * (b + logTeff * (c + logTeff * (d + logTeff * (e + f * logTeff))));
}

/**
 * Per-area visual flux of a blackbody disk (the `H` factor):
 *   H = 1.89553328524593e-43 · T⁴ · 10^(BC(T)/2.5)
 */
export function blackbodyVisualFactor(temperatureK: number): number {
  return FLUX_CONSTANT * temperatureK ** 4 * 10 ** (bolometricCorrection(temperatureK) / 2.5);
}

/**
 * Area of intersection of two disks of radii r₁ and r₂ whose centres are a
 * distance d apart. Ported from the `overlap` block of `Lightcurve Component II`
 * (and verified at the limits: π·min(r)² when one disk is wholly inside the
 * other, 0 when the disks just touch at d = r₁ + r₂).
 */
export function circleCircleOverlapArea(d: number, r1: number, r2: number): number {
  const R12 = r1 * r1;
  const R22 = r2 * r2;
  const Z0 = 1 / (2 * r2);
  const Z1 = (R22 - R12) * Z0;
  const Z2 = 1 / (2 * r1);
  const Z3 = (R12 - R22) * Z2;
  const safeD = d === 0 ? 1e-8 : d;
  const ca = clamp(Z0 * safeD + Z1 / safeD, -1, 1);
  const cb = clamp(Z2 * safeD + Z3 / safeD, -1, 1);
  const alpha = Math.acos(ca);
  const beta = Math.acos(cb);
  return R22 * (alpha - ca * Math.sin(alpha)) + R12 * (beta - cb * Math.sin(beta));
}

/**
 * Sky-projected centre-to-centre separation d of the two disks at a given true
 * anomaly (m). Ported from the `d = sqrt(...)` line of `addVisFlux…`.
 */
export function projectedSeparation(trueAnomaly: number, system: TransitSystem): number {
  const { separationM: a, eccentricity: e, inclinationRad: i, argumentRad: w } = system;
  const cosI = Math.cos(i);
  const J0 = a * (1 - e * e);
  const J1 = J0 * J0 * (1 - cosI * cosI);
  const J2 = J0 * J0 * cosI * cosI;
  const cosWV = Math.cos(w + trueAnomaly);
  const cosV = Math.cos(trueAnomaly);
  const numerator = J1 * cosWV * cosWV + J2;
  const denominator = 1 + 2 * e * cosV + e * e * cosV * cosV; // (1 + e·cos ν)²
  return Math.sqrt(numerator / denominator);
}

/**
 * The Flash eclipse test function f(ν): f < 0 exactly when the two disks overlap
 * (equivalently d < r₁ + r₂). Same K₁…K₄ coefficients as `getCurveEventsObject`.
 */
export function eclipseFunction(trueAnomaly: number, system: TransitSystem): number {
  const {
    separationM: a,
    eccentricity: e,
    inclinationRad: i,
    argumentRad: w,
    starRadiusM: r1,
    planetRadiusM: r2,
  } = system;
  const R = (r1 + r2) / a;
  const S2 = Math.cos(i) * Math.cos(i);
  const S1 = 1 - S2;
  const oneMinusE2Sq = (1 - e * e) * (1 - e * e);
  const K1 = oneMinusE2Sq * S1;
  const K2 = -e * e * R * R;
  const K3 = -2 * e * R * R;
  const K4 = oneMinusE2Sq * S2 - R * R;
  const cosWV = Math.cos(trueAnomaly + w);
  const cosV = Math.cos(trueAnomaly);
  return K1 * cosWV * cosWV + K2 * cosV * cosV + K3 * cosV + K4;
}

/** True when the planet (body 2) is in front of the star at this true anomaly. */
function planetInFront(trueAnomaly: number, argumentRad: number): boolean {
  return Math.sin(trueAnomaly + argumentRad) > 0;
}

/**
 * Normalized flux (1 = unocculted) at a given true anomaly. When the disks
 * overlap, the occulted body's per-area flux times the overlap area is removed.
 */
export function normalizedFluxAtTrueAnomaly(trueAnomaly: number, system: TransitSystem): number {
  const { starRadiusM: r1, planetRadiusM: r2, starTempK, planetTempK, argumentRad } = system;
  const H1 = blackbodyVisualFactor(starTempK);
  const H2 = blackbodyVisualFactor(planetTempK);
  const maxVisualFlux = (r1 * r1 * H1 + r2 * r2 * H2) * Math.PI;

  const d = projectedSeparation(trueAnomaly, system);
  if (d >= r1 + r2) {
    return 1;
  }
  const overlap = circleCircleOverlapArea(d, r1, r2);
  // Whichever body is behind is the one being occulted.
  const occultedFactor = planetInFront(trueAnomaly, argumentRad) ? H1 : H2;
  return (maxVisualFlux - occultedFactor * overlap) / maxVisualFlux;
}

/**
 * Normalized flux at an orbital phase (0–1, measured from periapsis). Solves
 * Kepler's equation then defers to {@link normalizedFluxAtTrueAnomaly}.
 */
export function normalizedFluxAtPhase(phase: number, system: TransitSystem): number {
  const e = system.eccentricity;
  const meanAnomaly = phase * TWO_PI;
  const trueAnomaly = eccentricToTrueAnomaly(meanToEccentricAnomaly(meanAnomaly, e), e);
  return normalizedFluxAtTrueAnomaly(trueAnomaly, system);
}

/** Bisect f = `eclipseFunction` for its root between two angles of opposite sign. */
function bisectEclipseRoot(lo: number, hi: number, system: TransitSystem): number {
  let a = lo;
  let b = hi;
  let fa = eclipseFunction(a, system);
  for (let iter = 0; iter < 80; iter++) {
    const mid = (a + b) / 2;
    const fMid = eclipseFunction(mid, system);
    if (fMid === 0) {
      return mid;
    }
    if (fa < 0 === fMid < 0) {
      a = mid;
      fa = fMid;
    } else {
      b = mid;
    }
  }
  return (a + b) / 2;
}

/**
 * Locate the planet-in-front transit (the "eclipse of body 1"). Returns
 * {@link NO_ECLIPSE} for a non-transiting geometry. The contiguous arc where
 * f < 0 and the planet is in front is found by a fine scan, then its endpoints
 * are refined to the f = 0 contacts by bisection.
 */
export function findEclipseInterval(system: TransitSystem): EclipseInterval {
  const { argumentRad: w, eccentricity: e } = system;
  const samples = 2048;
  const step = TWO_PI / samples;

  const flags: boolean[] = new Array(samples);
  let anyTrue = false;
  let allTrue = true;
  for (let k = 0; k < samples; k++) {
    const v = k * step;
    const inEclipse = eclipseFunction(v, system) < 0 && planetInFront(v, w);
    flags[k] = inEclipse;
    anyTrue = anyTrue || inEclipse;
    allTrue = allTrue && inEclipse;
  }
  if (allTrue) {
    return NO_ECLIPSE;
  }
  if (!anyTrue) {
    // Wide orbits around small stars give a transit arc narrower than one scan
    // step; look again at the minimum of f near inferior conjunction.
    return findNarrowEclipseInterval(system);
  }

  // First sample entering the arc (false → true) and last sample (true → false).
  let startK = -1;
  let endK = -1;
  for (let k = 0; k < samples; k++) {
    if (flags[k] && !flags[(k - 1 + samples) % samples]) {
      startK = k;
    }
    if (flags[k] && !flags[(k + 1) % samples]) {
      endK = k;
    }
  }

  // Refine the two f = 0 contacts (angles may be < 0 or > 2π; f is 2π-periodic).
  const startTrueAnomaly = normalizeAngle(bisectEclipseRoot(startK * step - step, startK * step, system));
  const endTrueAnomaly = normalizeAngle(bisectEclipseRoot(endK * step, endK * step + step, system));
  return eclipseIntervalFromContacts(startTrueAnomaly, endTrueAnomaly, e);
}

/** Builds the interval record from refined first/last-contact true anomalies. */
function eclipseIntervalFromContacts(startTrueAnomaly: number, endTrueAnomaly: number, e: number): EclipseInterval {
  const startPhase = phaseFromTrueAnomaly(startTrueAnomaly, e);
  const endPhase = phaseFromTrueAnomaly(endTrueAnomaly, e);
  let durationPhase = endPhase - startPhase;
  if (durationPhase < 0) {
    durationPhase += 1;
  }

  let arc = endTrueAnomaly - startTrueAnomaly;
  if (arc < 0) {
    arc += TWO_PI;
  }
  const midTrueAnomaly = normalizeAngle(startTrueAnomaly + arc / 2);

  return { occurs: true, startTrueAnomaly, endTrueAnomaly, midTrueAnomaly, startPhase, endPhase, durationPhase };
}

/**
 * Fallback for transits narrower than the coarse scan: minimise f around
 * inferior conjunction (ν = π/2 − ω, where sin(ν + ω) = 1) by golden-section
 * search, then bisect outward to the two contacts.
 */
function findNarrowEclipseInterval(system: TransitSystem): EclipseInterval {
  const conjunction = Math.PI / 2 - system.argumentRad;
  let lo = conjunction - NARROW_SEARCH_HALF_WIDTH;
  let hi = conjunction + NARROW_SEARCH_HALF_WIDTH;
  const invPhi = (Math.sqrt(5) - 1) / 2;
  for (let iter = 0; iter < 100; iter++) {
    const m1 = hi - invPhi * (hi - lo);
    const m2 = lo + invPhi * (hi - lo);
    if (eclipseFunction(m1, system) < eclipseFunction(m2, system)) {
      hi = m2;
    } else {
      lo = m1;
    }
  }
  const vMin = (lo + hi) / 2;
  if (eclipseFunction(vMin, system) >= 0 || !planetInFront(vMin, system.argumentRad)) {
    return NO_ECLIPSE;
  }
  const edgeLo = conjunction - NARROW_SEARCH_HALF_WIDTH;
  const edgeHi = conjunction + NARROW_SEARCH_HALF_WIDTH;
  const startTrueAnomaly = normalizeAngle(bisectEclipseRoot(edgeLo, vMin, system));
  const endTrueAnomaly = normalizeAngle(bisectEclipseRoot(vMin, edgeHi, system));
  return eclipseIntervalFromContacts(startTrueAnomaly, endTrueAnomaly, system.eccentricity);
}

/** Half-width (rad) of the conjunction neighbourhood searched for narrow transits. */
const NARROW_SEARCH_HALF_WIDTH = 0.3;

/** Fraction of the light-curve window left blank on each side of the transit (Flash `horizontalMargin`). */
export const TRANSIT_WINDOW_MARGIN = 0.15;

/** Half-width (phase) of the window shown when no transit occurs (Flash `delta`). */
export const NO_TRANSIT_WINDOW_HALF_WIDTH = 0.001;

/**
 * The phase window the light curve displays — the NAAP "eclipse of body 1"
 * region: the transit plus a 15 % margin each side, or a tiny window around
 * where the transit would be when it does not occur. Bounds are *unwrapped*:
 * `min` may be negative and `max` may exceed 1.
 */
export function transitPhaseWindow(system: TransitSystem, interval: EclipseInterval): Range {
  if (interval.occurs && interval.durationPhase > 0) {
    const width = interval.durationPhase / (1 - 2 * TRANSIT_WINDOW_MARGIN);
    const min = interval.startPhase - TRANSIT_WINDOW_MARGIN * width;
    return new Range(min, min + width);
  }
  const center = phaseFromTrueAnomaly(Math.PI / 2 - system.argumentRad, system.eccentricity);
  return new Range(center - NO_TRANSIT_WINDOW_HALF_WIDTH, center + NO_TRANSIT_WINDOW_HALF_WIDTH);
}

/** Wraps any phase into [0, 1). */
export function wrapPhase(phase: number): number {
  return ((phase % 1) + 1) % 1;
}

/**
 * Maps an orbital phase (0–1) onto the unwrapped coordinate of `window`, or
 * returns null when the phase lies outside the window.
 */
export function unwrapPhaseIntoWindow(phase: number, window: Range): number | null {
  for (const shift of [0, 1, -1, 2, -2]) {
    const candidate = phase + shift;
    if (window.contains(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Eclipse depth: the maximum fractional flux drop during transit
 * (`(maxVisualFlux − minVisualFlux) / maxVisualFlux`), found by sampling the
 * flux across the transit arc. Returns 0 when there is no transit.
 */
export function eclipseDepth(system: TransitSystem): number {
  const interval = findEclipseInterval(system);
  if (!interval.occurs) {
    return 0;
  }
  let arc = interval.endTrueAnomaly - interval.startTrueAnomaly;
  if (arc < 0) {
    arc += TWO_PI;
  }
  const samples = 400;
  let minFlux = 1;
  for (let k = 0; k <= samples; k++) {
    const v = interval.startTrueAnomaly + (k / samples) * arc;
    const flux = normalizedFluxAtTrueAnomaly(v, system);
    if (flux < minFlux) {
      minFlux = flux;
    }
  }
  return 1 - minFlux;
}

/** Wrap an angle into [0, 2π). */
function normalizeAngle(angle: number): number {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}
