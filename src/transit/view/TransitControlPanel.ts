/**
 * TransitControlPanel.ts
 *
 * The Transit screen's control panel: planet + orbital + measurement sliders,
 * the two view-toggle checkboxes, the derived star-property readout, and the
 * system-period / eclipse-depth / eclipse-duration readouts, and the preset
 * combo box.
 */

import { DerivedProperty, PatternStringProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { StringUtils } from "scenerystack/phetcommon";
import { HBox, type Node, RichText, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Checkbox, ComboBox, type ComboBoxItem } from "scenerystack/sun";
import { ExtrasolarPlanetsPanel } from "../../common/ExtrasolarPlanetsPanel.js";
import { createNumberControl } from "../../common/view/createNumberControl.js";
import { formatSignificant } from "../../common/view/formatSignificant.js";
import { createPresetNameProperty } from "../../common/view/presetName.js";
import { StarPropertiesNode } from "../../common/view/StarPropertiesNode.js";
import ExtrasolarPlanetsColors from "../../ExtrasolarPlanetsColors.js";
import {
  TRANSIT_ANIMATION_SPEED_RANGE,
  TRANSIT_ECCENTRICITY_RANGE,
  TRANSIT_INCLINATION_RANGE,
  TRANSIT_LONGITUDE_RANGE,
  TRANSIT_NOISE_RANGE,
  TRANSIT_NUMBER_OF_MEASUREMENTS_RANGE,
  TRANSIT_PLANET_MASS_RANGE,
  TRANSIT_PLANET_RADIUS_RANGE,
  TRANSIT_PRESETS,
  TRANSIT_SEMIMAJOR_AXIS_RANGE,
  TRANSIT_STAR_MASS_RANGE,
  type TransitPreset,
} from "../../ExtrasolarPlanetsConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { TransitModel } from "../model/TransitModel.js";

export class TransitControlPanel extends ExtrasolarPlanetsPanel {
  /** The interactive nodes, in tab order, for the ScreenView's pdomOrder. */
  public readonly controlsInOrder: Node[];

  public constructor(model: TransitModel, listParent: Node) {
    const strings = StringManager.getInstance().getTransitStrings();
    const units = StringManager.getInstance().getUnits();
    const controls = strings.controls;
    const a11yStrings = StringManager.getInstance().getTransitA11yStrings();

    // ── Preset combo box (selects a whole parameter set) ────────────────────────
    const presetItems: ComboBoxItem<TransitPreset>[] = TRANSIT_PRESETS.map((preset) => ({
      value: preset,
      createNode: () =>
        new Text(createPresetNameProperty(preset.name), {
          font: new PhetFont(13),
          fill: ExtrasolarPlanetsColors.textColorProperty,
        }),
      accessibleName: createPresetNameProperty(preset.name),
    }));
    const presetComboBox = new ComboBox(model.presetProperty, presetItems, listParent, {
      accessibleName: a11yStrings.controls.presetStringProperty,
      xMargin: 8,
      listPosition: "below",
    });

    const planetMassControl = createNumberControl(
      controls.planetMassStringProperty,
      model.planetMassProperty,
      TRANSIT_PLANET_MASS_RANGE,
      { unitsProperty: units.mJupiterStringProperty, decimalPlaces: 3, delta: 0.001 },
    );
    const planetRadiusControl = createNumberControl(
      controls.planetRadiusStringProperty,
      model.planetRadiusProperty,
      TRANSIT_PLANET_RADIUS_RANGE,
      { unitsProperty: units.rJupiterStringProperty, decimalPlaces: 2, delta: 0.01 },
    );
    const starMassControl = createNumberControl(
      controls.starMassStringProperty,
      model.starMassProperty,
      TRANSIT_STAR_MASS_RANGE,
      { unitsProperty: units.mSunStringProperty, decimalPlaces: 2, delta: 0.01 },
    );
    const semimajorAxisControl = createNumberControl(
      controls.semimajorAxisStringProperty,
      model.semimajorAxisProperty,
      TRANSIT_SEMIMAJOR_AXIS_RANGE,
      { unitsProperty: units.auStringProperty, decimalPlaces: 3, delta: 0.001 },
    );
    const eccentricityControl = createNumberControl(
      controls.eccentricityStringProperty,
      model.eccentricityProperty,
      TRANSIT_ECCENTRICITY_RANGE,
      { decimalPlaces: 3, delta: 0.005 },
    );
    const inclinationControl = createNumberControl(
      controls.inclinationStringProperty,
      model.inclinationProperty,
      TRANSIT_INCLINATION_RANGE,
      { unitsProperty: units.degreesStringProperty, decimalPlaces: 1, delta: 0.1 },
    );
    const longitudeControl = createNumberControl(
      controls.longitudeStringProperty,
      model.longitudeProperty,
      TRANSIT_LONGITUDE_RANGE,
      { unitsProperty: units.degreesStringProperty, decimalPlaces: 0, delta: 1 },
    );
    const noiseControl = createNumberControl(controls.noiseStringProperty, model.noiseProperty, TRANSIT_NOISE_RANGE, {
      decimalPlaces: 3,
      delta: 0.001,
    });
    const numberControl = createNumberControl(
      controls.numberOfMeasurementsStringProperty,
      model.numberOfMeasurementsProperty,
      TRANSIT_NUMBER_OF_MEASUREMENTS_RANGE,
      { decimalPlaces: 0, delta: 1 },
    );
    const animationSpeedControl = createNumberControl(
      controls.animationSpeedStringProperty,
      model.animationSpeedProperty,
      TRANSIT_ANIMATION_SPEED_RANGE,
      { decimalPlaces: 5, delta: 0.00005 },
    );

    const makeCheckbox = (
      property: typeof model.showTheoreticalCurveProperty,
      labelProperty: typeof controls.planetMassStringProperty,
    ): Checkbox =>
      new Checkbox(
        property,
        new RichText(labelProperty, { fill: ExtrasolarPlanetsColors.textColorProperty, font: new PhetFont(13) }),
        {
          accessibleName: labelProperty,
          checkboxColor: ExtrasolarPlanetsColors.textColorProperty,
          checkboxColorBackground: ExtrasolarPlanetsColors.panelBackgroundColorProperty,
        },
      );

    const showCurveCheckbox = makeCheckbox(
      model.showTheoreticalCurveProperty,
      controls.showTheoreticalCurveStringProperty,
    );
    const showMeasurementsCheckbox = makeCheckbox(
      model.showSimulatedMeasurementsProperty,
      controls.showSimulatedMeasurementsStringProperty,
    );

    // ── Readouts ────────────────────────────────────────────────────────────────
    const starPropertiesNode = new StarPropertiesNode(
      model.starPropertiesProperty,
      strings.readouts.starTypePatternStringProperty,
    );
    const readoutText = (stringProperty: TReadOnlyProperty<string>): RichText =>
      new RichText(stringProperty, {
        fill: ExtrasolarPlanetsColors.textColorProperty,
        font: new PhetFont(12),
        maxWidth: 170,
      });

    const periodReadout = readoutText(
      new PatternStringProperty(strings.readouts.systemPeriodPatternStringProperty, {
        value: new DerivedProperty([model.systemPeriodDaysProperty], formatSignificant),
      }),
    );
    const eclipseDepthReadout = readoutText(
      new PatternStringProperty(strings.readouts.eclipseDepthPatternStringProperty, {
        value: new DerivedProperty([model.eclipseDepthProperty], (depth) =>
          depth > 0 ? formatSignificant(depth) : "—",
        ),
      }),
    );
    // With no transit there is no duration, so the readout drops the unit
    // ("Eclipse duration: —") rather than showing "— hours".
    const eclipseDurationReadout = readoutText(
      new DerivedProperty(
        [
          model.eclipseDurationHoursProperty,
          strings.readouts.eclipseDurationPatternStringProperty,
          strings.readouts.eclipseDurationNoneStringProperty,
        ],
        (hours, pattern, none) => (hours > 0 ? StringUtils.fillIn(pattern, { value: formatSignificant(hours) }) : none),
      ),
    );

    // ── Grouped columns: presets / planet / orbit / star / measurements ─────────
    // The controls are arranged side by side along the bottom of the screen
    // (matching the NAAP Flash layout) rather than in one tall panel.
    const groups = strings.groups;
    const groupTitle = (titleProperty: TReadOnlyProperty<string>): Text =>
      new Text(titleProperty, {
        font: new PhetFont({ size: 11, weight: "bold" }),
        fill: ExtrasolarPlanetsColors.textColorProperty,
      });
    const makeGroup = (titleProperty: TReadOnlyProperty<string>, children: Node[]): VBox =>
      new VBox({ align: "left", spacing: 7, children: [groupTitle(titleProperty), ...children] });

    const presetGroup = makeGroup(groups.presetStringProperty, [presetComboBox, animationSpeedControl]);
    const planetGroup = makeGroup(groups.planetStringProperty, [
      planetMassControl,
      planetRadiusControl,
      eccentricityControl,
    ]);
    const orbitGroup = makeGroup(groups.orbitStringProperty, [
      semimajorAxisControl,
      inclinationControl,
      longitudeControl,
    ]);
    const starGroup = makeGroup(groups.starStringProperty, [
      starMassControl,
      periodReadout,
      eclipseDepthReadout,
      eclipseDurationReadout,
    ]);
    const measurementsGroup = makeGroup(groups.measurementsStringProperty, [
      noiseControl,
      numberControl,
      showCurveCheckbox,
      showMeasurementsCheckbox,
    ]);

    const columns = new HBox({
      spacing: 18,
      align: "top",
      children: [presetGroup, planetGroup, orbitGroup, starGroup, measurementsGroup],
    });

    // The star-properties sentence spans the full panel width beneath the columns
    // (a narrower maxWidth scaled the ~700 px sentence down to unreadable ~5 px text).
    starPropertiesNode.maxWidth = columns.width;
    const content = new VBox({
      align: "left",
      spacing: 8,
      children: [columns, starPropertiesNode],
    });

    super(content);

    // Match visual column order: preset → animation speed → planet → orbit → star → measurements.
    this.controlsInOrder = [
      presetComboBox,
      animationSpeedControl,
      planetMassControl,
      planetRadiusControl,
      eccentricityControl,
      semimajorAxisControl,
      inclinationControl,
      longitudeControl,
      starMassControl,
      noiseControl,
      numberControl,
      showCurveCheckbox,
      showMeasurementsCheckbox,
    ];
  }
}
