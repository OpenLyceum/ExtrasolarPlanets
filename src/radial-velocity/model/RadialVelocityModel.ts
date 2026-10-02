/**
 * RadialVelocityModel.ts
 *
 * Model for the Radial Velocity (Doppler-wobble) screen. Holds the orbital and
 * measurement control Properties and exposes the derived observables — orbital
 * period, RV semi-amplitude K, systemic velocity, and host-star properties —
 * that the readouts and the chart bind to.
 *
 * Physics lives in the pure helpers under src/common; this class only wires
 * Properties together. Units: masses in solar / Jupiter masses, axis in AU,
 * angles in degrees (converted to radians where the maths needs them).
 */

import {
  BooleanProperty,
  DerivedProperty,
  Multilink,
  NumberProperty,
  Property,
  type TReadOnlyProperty,
} from "scenerystack/axon";
import { dotRandom, Vector2 } from "scenerystack/dot";
import type { TModel } from "scenerystack/joist";
import {
  centerVelocity,
  keplerPeriodSeconds,
  meanToTrueAnomaly,
  radialVelocityAmplitude,
  radialVelocityAtTrueAnomaly,
} from "../../common/OrbitalMechanics.js";
import { polarGaussian } from "../../common/RandomUtils.js";
import { deriveStarProperties, type StarProperties } from "../../common/StarProperties.js";
import { TimeModel } from "../../common/TimeModel.js";
import {
  AU_M,
  CHART_CURVE_SAMPLES,
  M_SUN_KG,
  RADIAL_VELOCITY_DEFAULT_PRESET,
  type RadialVelocityPreset,
  RV_ANIMATION_SPEED_DEFAULT,
  RV_ANIMATION_SPEED_RANGE,
  RV_ECCENTRICITY_DEFAULT,
  RV_ECCENTRICITY_RANGE,
  RV_INCLINATION_DEFAULT,
  RV_INCLINATION_RANGE,
  RV_LONGITUDE_DEFAULT,
  RV_LONGITUDE_RANGE,
  RV_M_JUP_KG,
  RV_NOISE_DEFAULT,
  RV_NOISE_RANGE,
  RV_NUMBER_OF_MEASUREMENTS_DEFAULT,
  RV_NUMBER_OF_MEASUREMENTS_RANGE,
  RV_PHASE_DEFAULT,
  RV_PHASE_RANGE,
  RV_PLANET_MASS_DEFAULT,
  RV_PLANET_MASS_RANGE,
  RV_SEMIMAJOR_AXIS_DEFAULT,
  RV_SEMIMAJOR_AXIS_RANGE,
  RV_STAR_MASS_DEFAULT,
  RV_STAR_MASS_RANGE,
  SECONDS_PER_DAY,
} from "../../ExtrasolarPlanetsConstants.js";

const DEG_TO_RAD = Math.PI / 180;

export class RadialVelocityModel implements TModel {
  // ── Orbital / system controls ───────────────────────────────────────────────
  public readonly planetMassProperty = new NumberProperty(RV_PLANET_MASS_DEFAULT, { range: RV_PLANET_MASS_RANGE }); // M_Jup
  public readonly starMassProperty = new NumberProperty(RV_STAR_MASS_DEFAULT, { range: RV_STAR_MASS_RANGE }); // M_Sun
  public readonly semimajorAxisProperty = new NumberProperty(RV_SEMIMAJOR_AXIS_DEFAULT, {
    range: RV_SEMIMAJOR_AXIS_RANGE,
    units: "AU",
  });
  public readonly eccentricityProperty = new NumberProperty(RV_ECCENTRICITY_DEFAULT, { range: RV_ECCENTRICITY_RANGE });
  public readonly inclinationProperty = new NumberProperty(RV_INCLINATION_DEFAULT, { range: RV_INCLINATION_RANGE }); // degrees
  public readonly longitudeProperty = new NumberProperty(RV_LONGITUDE_DEFAULT, { range: RV_LONGITUDE_RANGE }); // degrees

  /**
   * The currently-selected preset (drives the preset ComboBox). Initialized to
   * Option A, whose tuple matches the NumberProperty defaults above, so the
   * combo, the slider values, and Reset all agree. Dragging a slider does NOT
   * clear the selection (standard PhET behaviour) — the combo still names the
   * last-chosen preset.
   */
  public readonly presetProperty = new Property<RadialVelocityPreset>(RADIAL_VELOCITY_DEFAULT_PRESET);

  // ── Measurement controls ──────────────────────────────────────────────────────
  public readonly noiseProperty = new NumberProperty(RV_NOISE_DEFAULT, { range: RV_NOISE_RANGE }); // m/s
  public readonly numberOfMeasurementsProperty = new NumberProperty(RV_NUMBER_OF_MEASUREMENTS_DEFAULT, {
    range: RV_NUMBER_OF_MEASUREMENTS_RANGE,
  });

  // ── View toggles ──────────────────────────────────────────────────────────────
  public readonly showTheoreticalCurveProperty = new BooleanProperty(true);
  public readonly showSimulatedMeasurementsProperty = new BooleanProperty(false);
  public readonly showMultipleViewsProperty = new BooleanProperty(false);

  // ── Animation ─────────────────────────────────────────────────────────────────
  public readonly timer = new TimeModel();
  /** Orbital phase 0–1 (drives the chart cursor and the orbit views). */
  public readonly phaseProperty = new NumberProperty(RV_PHASE_DEFAULT, { range: RV_PHASE_RANGE });
  /**
   * Phase increment per 60-fps frame (made frame-rate independent in step()).
   * The slider value range mirrors the Flash animation-speed control.
   */
  public readonly animationSpeedProperty = new NumberProperty(RV_ANIMATION_SPEED_DEFAULT, {
    range: RV_ANIMATION_SPEED_RANGE,
  });

  // ── Derived observables ───────────────────────────────────────────────────────
  /** Host-star main-sequence properties derived from its mass. */
  public readonly starPropertiesProperty: TReadOnlyProperty<StarProperties>;
  /** Orbital period in seconds. */
  public readonly periodSecondsProperty: TReadOnlyProperty<number>;
  /** Orbital period in days (readout). */
  public readonly periodDaysProperty: TReadOnlyProperty<number>;
  /** Radial-velocity semi-amplitude K in m/s (readout + chart y-range). */
  public readonly amplitudeProperty: TReadOnlyProperty<number>;
  /** Systemic centre-of-mass velocity offset in m/s. */
  public readonly centerVelocityProperty: TReadOnlyProperty<number>;
  /**
   * The theoretical radial-velocity curve as (phase, velocity m/s) points across
   * one full orbit, phase ∈ [0, 1]. Drives the chart's theoretical LinePlot.
   */
  public readonly theoreticalCurveProperty: TReadOnlyProperty<Vector2[]>;
  /**
   * Simulated RV measurements: (phase, velocity m/s) scatter points generated
   * by adding Marsaglia-polar Gaussian noise (σ = noise slider) to the
   * theoretical curve at random mean anomalies. Re-rolled whenever any physics
   * input or the noise/number-of-measurements controls change.
   */
  public readonly measurementsProperty: Property<Vector2[]>;

  public constructor() {
    this.starPropertiesProperty = new DerivedProperty([this.starMassProperty], (starMass) =>
      deriveStarProperties(starMass),
    );

    this.periodSecondsProperty = new DerivedProperty(
      [this.starMassProperty, this.planetMassProperty, this.semimajorAxisProperty],
      (starMass, planetMass, axisAU) =>
        keplerPeriodSeconds(starMass * M_SUN_KG + planetMass * RV_M_JUP_KG, axisAU * AU_M),
    );

    this.periodDaysProperty = new DerivedProperty(
      [this.periodSecondsProperty],
      (periodSeconds) => periodSeconds / SECONDS_PER_DAY,
    );

    this.amplitudeProperty = new DerivedProperty(
      [
        this.periodSecondsProperty,
        this.starMassProperty,
        this.planetMassProperty,
        this.semimajorAxisProperty,
        this.inclinationProperty,
        this.eccentricityProperty,
      ],
      (periodSeconds, starMass, planetMass, axisAU, inclinationDeg, eccentricity) => {
        // a1 = (m2/m1)·a — the Flash approximation for the star's orbit.
        const starAxisM = ((planetMass * RV_M_JUP_KG) / (starMass * M_SUN_KG)) * axisAU * AU_M;
        return radialVelocityAmplitude(periodSeconds, starAxisM, inclinationDeg * DEG_TO_RAD, eccentricity);
      },
    );

    this.centerVelocityProperty = new DerivedProperty(
      [this.amplitudeProperty, this.eccentricityProperty, this.longitudeProperty],
      (amplitude, eccentricity, longitudeDeg) => centerVelocity(amplitude, eccentricity, longitudeDeg * DEG_TO_RAD),
    );

    this.theoreticalCurveProperty = new DerivedProperty(
      [this.amplitudeProperty, this.centerVelocityProperty, this.longitudeProperty, this.eccentricityProperty],
      (amplitude, centerVel, longitudeDeg, eccentricity) => {
        const argumentRad = longitudeDeg * DEG_TO_RAD;
        const points: Vector2[] = [];
        for (let k = 0; k <= CHART_CURVE_SAMPLES; k++) {
          const phase = k / CHART_CURVE_SAMPLES;
          const trueAnomaly = meanToTrueAnomaly(phase * 2 * Math.PI, eccentricity);
          const velocity = radialVelocityAtTrueAnomaly(amplitude, argumentRad, trueAnomaly, centerVel);
          points.push(new Vector2(phase, velocity));
        }
        return points;
      },
    );

    // ── Simulated measurements ───────────────────────────────────────────────────
    // A single Multilink over the physics inputs + noise/number keeps the scatter
    // stable between parameter changes (not re-rolled per derived-property recompute).
    this.measurementsProperty = new Property<Vector2[]>([]);
    Multilink.multilink(
      [
        this.amplitudeProperty,
        this.centerVelocityProperty,
        this.longitudeProperty,
        this.eccentricityProperty,
        this.noiseProperty,
        this.numberOfMeasurementsProperty,
      ],
      () => this.regenerateMeasurements(),
    );

    // ── Preset selection ────────────────────────────────────────────────────────
    // lazyLink (not link) so applying the initial Option A on construction is a
    // no-op — its tuple already matches the NumberProperty defaults.
    this.presetProperty.lazyLink((preset) => this.applyPreset(preset));
  }

  /**
   * Applies a preset's six orbital parameters (never noise, number of
   * measurements, animation speed, or phase).
   */
  public applyPreset(preset: RadialVelocityPreset): void {
    this.starMassProperty.value = preset.starMass;
    this.planetMassProperty.value = preset.planetMass;
    this.eccentricityProperty.value = preset.eccentricity;
    this.semimajorAxisProperty.value = preset.separation;
    this.inclinationProperty.value = preset.inclination;
    this.longitudeProperty.value = preset.longitude;
  }

  /**
   * Regenerates the simulated measurements: draws `numberOfMeasurements` random
   * mean anomalies, converts each to a true anomaly + theoretical velocity, and
   * adds Marsaglia-polar Gaussian noise (σ = noise slider value directly).
   */
  private regenerateMeasurements(): void {
    const n = this.numberOfMeasurementsProperty.value;
    const noise = this.noiseProperty.value;
    const amplitude = this.amplitudeProperty.value;
    const centerVel = this.centerVelocityProperty.value;
    const argumentRad = this.longitudeProperty.value * DEG_TO_RAD;
    const eccentricity = this.eccentricityProperty.value;
    const points: Vector2[] = [];
    for (let i = 0; i < n; i++) {
      const meanAnomaly = dotRandom.nextDouble() * 2 * Math.PI;
      const phase = meanAnomaly / (2 * Math.PI);
      const trueAnomaly = meanToTrueAnomaly(meanAnomaly, eccentricity);
      const velocity = radialVelocityAtTrueAnomaly(amplitude, argumentRad, trueAnomaly, centerVel);
      points.push(new Vector2(phase, velocity + polarGaussian(0, noise)));
    }
    this.measurementsProperty.value = points;
  }

  /**
   * Steps the animation clock forward and, while playing, advances the orbital
   * phase by the animation speed (treated as phase-per-frame at 60 fps, scaled
   * by dt so it is frame-rate independent).
   */
  public step(dt: number): void {
    this.timer.step(dt);
    if (this.timer.isPlayingProperty.value) {
      const phase = this.phaseProperty.value + this.animationSpeedProperty.value * dt * 60;
      this.phaseProperty.value = ((phase % 1) + 1) % 1;
    }
  }

  /** Resets all model state to initial values. */
  public reset(): void {
    this.planetMassProperty.reset();
    this.starMassProperty.reset();
    this.semimajorAxisProperty.reset();
    this.eccentricityProperty.reset();
    this.inclinationProperty.reset();
    this.longitudeProperty.reset();
    this.noiseProperty.reset();
    this.numberOfMeasurementsProperty.reset();
    this.showTheoreticalCurveProperty.reset();
    this.showSimulatedMeasurementsProperty.reset();
    this.showMultipleViewsProperty.reset();
    this.phaseProperty.reset();
    this.animationSpeedProperty.reset();
    this.presetProperty.reset();
    this.timer.reset();
  }
}
