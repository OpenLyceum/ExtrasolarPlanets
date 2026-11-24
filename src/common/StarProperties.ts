/**
 * StarProperties.ts
 *
 * Derives a main-sequence (luminosity class V) star's observable properties
 * from its mass, exactly as the NAAP simulators do. The four-step chain
 * (mass → luminosity → temperature → radius, plus a spectral-type lookup) is
 * transcribed from `getLuminosityFromMass`, `getTempFromLuminosity`,
 * `getRadiusFromTempAndLuminosity` and `getSpectralTypeFromTemp` in the transit
 * simulator's `DoAction.as` (the RV sim uses the identical functions).
 *
 * Luminosity and radius are returned in solar units (plus radius in metres);
 * temperature in kelvin. No SceneryStack types are referenced.
 */

import { roundSymmetric } from "scenerystack/dot";
import { R_SUN_M } from "../ExtrasolarPlanetsConstants.js";

// The Flash literal 2.302585092994046 is exactly Math.LN10.
const log10 = (x: number): number => Math.log(x) / Math.LN10;

/**
 * One {spectral-type-number, effective-temperature} sample of the class-V
 * sequence. `type` is a continuous index: 0–9 = O, 10–19 = B, 20–29 = A,
 * 30–39 = F, 40–49 = G, 50–59 = K, 60–69 = M (so 42 ≈ G2, 66 ≈ M6).
 */
type SpectralTypeSample = { type: number; teff: number };

/**
 * The luminosity-class-V (main-sequence) effective-temperature table, verbatim
 * from `spectralTypesAndTemps.v` in the Flash source (O7 38000 K … M6 2850 K).
 * Both ESP simulators only ever use this class.
 */
const SPECTRAL_TYPES_AND_TEMPS_V: readonly SpectralTypeSample[] = [
  { type: 7, teff: 38000 },
  { type: 9, teff: 33200 },
  { type: 9.5, teff: 31450 },
  { type: 10, teff: 29700 },
  { type: 11, teff: 25600 },
  { type: 12, teff: 22300 },
  { type: 13, teff: 19000 },
  { type: 14, teff: 17200 },
  { type: 15, teff: 15400 },
  { type: 16, teff: 14100 },
  { type: 17, teff: 13000 },
  { type: 18, teff: 11800 },
  { type: 19, teff: 10700 },
  { type: 20, teff: 9480 },
  { type: 22, teff: 8810 },
  { type: 25, teff: 8160 },
  { type: 27, teff: 7930 },
  { type: 30, teff: 7020 },
  { type: 32, teff: 6750 },
  { type: 35, teff: 6530 },
  { type: 37, teff: 6240 },
  { type: 40, teff: 5930 },
  { type: 42, teff: 5830 },
  { type: 44, teff: 5740 },
  { type: 46, teff: 5620 },
  { type: 50, teff: 5240 },
  { type: 52, teff: 5010 },
  { type: 54, teff: 4560 },
  { type: 55, teff: 4340 },
  { type: 57, teff: 4040 },
  { type: 60, teff: 3800 },
  { type: 61, teff: 3680 },
  { type: 62, teff: 3530 },
  { type: 63, teff: 3380 },
  { type: 64, teff: 3180 },
  { type: 65, teff: 3030 },
  { type: 66, teff: 2850 },
];

const TYPE_LETTERS = ["O", "B", "A", "F", "G", "K", "M"] as const;

type SpectralType = {
  /** Luminosity class — always "V" for these sims. */
  starClass: "V";
  /** Spectral-class letter (O, B, A, F, G, K, M). */
  letter: (typeof TYPE_LETTERS)[number];
  /** Sub-class digit 0–9 (e.g. 2 in "G2V"). */
  number: number;
  /** Continuous class index used for the interpolation (e.g. 42.1). */
  spectralTypeNumber: number;
  /** Human-readable label, e.g. "G2V". */
  label: string;
};

export type StarProperties = {
  /** Luminosity in solar luminosities. */
  luminosity: number;
  /** Effective temperature in kelvin. */
  temperatureK: number;
  /** Radius in solar radii (what the readouts display). */
  radiusSolarRadii: number;
  /** Radius in metres (for the flux/eclipse model). */
  radiusM: number;
  /** Spectral type, or null when the temperature is off the table. */
  spectralType: SpectralType | null;
};

/**
 * Mass–luminosity relation (solar units). Flash `getLuminosityFromMass`:
 * a broken power law with a knee at 0.43 M☉.
 * @internal Exported for unit tests; not part of the application API.
 */
export function luminosityFromMass(massMsun: number): number {
  if (massMsun < 0.43) {
    return 0.232220431737728 * massMsun ** 2.26;
  }
  return massMsun ** 3.99;
}

/**
 * Effective temperature (K) from luminosity (solar units). Flash
 * `getTempFromLuminosity`: a piecewise 6th-order polynomial in log₁₀L giving
 * log₁₀T, branch-selected by log₁₀L.
 */
function temperatureFromLuminosity(luminosityLsun: number): number {
  const logL = log10(luminosityLsun);
  let a: number;
  let b: number;
  let c: number;
  let d: number;
  let e: number;
  let f: number;
  let g: number;
  if (logL < -1.61) {
    a = 3.76424847491303;
    b = 0.140316436337353;
    c = 0.0139709648834783;
    d = 0.00146257952166353;
    e = 0.000114203991057792;
    f = 0.00000534009520193973;
    g = 1.00897501873505e-7;
  } else if (logL < 0.22) {
    a = 3.76404749064937;
    b = 0.139720836051662;
    c = 0.0131949471107482;
    d = 0.000878016217920958;
    e = -0.00016087678534046;
    f = -0.0000718923778642037;
    g = -0.0000098430921759891;
  } else if (logL < 1.48) {
    a = 3.76404935999916;
    b = 0.139700505514371;
    c = 0.0132834512392025;
    d = 0.000681148684168764;
    e = 0.0000515647954029831;
    f = -0.000230931527900807;
    g = 0.0000134429776870977;
  } else if (logL < 2.61) {
    a = 3.76208682178285;
    b = 0.14541668375348;
    c = 0.00684584757963743;
    d = 0.00396076543835346;
    e = -0.000464655201610208;
    f = -0.000381007438333072;
    g = 0.0000623586254118745;
  } else if (logL < 3.62) {
    a = 3.7785507438146;
    b = 0.129897095940252;
    c = 0.00142810707728862;
    d = 0.0167045399494531;
    e = -0.00693250229182094;
    f = 0.00103845665508301;
    g = -0.000055992055857869;
  } else if (logL < 5.43) {
    a = 3.94943146036608;
    b = -0.154281251321452;
    c = 0.1979230342627;
    d = -0.055596100619304;
    e = 0.00799539610207913;
    f = -0.000600846748510063;
    g = 0.0000187770530697032;
  } else {
    a = 4.36797099518548;
    b = -0.314871178456464;
    c = 0.143399968097621;
    d = -0.0130740129137381;
    e = -0.00159255369850374;
    f = 0.000357973227398207;
    g = -0.000017804556980593;
  }
  const logT = a + logL * (b + logL * (c + logL * (d + logL * (e + logL * (f + logL * g)))));
  return 10 ** logT;
}

/**
 * Radius in solar radii from temperature (K) and luminosity (solar units).
 * Flash `getRadiusFromTempAndLuminosity`: `33736108.2311059 · √L / T²`.
 */
function radiusSolarFromTempAndLuminosity(temperatureK: number, luminosityLsun: number): number {
  return (33736108.2311059 * Math.sqrt(luminosityLsun)) / (temperatureK * temperatureK);
}

/**
 * Interpolate a class-V spectral type from an effective temperature, mirroring
 * the Flash `getSpectralTypeFromTemp` (linear interpolation on the bracketing
 * table rows, clamped/extrapolated at the ends). Returns null when the implied
 * class index falls outside [0, 70).
 * @internal Exported for unit tests; not part of the application API.
 */
export function spectralTypeFromTemp(temperatureK: number): SpectralType | null {
  const table = SPECTRAL_TYPES_AND_TEMPS_V;
  const len = table.length;

  // First row whose temperature the star exceeds (table is hot → cool).
  let i = 0;
  while (i < len) {
    const sample = table[i];
    if (sample === undefined || temperatureK > sample.teff) {
      break;
    }
    i++;
  }

  let i1: number;
  let i2: number;
  if (i === 0) {
    i1 = 0;
    i2 = 1;
  } else if (i === len) {
    i1 = len - 2;
    i2 = len - 1;
  } else {
    i1 = i - 1;
    i2 = i;
  }

  const lo = table[i1];
  const hi = table[i2];
  if (lo === undefined || hi === undefined) {
    return null;
  }
  const slope = (hi.type - lo.type) / (hi.teff - lo.teff);
  const intercept = lo.type - slope * lo.teff;
  const spectralTypeNumber = slope * temperatureK + intercept;

  if (!Number.isFinite(spectralTypeNumber) || spectralTypeNumber < 0 || spectralTypeNumber >= 70) {
    return null;
  }

  const base = Math.floor(spectralTypeNumber / 10);
  const letter = TYPE_LETTERS[base];
  if (letter === undefined) {
    return null;
  }
  const number = spectralTypeNumber - 10 * base;

  // The display rounds the sub-class digit and collapses a rounded 10 back to 9.
  let displayNumber = roundSymmetric(number);
  if (displayNumber === 10) {
    displayNumber = 9;
  }

  return {
    starClass: "V",
    letter,
    number,
    spectralTypeNumber,
    label: `${letter}${displayNumber}V`,
  };
}

/**
 * Full derivation chain: main-sequence star properties from mass (solar units).
 */
export function deriveStarProperties(massMsun: number): StarProperties {
  const luminosity = luminosityFromMass(massMsun);
  const temperatureK = temperatureFromLuminosity(luminosity);
  const radiusSolarRadii = radiusSolarFromTempAndLuminosity(temperatureK, luminosity);
  return {
    luminosity,
    temperatureK,
    radiusSolarRadii,
    radiusM: radiusSolarRadii * R_SUN_M,
    spectralType: spectralTypeFromTemp(temperatureK),
  };
}
