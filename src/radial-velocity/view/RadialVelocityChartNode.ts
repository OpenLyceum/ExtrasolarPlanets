/**
 * RadialVelocityChartNode.ts
 *
 * The bamboo chart for the Radial Velocity screen: radial velocity (m/s) on the
 * y-axis versus orbital phase (0–1) on the x-axis. It draws the theoretical
 * RV curve as a `LinePlot`, frames/scales the axes with `ChartTransform`, and
 * shows a vertical phase-indicator line that tracks `phaseProperty` (driven by
 * the model's animation clock and the orbit views).
 *
 * The y-axis auto-scales to the curve (±10 % padding) via the shared
 * `computeCurveYRange` helper, and the y tick spacing/label decimals adapt with
 * `niceStep` so the gridlines stay round as the amplitude changes. The
 * theoretical-curve plot is visibility-bound to `showTheoreticalCurveProperty`.
 * Simulated-measurement scatter points (`ScatterPlot`) are visibility-bound to
 * `showSimulatedMeasurementsProperty` and re-rolled when physics inputs change.
 *
 * The preset combo box / time control (M5) arrive later.
 */

import { Multilink, type TReadOnlyProperty } from "scenerystack/axon";
import {
  AxisLine,
  ChartRectangle,
  ChartTransform,
  GridLineSet,
  LinePlot,
  ScatterPlot,
  TickLabelSet,
  TickMarkSet,
} from "scenerystack/bamboo";
import { Range, Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Orientation } from "scenerystack/phet-core";
import { Line, Node, Text } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import {
  applyChartRescale,
  computeCurveYRange,
  decimalPlacesForStep,
  formatTickValue,
  niceStep,
} from "../../common/view/chartUtils.js";
import ExtrasolarPlanetsColors from "../../ExtrasolarPlanetsColors.js";
import {
  CHART_NOISE_MARGIN_SIGMAS,
  CHART_VIEW_HEIGHT,
  CHART_VIEW_WIDTH,
  RV_NO_MEASUREMENTS_NOISE,
} from "../../ExtrasolarPlanetsConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { RadialVelocityModel } from "../model/RadialVelocityModel.js";

// ── Layout (px) ──────────────────────────────────────────────────────────────
const PHASE_AXIS_SPACING = 0.25; // ticks at 0, 0.25, 0.5, 0.75, 1
/** Half-height (m/s) of the y-window used when the curve is essentially flat. */
const FLAT_HALF_WINDOW_MPS = 12;
/** Room for the y-axis tick labels to the left of the plotting area. */
const CHART_LEFT_PADDING = 48;
/** Room for the chart title above the plotting area. */
const CHART_TOP_PADDING = 28;

const TICK_LABEL_FONT = new PhetFont(12);
const TITLE_FONT = new PhetFont(14);

/** Format a phase tick (0, 0.25, 0.5, 0.75, 1) without trailing zeros. */
function formatPhase(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export class RadialVelocityChartNode extends Node {
  public constructor(model: RadialVelocityModel) {
    const chartStrings = StringManager.getInstance().getRadialVelocityStrings().chart;

    // ── Chart transform + frame ────────────────────────────────────────────────
    const chartTransform = new ChartTransform({
      viewWidth: CHART_VIEW_WIDTH,
      viewHeight: CHART_VIEW_HEIGHT,
      modelXRange: new Range(0, 1),
      modelYRange: new Range(-FLAT_HALF_WINDOW_MPS, FLAT_HALF_WINDOW_MPS),
    });

    const chartRectangle = new ChartRectangle(chartTransform, {
      fill: ExtrasolarPlanetsColors.chartBackgroundColorProperty,
      stroke: ExtrasolarPlanetsColors.chartGridColorProperty,
      lineWidth: 1,
    });

    const xGrid = new GridLineSet(chartTransform, Orientation.HORIZONTAL, PHASE_AXIS_SPACING, {
      stroke: ExtrasolarPlanetsColors.chartGridColorProperty,
    });
    const yGrid = new GridLineSet(chartTransform, Orientation.VERTICAL, niceStep(2 * FLAT_HALF_WINDOW_MPS), {
      stroke: ExtrasolarPlanetsColors.chartGridColorProperty,
    });

    const xTicks = new TickMarkSet(chartTransform, Orientation.HORIZONTAL, PHASE_AXIS_SPACING, {
      edge: "min",
      stroke: ExtrasolarPlanetsColors.chartTickColorProperty,
      extent: 6,
    });
    const yTicks = new TickMarkSet(chartTransform, Orientation.VERTICAL, niceStep(2 * FLAT_HALF_WINDOW_MPS), {
      edge: "min",
      stroke: ExtrasolarPlanetsColors.chartTickColorProperty,
      extent: 6,
    });

    const xLabels = new TickLabelSet(chartTransform, Orientation.HORIZONTAL, PHASE_AXIS_SPACING, {
      edge: "min",
      extent: 6,
      createLabel: (value) =>
        new Text(formatPhase(value), { font: TICK_LABEL_FONT, fill: ExtrasolarPlanetsColors.chartTickColorProperty }),
    });
    const yLabels = new TickLabelSet(chartTransform, Orientation.VERTICAL, niceStep(2 * FLAT_HALF_WINDOW_MPS), {
      edge: "min",
      extent: 6,
      createLabel: (value) =>
        new Text(formatTickValue(value, 0), {
          font: TICK_LABEL_FONT,
          fill: ExtrasolarPlanetsColors.chartTickColorProperty,
        }),
    });

    // Zero-velocity reference (auto-hides when 0 is outside the y-range).
    const zeroAxis = new AxisLine(chartTransform, Orientation.HORIZONTAL, {
      value: 0,
      stroke: ExtrasolarPlanetsColors.textColorProperty,
      lineWidth: 1,
    });

    // ── Theoretical curve ──────────────────────────────────────────────────────
    const theoreticalPlot = new LinePlot(chartTransform, [], {
      stroke: ExtrasolarPlanetsColors.theoreticalCurveColorProperty,
      lineWidth: 2,
    });
    model.showTheoreticalCurveProperty.link((visible) => theoreticalPlot.setVisible(visible));

    // ── Simulated measurements (scatter) ────────────────────────────────────────
    const measurementPlot = new ScatterPlot(chartTransform, [], {
      fill: ExtrasolarPlanetsColors.measurementColorProperty,
      radius: 2.5,
    });
    model.showSimulatedMeasurementsProperty.link((visible) => measurementPlot.setVisible(visible));
    model.measurementsProperty.link((points) => measurementPlot.setDataSet(points));

    // ── Phase indicator (vertical cursor at the current orbital phase) ─────────
    const phaseIndicator = new Line(0, 0, 0, CHART_VIEW_HEIGHT, {
      stroke: ExtrasolarPlanetsColors.phaseIndicatorColorProperty,
      lineWidth: 2,
    });
    const updatePhaseIndicator = (): void => {
      const viewX = chartTransform.modelToViewX(model.phaseProperty.value);
      phaseIndicator.setLine(viewX, 0, viewX, CHART_VIEW_HEIGHT);
    };
    model.phaseProperty.link(updatePhaseIndicator);
    chartTransform.changedEmitter.addListener(updatePhaseIndicator);

    // ── Layering: clip plots to the plotting area, keep labels outside ──────────
    const clippedLayer = new Node({
      clipArea: Shape.rect(0, 0, CHART_VIEW_WIDTH, CHART_VIEW_HEIGHT),
      children: [chartRectangle, xGrid, yGrid, zeroAxis, theoreticalPlot, measurementPlot, phaseIndicator],
    });
    const chartLayer = new Node({
      translation: new Vector2(CHART_LEFT_PADDING, CHART_TOP_PADDING),
      children: [clippedLayer, xTicks, yTicks, xLabels, yLabels],
    });

    // ── Title ──────────────────────────────────────────────────────────────────
    const title = new Text(chartStrings.titleStringProperty as TReadOnlyProperty<string>, {
      font: TITLE_FONT,
      fill: ExtrasolarPlanetsColors.chartTickColorProperty,
    });
    title.centerX = CHART_LEFT_PADDING + CHART_VIEW_WIDTH / 2;
    title.top = 0;

    super({ children: [title, chartLayer] });

    // ── Live updates: redraw the curve + rescale the y-axis when physics changes
    // Do not write modelYRange from a nested changedEmitter / Property notify: that
    // reenters axon (and can overflow the stack via setModelYRange → ticks → layout).
    let yAxisBusy = false;
    const updateYAxis = (yRange: Range): void => {
      if (yAxisBusy || yRange.equals(chartTransform.modelYRange)) {
        return;
      }
      yAxisBusy = true;
      try {
        const step = niceStep(yRange.max - yRange.min);
        const decimals = decimalPlacesForStep(step);
        const spacingChanged = step !== yLabels.getSpacing();
        applyChartRescale(
          chartTransform.modelYRange.getLength(),
          yRange.getLength(),
          () => chartTransform.setModelYRange(yRange),
          () => {
            yGrid.setSpacing(step);
            yTicks.setSpacing(step);
            yLabels.setSpacing(step);
          },
        );
        // setCreateLabel always rebuilds every label; only do that when formatting changes.
        if (spacingChanged) {
          yLabels.setCreateLabel(
            (value) =>
              new Text(formatTickValue(value, decimals), {
                font: TICK_LABEL_FONT,
                fill: ExtrasolarPlanetsColors.chartTickColorProperty,
              }),
          );
        }
      } finally {
        yAxisBusy = false;
      }
    };

    // The y-axis must leave room for the measurement scatter, so it rescales when
    // the noise σ or the measurement-visibility toggle change, not only the curve.
    // When measurements are hidden there is no extra margin (the theoretical curve
    // fills the view); when shown, ±CHART_NOISE_MARGIN_SIGMAS·σ of headroom keeps
    // the noisy points inside the plotting area.
    Multilink.multilink(
      [model.theoreticalCurveProperty, model.noiseProperty, model.showSimulatedMeasurementsProperty],
      (curve: Vector2[], noise: number, showMeasurements: boolean) => {
        theoreticalPlot.setDataSet(curve);
        const noiseForMargin = showMeasurements ? noise : RV_NO_MEASUREMENTS_NOISE;
        updateYAxis(computeCurveYRange(curve, FLAT_HALF_WINDOW_MPS, CHART_NOISE_MARGIN_SIGMAS * noiseForMargin));
      },
    );
  }
}
