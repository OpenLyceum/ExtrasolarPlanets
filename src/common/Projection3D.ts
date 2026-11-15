/**
 * Projection3D.ts
 *
 * A tiny, dependency-light 3-D math kit for the radial-velocity screen's
 * rotating "3-D orbit" sub-view. It rotates orbit-plane points by the orbital
 * inclination / longitude and a camera orientation, then projects them
 * orthographically to 2-D so the whole view can be drawn with ordinary scenery
 * `Path`/`Line` nodes (no WebGL).
 *
 * Everything here is pure `Vector2`/`Vector3` math, so it is straightforward to
 * unit-test and reuse. Angles are radians; lengths are whatever the caller
 * passes in (metres for orbit positions).
 */

import { Vector2, Vector3 } from "scenerystack/dot";

/** Rotate a point about the x-axis by `angle` radians (right-handed). */
export function rotateX(point: Vector3, angle: number): Vector3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Vector3(point.x, point.y * c - point.z * s, point.y * s + point.z * c);
}

/**
 * Rotate a point about the y-axis by `angle` radians (right-handed).
 * @internal Exported for unit tests; not part of the application API.
 */
export function rotateY(point: Vector3, angle: number): Vector3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Vector3(point.x * c + point.z * s, point.y, -point.x * s + point.z * c);
}

/**
 * Rotate a point about the z-axis by `angle` radians (right-handed).
 * @internal Exported for unit tests; not part of the application API.
 */
export function rotateZ(point: Vector3, angle: number): Vector3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Vector3(point.x * c - point.y * s, point.x * s + point.y * c, point.z);
}

/**
 * Position of the orbiting body relative to the focus (the star), expressed in
 * the orbital plane (z = 0).
 *
 *   r = a(1 − e²) / (1 + e·cos ν)
 *   (x, y) = r · (cos(ν + ω), sin(ν + ω))
 *
 * where ν is the true anomaly and ω the argument of periapsis. At ν = 0 the body
 * sits at periapsis (distance a(1−e)); at ν = π at apoapsis (a(1+e)).
 */
export function orbitalPlanePosition(
  trueAnomaly: number,
  semiMajorAxis: number,
  eccentricity: number,
  argumentRad = 0,
): Vector3 {
  const r = (semiMajorAxis * (1 - eccentricity * eccentricity)) / (1 + eccentricity * Math.cos(trueAnomaly));
  const angle = trueAnomaly + argumentRad;
  return new Vector3(r * Math.cos(angle), r * Math.sin(angle), 0);
}

/** Camera orientation for {@link projectToScreen}: azimuth (φ) then elevation (θ). */
export type CameraOrientation = { thetaRad: number; phiRad: number };

/**
 * Orthographically project a 3-D world point to 2-D screen space through a
 * camera rotated by azimuth φ (about z) and elevation θ (about x). With
 * θ = φ = 0 this is the identity on the (x, y) plane (z is depth, dropped).
 */
export function projectToScreen(point: Vector3, camera: CameraOrientation): Vector2 {
  const rotated = rotateX(rotateZ(point, -camera.phiRad), -camera.thetaRad);
  return new Vector2(rotated.x, rotated.y);
}
