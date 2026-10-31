/**
 * createNumberControl.ts
 *
 * Factory for a themed `NumberControl` used by both screens' control panels.
 * It standardizes:
 *  - title + value text in the sim's text colour,
 *  - an optional unit suffix rendered via `numberDisplayOptions.valuePattern`
 *    (units come from a localized StringProperty, never an English literal),
 *  - an `accessibleName` (defaults to the title) so every slider is reachable,
 *  - an optional logarithmic scale, as the Flash sliders for masses, distances,
 *    radii, noise and the RV measurement count have: the slider then moves a
 *    log₁₀ proxy of the value, and a dragged value is rounded to the figures
 *    the readout shows, so what the student reads is what the model uses.
 *
 * Units use the `{{value}}` placeholder convention that `NumberDisplay` fills in,
 * and rich text so subscripted unit labels (e.g. M<sub>Jup</sub>) render.
 */

import type { PhetioProperty } from "scenerystack/axon";
import { DerivedProperty, NumberProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { Range, toFixed } from "scenerystack/dot";
import { combineOptions } from "scenerystack/phet-core";
import { StringUtils } from "scenerystack/phetcommon";
import { NumberControl, type NumberControlOptions, type NumberDisplayOptions } from "scenerystack/scenery-phet";
import ExtrasolarPlanetsColors from "../../ExtrasolarPlanetsColors.js";
import { StringManager } from "../../i18n/StringManager.js";
import { FLAT_ARROW_BUTTON_OPTIONS } from "../ExtrasolarPlanetsButtonOptions.js";
import { formatSignificant } from "./formatSignificant.js";

type CreateNumberControlSelfOptions = {
  /** Localized unit suffix appended after the value (e.g. "AU", "m/s"). */
  unitsProperty?: TReadOnlyProperty<string>;
  /** Digits shown after the decimal point in the readout (default 0). */
  decimalPlaces?: number;
  /**
   * Arrow-button step, and the interval dragged values snap to (default: 1/100
   * of the range). On a logarithmic control it is in decades, default 0.01, so
   * every power of ten (and 2 ≈ 10^0.30) stays reachable.
   */
  delta?: number;
  /** Move the slider on a log₁₀ scale (Flash `scalingMode = "logarithmic"`). */
  logarithmic?: boolean;
  /**
   * Significant figures of the readout (Flash "significant digits"); replaces
   * `decimalPlaces`. Logarithmic controls only.
   */
  significantFigures?: number;
  /** Accessible name; defaults to the visible title. */
  accessibleName?: TReadOnlyProperty<string>;
  /** Extra NumberControl options merged last. */
  numberControlOptions?: NumberControlOptions;
};

export type CreateNumberControlOptions = CreateNumberControlSelfOptions;

/** Default arrow step and snap interval of a logarithmic control (decades). */
const LOG_DELTA_DECADES = 0.01;

/** Rounds a value to what a control's readout shows: significant figures, else decimal places. */
export function roundForDisplay(value: number, significantFigures: number | undefined, decimalPlaces: number): number {
  return significantFigures === undefined
    ? Number(toFixed(value, decimalPlaces))
    : Number(formatSignificant(value, significantFigures));
}

/**
 * A log₁₀ proxy of `property` for a logarithmic slider, kept in step both ways. A value the
 * proxy sets is passed through `round` and kept in `range`; a value set on `property` (a
 * preset, Reset All) moves the proxy without being rounded.
 */
export function createLogarithmicProxy(
  property: PhetioProperty<number>,
  range: Range,
  round: (value: number) => number,
): NumberProperty {
  const proxy = new NumberProperty(Math.log10(property.value), {
    range: new Range(Math.log10(range.min), Math.log10(range.max)),
  });
  let updating = false;
  proxy.lazyLink((log) => {
    if (!updating) {
      updating = true;
      property.value = range.constrainValue(round(10 ** log));
      updating = false;
    }
  });
  property.lazyLink((value) => {
    if (!updating) {
      updating = true;
      proxy.value = proxy.range.constrainValue(Math.log10(value));
      updating = false;
    }
  });
  return proxy;
}

export function createNumberControl(
  titleProperty: TReadOnlyProperty<string>,
  numberProperty: PhetioProperty<number>,
  range: Range,
  providedOptions?: CreateNumberControlOptions,
): NumberControl {
  const options = combineOptions<CreateNumberControlOptions>({ decimalPlaces: 0 }, providedOptions);
  const decimalPlaces = options.decimalPlaces ?? 0;
  const logarithmic = options.logarithmic ?? false;
  const delta = options.delta ?? (logarithmic ? LOG_DELTA_DECADES : (range.max - range.min) / 100);

  // Build the "<value> <units>" pattern from the localized one, keeping {{value}}
  // for NumberDisplay to fill, so a locale can reorder or respace value and unit.
  const valuePattern = options.unitsProperty
    ? new DerivedProperty(
        [options.unitsProperty, StringManager.getInstance().getUnits().valueUnitsPatternStringProperty],
        (units, pattern) => StringUtils.fillIn(pattern, { units: units }), // {{value}} is left for NumberDisplay
      )
    : undefined;

  const numberDisplayBase: NumberDisplayOptions = {
    decimalPlaces,
    useRichText: true,
    textOptions: {
      fill: ExtrasolarPlanetsColors.textColorProperty,
    },
  };
  let numberDisplayOptions = valuePattern
    ? combineOptions<NumberDisplayOptions>(numberDisplayBase, { valuePattern })
    : numberDisplayBase;
  let controlledProperty = numberProperty;
  let controlledRange = range;
  if (logarithmic) {
    const round = (value: number): number => roundForDisplay(value, options.significantFigures, decimalPlaces);
    const proxy = createLogarithmicProxy(numberProperty, range, round);
    controlledProperty = proxy;
    controlledRange = proxy.range;
    // The readout shows the value, not its log. NumberDisplay takes a formatter in place of
    // decimalPlaces and valuePattern, so the formatter fills in the units itself.
    const pattern = valuePattern ?? null;
    const format = (log: number): string => {
      const value = range.constrainValue(round(10 ** log));
      const text =
        options.significantFigures === undefined
          ? toFixed(value, decimalPlaces)
          : formatSignificant(value, options.significantFigures);
      return pattern ? StringUtils.fillIn(pattern.value, { value: text }) : text;
    };
    numberDisplayOptions = {
      useRichText: true,
      textOptions: { fill: ExtrasolarPlanetsColors.textColorProperty },
      numberFormatter: format,
      numberFormatterDependencies: pattern ? [pattern] : [],
    };
  }

  return new NumberControl(
    titleProperty,
    controlledProperty,
    controlledRange,
    combineOptions<NumberControlOptions>(
      {
        delta,
        accessibleName: options.accessibleName ?? titleProperty,
        titleNodeOptions: {
          fill: ExtrasolarPlanetsColors.textColorProperty,
          maxWidth: 160,
        },
        numberDisplayOptions,
      },
      FLAT_ARROW_BUTTON_OPTIONS,
      options.numberControlOptions,
    ),
  );
}
