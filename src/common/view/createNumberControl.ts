/**
 * createNumberControl.ts
 *
 * Factory for a themed `NumberControl` used by both screens' control panels.
 * It standardizes:
 *  - title + value text in the sim's text colour,
 *  - an optional unit suffix rendered via `numberDisplayOptions.valuePattern`
 *    (units come from a localized StringProperty, never an English literal),
 *  - an `accessibleName` (defaults to the title) so every slider is reachable.
 *
 * Units use the `{{value}}` placeholder convention that `NumberDisplay` fills in,
 * and rich text so subscripted unit labels (e.g. M<sub>Jup</sub>) render.
 */

import type { PhetioProperty } from "scenerystack/axon";
import { DerivedProperty, type TReadOnlyProperty } from "scenerystack/axon";
import type { Range } from "scenerystack/dot";
import { combineOptions } from "scenerystack/phet-core";
import { StringUtils } from "scenerystack/phetcommon";
import { NumberControl, type NumberControlOptions, type NumberDisplayOptions } from "scenerystack/scenery-phet";
import ExtrasolarPlanetsColors from "../../ExtrasolarPlanetsColors.js";
import { StringManager } from "../../i18n/StringManager.js";
import { FLAT_ARROW_BUTTON_OPTIONS } from "../ExtrasolarPlanetsButtonOptions.js";

type CreateNumberControlSelfOptions = {
  /** Localized unit suffix appended after the value (e.g. "AU", "m/s"). */
  unitsProperty?: TReadOnlyProperty<string>;
  /** Digits shown after the decimal point in the readout (default 0). */
  decimalPlaces?: number;
  /** Arrow-button / keyboard step (default: 1/100 of the range). */
  delta?: number;
  /** Accessible name; defaults to the visible title. */
  accessibleName?: TReadOnlyProperty<string>;
  /** Extra NumberControl options merged last. */
  numberControlOptions?: NumberControlOptions;
};

export type CreateNumberControlOptions = CreateNumberControlSelfOptions;

export function createNumberControl(
  titleProperty: TReadOnlyProperty<string>,
  numberProperty: PhetioProperty<number>,
  range: Range,
  providedOptions?: CreateNumberControlOptions,
): NumberControl {
  const options = combineOptions<CreateNumberControlOptions>({ decimalPlaces: 0 }, providedOptions);
  const decimalPlaces = options.decimalPlaces ?? 0;
  const delta = options.delta ?? (range.max - range.min) / 100;

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
  const numberDisplayOptions = valuePattern
    ? combineOptions<NumberDisplayOptions>(numberDisplayBase, { valuePattern })
    : numberDisplayBase;

  return new NumberControl(
    titleProperty,
    numberProperty,
    range,
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
