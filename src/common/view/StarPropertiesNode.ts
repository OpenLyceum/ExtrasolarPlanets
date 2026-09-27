/**
 * StarPropertiesNode.ts
 *
 * A small read-only panel-row that reports the host star's derived main-sequence
 * properties — spectral type, effective temperature, and radius — from a live
 * `StarProperties` Property. Shared by both screens (the same derivation drives
 * the RV and transit star). The label text comes from a localized
 * `starTypePattern` so it stays translatable.
 */

import { DerivedProperty, PatternStringProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";
import { RichText, VBox } from "scenerystack/scenery";
import ExtrasolarPlanetsColors from "../../ExtrasolarPlanetsColors.js";
import type { StarProperties } from "../StarProperties.js";

/** Format a temperature to three significant figures (e.g. 5808 → "5810"). */
function formatTemperature(temperatureK: number): string {
  return String(Number(temperatureK.toPrecision(3)));
}

export class StarPropertiesNode extends VBox {
  public constructor(
    starPropertiesProperty: TReadOnlyProperty<StarProperties>,
    starTypePatternProperty: TReadOnlyProperty<string>,
  ) {
    const typeProperty = new DerivedProperty([starPropertiesProperty], (star) => star.spectralType?.label ?? "—");
    const temperatureProperty = new DerivedProperty([starPropertiesProperty], (star) =>
      formatTemperature(star.temperatureK),
    );
    const radiusProperty = new DerivedProperty([starPropertiesProperty], (star) => toFixed(star.radiusSolarRadii, 2));

    const labelProperty = new PatternStringProperty(starTypePatternProperty, {
      type: typeProperty,
      temperature: temperatureProperty,
      radius: radiusProperty,
    });

    super({
      align: "left",
      children: [
        new RichText(labelProperty, {
          fill: ExtrasolarPlanetsColors.textColorProperty,
          font: "12px sans-serif",
        }),
      ],
    });
  }
}
