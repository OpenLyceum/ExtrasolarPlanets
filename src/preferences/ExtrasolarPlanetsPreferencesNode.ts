/**
 * ExtrasolarPlanetsPreferencesNode.ts
 *
 * Custom preferences UI shown in Preferences → Simulation. Controls bind to
 * ExtrasolarPlanetsPreferencesModel Properties when preferences are added.
 */

import { Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import type { Tandem } from "scenerystack/tandem";
import ExtrasolarPlanetsColors from "../ExtrasolarPlanetsColors.js";
import ExtrasolarPlanetsNamespace from "../ExtrasolarPlanetsNamespace.js";
import { StringManager } from "../i18n/StringManager.js";
import type { ExtrasolarPlanetsPreferencesModel } from "./ExtrasolarPlanetsPreferencesModel.js";

export class ExtrasolarPlanetsPreferencesNode extends VBox {
  public constructor(_preferencesModel: ExtrasolarPlanetsPreferencesModel, _tandem?: Tandem) {
    const prefStrings = StringManager.getInstance().getPreferences();

    const header = new Text(prefStrings.titleStringProperty, {
      font: new PhetFont({ size: 18, weight: "bold" }),
      fill: ExtrasolarPlanetsColors.controlSurfaceTextColorProperty,
    });

    super({
      align: "left",
      spacing: 12,
      children: [header],
    });
  }
}

ExtrasolarPlanetsNamespace.register("ExtrasolarPlanetsPreferencesNode", ExtrasolarPlanetsPreferencesNode);
