/**
 * OrbitalMechanics.ts
 *
 * Pure, UI-free two-body orbital-mechanics helpers shared by both screens.
 * Every function is a faithful transcription of the maths in the NAAP Flash
 * sources (`Radial Velocity Component.as`, `Binary System Component.as`,
 * `Lightcurve Component II.as`).
 *
 * Angle units are radians; SI everywhere else (m, kg, s). No SceneryStack types
 * are referenced so these functions are trivially unit-testable.
 */

import { FOUR_PI_SQUARED, G_SI, KEPLER_MAX_ITERATIONS, KEPLER_TOLERANCE } from "../ExtrasolarPlanetsConstants.js";

/**
 * Orbital period (seconds) from Kepler's third law.
 *
 *   P = √( 4π² · a³ / (G · M_total) )
 *
 * Flash: `Math.sqrt(39.47841760435743 * a*a*a / (6.673e-11 * (mass1 + mass2)))`.
 *
 * @param totalMassKg - m₁ + m₂ in kilograms
 * @param semiMajorAxisM - semi-major axis of the relative orbit, in metres
 */
export function keplerPeriodSeconds(totalMassKg: number, semiMajorAxisM: number): number {
  return Math.sqrt((FOUR_PI_SQUARED * semiMajorAxisM * semiMajorAxisM * semiMajorAxisM) / (G_SI * totalMassKg));
}

/**
 * Ratio √((1+e)/(1−e)) — the recurring eccentricity factor (`C1`/`k` in Flash)
 * relating eccentric and true anomaly.
 * @internal Exported for unit tests; not part of the application API.
 */
export function kFactor(eccentricity: number): number {
  return Math.sqrt((1 + eccentricity) / (1 - eccentricity));
}

/**
 * Solve Kepler's equation M = E − e·sin E for the eccentric anomaly E using
 * Newton–Raphson, seeded at E₀ = M (the Flash seed). Iterates the exact Flash
 * update step `E ← E + (M + e·sinE − E)/(1 − e·cosE)`.
 *
 * The Flash sources stop at |ΔE| > 1e-3; we default to the tighter
 * KEPLER_TOLERANCE (1e-8) — same algorithm, strictly more accurate.
 */
export function meanToEccentricAnomaly(
  meanAnomaly: number,
  eccentricity: number,
  tolerance: number = KEPLER_TOLERANCE,
  maxIterations: number = KEPLER_MAX_ITERATIONS,
): number {
  let previous = 0;
  let current = meanAnomaly;
  let iterations = 0;
  do {
    previous = current;
    current =
      previous + (meanAnomaly + eccentricity * Math.sin(previous) - previous) / (1 - eccentricity * Math.cos(previous));
    iterations++;
  } while (Math.abs(current - previous) > tolerance && iterations < maxIterations);
  return current;
}

/**
 * True anomaly from eccentric anomaly. Uses the numerically-robust atan2 form
 *   ν = 2·atan2( √(1+e)·sin(E/2), √(1−e)·cos(E/2) )
 * which is wrap-safe and equivalent to the Flash `2·atan(k·tan(E/2))`.
 * Returns a value in (−π, π].
 */
export function eccentricToTrueAnomaly(eccentricAnomaly: number, eccentricity: number): number {
  const halfE = eccentricAnomaly / 2;
  return 2 * Math.atan2(Math.sqrt(1 + eccentricity) * Math.sin(halfE), Math.sqrt(1 - eccentricity) * Math.cos(halfE));
}

/**
 * Mean anomaly from eccentric anomaly: M = E − e·sin E.
 * @internal Exported for unit tests; not part of the application API.
 */
export function eccentricToMeanAnomaly(eccentricAnomaly: number, eccentricity: number): number {
  return eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly);
}

/**
 * Eccentric anomaly from true anomaly (inverse of {@link eccentricToTrueAnomaly}).
 *   E = 2·atan2( √(1−e)·sin(ν/2), √(1+e)·cos(ν/2) )
 * @internal Exported for unit tests; not part of the application API.
 */
export function trueToEccentricAnomaly(trueAnomaly: number, eccentricity: number): number {
  const halfV = trueAnomaly / 2;
  return 2 * Math.atan2(Math.sqrt(1 - eccentricity) * Math.sin(halfV), Math.sqrt(1 + eccentricity) * Math.cos(halfV));
}

/** Convenience: true anomaly directly from mean anomaly (solves Kepler first). */
export function meanToTrueAnomaly(meanAnomaly: number, eccentricity: number): number {
  return eccentricToTrueAnomaly(meanToEccentricAnomaly(meanAnomaly, eccentricity), eccentricity);
}

/**
 * Mean anomaly directly from true anomaly.
 * @internal Exported for unit tests; not part of the application API.
 */
export function trueToMeanAnomaly(trueAnomaly: number, eccentricity: number): number {
  return eccentricToMeanAnomaly(trueToEccentricAnomaly(trueAnomaly, eccentricity), eccentricity);
}

/**
 * Orbital-phase (0–1, measured from periapsis) corresponding to a true anomaly.
 * Matches the Flash `getPhaseFromTrueAnomaly` helper.
 */
export function phaseFromTrueAnomaly(trueAnomaly: number, eccentricity: number): number {
  const meanAnomaly = trueToMeanAnomaly(trueAnomaly, eccentricity);
  return (((meanAnomaly / (2 * Math.PI)) % 1) + 1) % 1;
}

/**
 * Radial-velocity semi-amplitude K (m/s):
 *   K = (2π / P) · a₁ · sin i / √(1 − e²)
 * where a₁ is the star's semi-major axis about the barycentre.
 * Flash: `K = 6.283185307179586 / P * a1 * Math.sin(i) / Math.sqrt(1 - e*e)`.
 */
export function radialVelocityAmplitude(
  periodSeconds: number,
  starSemiMajorAxisM: number,
  inclinationRad: number,
  eccentricity: number,
): number {
  return (
    (((2 * Math.PI) / periodSeconds) * starSemiMajorAxisM * Math.sin(inclinationRad)) /
    Math.sqrt(1 - eccentricity * eccentricity)
  );
}

/**
 * Systemic (centre-of-mass) radial velocity offset:
 *   v_center = K · e · cos ω
 * Flash: `centerVelocity = K * e * Math.cos(argument)`.
 */
export function centerVelocity(amplitude: number, eccentricity: number, argumentRad: number): number {
  return amplitude * eccentricity * Math.cos(argumentRad);
}

/**
 * Full line-of-sight radial velocity at a given true anomaly:
 *   v(ν) = K · cos(ω + ν) + v_center
 */
export function radialVelocityAtTrueAnomaly(
  amplitude: number,
  argumentRad: number,
  trueAnomaly: number,
  centerVelocityValue: number,
): number {
  return amplitude * Math.cos(argumentRad + trueAnomaly) + centerVelocityValue;
}
