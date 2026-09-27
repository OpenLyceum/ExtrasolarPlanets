/**
 * TransitModel.ts
 *
 * Model for the Transit (light-curve dip) screen. Holds the orbital, planet, and
 * measurement control Properties and exposes the derived observables — system
 * period, host-star properties, the eclipse interval, its depth and duration —
 * that the readouts and (in later milestones) the light-curve chart bind to.
 *
 * The eclipse physics lives in EclipseGeometry; this class only assembles a
 * `TransitSystem` from the controls and feeds it through.
 */

import {
  BooleanProperty,
  DerivedProperty,
  Multilink,
  NumberProperty,
  Property,
  type TReadOnlyProperty,
} from "scenerystack/axon";
import { dotRandom, type Range, Vector2 } from "scenerystack/dot";
import type { TModel } from "scenerystack/joist";
import { keplerPeriodSeconds } from "../../common/OrbitalMechanics.js";
import { polarGaussian } from "../../common/RandomUtils.js";
import { deriveStarProperties, type StarProperties } from "../../common/StarProperties.js";
import { TimeModel } from "../../common/TimeModel.js";
import {
  AU_M,
  CHART_CURVE_SAMPLES,
  M_SUN_KG,
  PLANET_TEMP_K,
  R_JUP_M,
  SECONDS_PER_DAY,
  TRANSIT_ANIMATION_SPEED_DEFAULT,
  TRANSIT_ANIMATION_SPEED_RANGE,
  TRANSIT_DEFAULT_PRESET,
  TRANSIT_ECCENTRICITY_DEFAULT,
  TRANSIT_ECCENTRICITY_RANGE,
  TRANSIT_INCLINATION_DEFAULT,
  TRANSIT_INCLINATION_RANGE,
  TRANSIT_LONGITUDE_DEFAULT,
  TRANSIT_LONGITUDE_RANGE,
  TRANSIT_M_JUP_KG,
  TRANSIT_NOISE_DEFAULT,
  TRANSIT_NOISE_RANGE,
  TRANSIT_NUMBER_OF_MEASUREMENTS_DEFAULT,
  TRANSIT_NUMBER_OF_MEASUREMENTS_RANGE,
  TRANSIT_PHASE_DEFAULT,
  TRANSIT_PHASE_RANGE,
  TRANSIT_PLANET_MASS_DEFAULT,
  TRANSIT_PLANET_MASS_RANGE,
  TRANSIT_PLANET_RADIUS_DEFAULT,
  TRANSIT_PLANET_RADIUS_RANGE,
  TRANSIT_SEMIMAJOR_AXIS_DEFAULT,
  TRANSIT_SEMIMAJOR_AXIS_RANGE,
  TRANSIT_STAR_MASS_DEFAULT,
  TRANSIT_STAR_MASS_RANGE,
  type TransitPreset,
} from "../../ExtrasolarPlanetsConstants.js";
import {
  type EclipseInterval,
  eclipseDepth,
  findEclipseInterval,
  normalizedFluxAtPhase,
  type TransitSystem,
  transitPhaseWindow,
  unwrapPhaseIntoWindow,
  wrapPhase,
} from "./EclipseGeometry.js";

const DEG_TO_RAD = Math.PI / 180;

export class TransitModel implements TModel {
  // ── Planet / orbital controls ─────────────────────────────────────────────────
  public readonly planetMassProperty = new NumberProperty(TRANSIT_PLANET_MASS_DEFAULT, {
    range: TRANSIT_PLANET_MASS_RANGE,
  }); // M_Jup
  public readonly planetRadiusProperty = new NumberProperty(TRANSIT_PLANET_RADIUS_DEFAULT, {
    range: TRANSIT_PLANET_RADIUS_RANGE,
  }); // R_Jup
  public readonly starMassProperty = new NumberProperty(TRANSIT_STAR_MASS_DEFAULT, { range: TRANSIT_STAR_MASS_RANGE }); // M_Sun
  public readonly semimajorAxisProperty = new NumberProperty(TRANSIT_SEMIMAJOR_AXIS_DEFAULT, {
    range: TRANSIT_SEMIMAJOR_AXIS_RANGE,
    units: "AU",
  });
  public readonly eccentricityProperty = new NumberProperty(TRANSIT_ECCENTRICITY_DEFAULT, {
    range: TRANSIT_ECCENTRICITY_RANGE,
  });
  public readonly inclinationProperty = new NumberProperty(TRANSIT_INCLINATION_DEFAULT, {
    range: TRANSIT_INCLINATION_RANGE,
  }); // degrees
  public readonly longitudeProperty = new NumberProperty(TRANSIT_LONGITUDE_DEFAULT, { range: TRANSIT_LONGITUDE_RANGE }); // degrees

  /**
   * The currently-selected preset (drives the preset ComboBox). Initialized to
   * Option A, whose tuple matches the NumberProperty defaults above, so the
   * combo, the slider values, and Reset all agree. Dragging a slider does NOT
   * clear the selection (standard PhET behaviour).
   */
  public readonly presetProperty = new Property<TransitPreset>(TRANSIT_DEFAULT_PRESET);

  // ── Measurement controls ──────────────────────────────────────────────────────
  public readonly noiseProperty = new NumberProperty(TRANSIT_NOISE_DEFAULT, { range: TRANSIT_NOISE_RANGE });
  public readonly numberOfMeasurementsProperty = new NumberProperty(TRANSIT_NUMBER_OF_MEASUREMENTS_DEFAULT, {
    range: TRANSIT_NUMBER_OF_MEASUREMENTS_RANGE,
  });

  // ── View toggles ──────────────────────────────────────────────────────────────
  public readonly showTheoreticalCurveProperty = new BooleanProperty(true);
  public readonly showSimulatedMeasurementsProperty = new BooleanProperty(false);

  // ── Animation ─────────────────────────────────────────────────────────────────
  public readonly timer = new TimeModel();
  /** Orbital phase 0–1 from periapsis (drives the chart cursor + transit visualization). */
  public readonly phaseProperty = new NumberProperty(TRANSIT_PHASE_DEFAULT, { range: TRANSIT_PHASE_RANGE });
  /**
   * Phase increment per 60-fps frame (made frame-rate independent in step()).
   * The slider value range mirrors the Flash animation-speed control.
   */
  public readonly animationSpeedProperty = new NumberProperty(TRANSIT_ANIMATION_SPEED_DEFAULT, {
    range: TRANSIT_ANIMATION_SPEED_RANGE,
  });

  // ── Derived observables ───────────────────────────────────────────────────────
  /** Host-star main-sequence properties derived from its mass. */
  public readonly starPropertiesProperty: TReadOnlyProperty<StarProperties>;
  /** The full transit geometry/temperature description fed to EclipseGeometry. */
  public readonly transitSystemProperty: TReadOnlyProperty<TransitSystem>;
  /** Orbital period in days (readout). */
  public readonly systemPeriodDaysProperty: TReadOnlyProperty<number>;
  /** The planet-in-front eclipse interval (or a non-transiting result). */
  public readonly eclipseIntervalProperty: TReadOnlyProperty<EclipseInterval>;
  /** Fractional transit depth (0 when there is no transit). */
  public readonly eclipseDepthProperty: TReadOnlyProperty<number>;
  /** Transit duration in hours (0 when there is no transit). */
  public readonly eclipseDurationHoursProperty: TReadOnlyProperty<number>;
  /**
   * The phase window the light curve shows — the NAAP "eclipse of body 1"
   * region (transit ± 15 % margins). Unwrapped: may extend below 0 or above 1.
   */
  public readonly chartPhaseWindowProperty: TReadOnlyProperty<Range>;
  /**
   * The theoretical light curve as (unwrapped phase, normalized-flux) points
   * across chartPhaseWindowProperty. Drives the chart's theoretical LinePlot.
   */
  public readonly fluxCurveProperty: TReadOnlyProperty<Vector2[]>;
  /**
   * Simulated flux measurements: (phase, normalized-flux) scatter points
   * generated by adding Marsaglia-polar Gaussian noise (σ = noise slider) to
   * the theoretical flux curve at random phases. Re-rolled whenever the transit
   * system or noise/number-of-measurements controls change.
   */
  public readonly measurementsProperty: Property<Vector2[]>;

  public constructor() {
    this.starPropertiesProperty = new DerivedProperty([this.starMassProperty], (starMass) =>
      deriveStarProperties(starMass),
    );

    this.transitSystemProperty = new DerivedProperty(
      [
        this.starPropertiesProperty,
        this.planetRadiusProperty,
        this.semimajorAxisProperty,
        this.eccentricityProperty,
        this.inclinationProperty,
        this.longitudeProperty,
      ],
      (star, planetRadius, axisAU, eccentricity, inclinationDeg, longitudeDeg) => ({
        separationM: axisAU * AU_M,
        eccentricity,
        inclinationRad: inclinationDeg * DEG_TO_RAD,
        argumentRad: longitudeDeg * DEG_TO_RAD,
        starRadiusM: star.radiusM,
        planetRadiusM: planetRadius * R_JUP_M,
        starTempK: star.temperatureK,
        planetTempK: PLANET_TEMP_K,
      }),
    );

    this.systemPeriodDaysProperty = new DerivedProperty(
      [this.starMassProperty, this.planetMassProperty, this.semimajorAxisProperty],
      (starMass, planetMass, axisAU) =>
        keplerPeriodSeconds(starMass * M_SUN_KG + planetMass * TRANSIT_M_JUP_KG, axisAU * AU_M) / SECONDS_PER_DAY,
    );

    this.eclipseIntervalProperty = new DerivedProperty([this.transitSystemProperty], (system) =>
      findEclipseInterval(system),
    );

    this.eclipseDepthProperty = new DerivedProperty([this.transitSystemProperty], (system) => eclipseDepth(system));

    this.eclipseDurationHoursProperty = new DerivedProperty(
      [this.eclipseIntervalProperty, this.systemPeriodDaysProperty],
      (interval, periodDays) => (interval.occurs ? interval.durationPhase * periodDays * 24 : 0),
    );

    this.chartPhaseWindowProperty = new DerivedProperty(
      [this.transitSystemProperty, this.eclipseIntervalProperty],
      (system, interval) => transitPhaseWindow(system, interval),
      { valueComparisonStrategy: "equalsFunction" },
    );

    // Like the Flash cursor, keep the phase at the same relative spot in the
    // window when the window moves (e.g. mid-transit stays mid-transit).
    this.chartPhaseWindowProperty.lazyLink((window, oldWindow) => {
      const unwrapped = unwrapPhaseIntoWindow(this.phaseProperty.value, oldWindow);
      if (unwrapped !== null) {
        const fraction = (unwrapped - oldWindow.min) / oldWindow.getLength();
        this.phaseProperty.value = wrapPhase(window.min + fraction * window.getLength());
      }
    });

    this.fluxCurveProperty = new DerivedProperty(
      [this.transitSystemProperty, this.chartPhaseWindowProperty],
      (system, window) => {
        const points: Vector2[] = [];
        for (let k = 0; k <= CHART_CURVE_SAMPLES; k++) {
          const phase = window.min + (k / CHART_CURVE_SAMPLES) * window.getLength();
          points.push(new Vector2(phase, normalizedFluxAtPhase(wrapPhase(phase), system)));
        }
        return points;
      },
    );

    // ── Simulated measurements ───────────────────────────────────────────────────
    this.measurementsProperty = new Property<Vector2[]>([]);
    Multilink.multilink(
      [
        this.transitSystemProperty,
        this.chartPhaseWindowProperty,
        this.noiseProperty,
        this.numberOfMeasurementsProperty,
      ],
      () => this.regenerateMeasurements(),
    );

    // ── Preset selection ────────────────────────────────────────────────────────
    // lazyLink so the initial Option A (== the NumberProperty defaults) is a no-op.
    this.presetProperty.lazyLink((preset) => this.applyPreset(preset));
  }

  /**
   * Applies a preset's seven orbital/planet parameters (never noise, number of
   * measurements, animation speed, or phase).
   */
  public applyPreset(preset: TransitPreset): void {
    this.planetMassProperty.value = preset.planetMass;
    this.planetRadiusProperty.value = preset.planetRadius;
    this.starMassProperty.value = preset.starMass;
    this.semimajorAxisProperty.value = preset.separation;
    this.eccentricityProperty.value = preset.eccentricity;
    this.inclinationProperty.value = preset.inclination;
    this.longitudeProperty.value = preset.longitude;
  }

  /**
   * Regenerates the simulated measurements: draws `numberOfMeasurements` random
   * phases inside the displayed window (so they land on the plot), evaluates the theoretical flux at each, and adds Marsaglia-polar
   * Gaussian noise (σ = noise slider value directly).
   */
  private regenerateMeasurements(): void {
    const n = this.numberOfMeasurementsProperty.value;
    const noise = this.noiseProperty.value;
    const system = this.transitSystemProperty.value;
    const window = this.chartPhaseWindowProperty.value;
    const points: Vector2[] = [];
    for (let i = 0; i < n; i++) {
      const phase = window.min + dotRandom.nextDouble() * window.getLength();
      const flux = normalizedFluxAtPhase(wrapPhase(phase), system) + polarGaussian(0, noise);
      points.push(new Vector2(phase, flux));
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
      this.phaseProperty.value = wrapPhase(this.phaseProperty.value + this.animationSpeedProperty.value * dt * 60);
    }
  }

  /** Resets all model state to initial values. */
  public reset(): void {
    this.planetMassProperty.reset();
    this.planetRadiusProperty.reset();
    this.starMassProperty.reset();
    this.semimajorAxisProperty.reset();
    this.eccentricityProperty.reset();
    this.inclinationProperty.reset();
    this.longitudeProperty.reset();
    this.noiseProperty.reset();
    this.numberOfMeasurementsProperty.reset();
    this.showTheoreticalCurveProperty.reset();
    this.showSimulatedMeasurementsProperty.reset();
    this.phaseProperty.reset();
    this.animationSpeedProperty.reset();
    this.presetProperty.reset();
    this.timer.reset();
  }
}
