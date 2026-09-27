/**
 * TransitChartNode.ts
 *
 * The bamboo light-curve chart for the Transit screen: normalized flux
 * (1 = unocculted star) on the y-axis versus orbital phase on the x-axis. Like
 * the NAAP Flash lightcurve ("eclipse of body 1" region), the x-axis zooms onto
 * the transit plus 15 % margins (TransitModel.chartPhaseWindowProperty), so a
 * hours-long transit in a year-long orbit is a readable dip, not a hairline.
 * It draws the theoretical flux curve as a `LinePlot` and a vertical phase
 * indicator that tracks `phaseProperty`.
 *
 * Because the transit dip is shallow (typically 1–2 %) the y-axis auto-scales
 * tightly around the curve (±10 % of the dip), collapsing to a small ±1 % window
 * around 1.0 for non-transiting geometries so the flat line still reads as a
 * line and not a degenerate sliver. A horizontal reference line marks flux = 1.
 *
 * The eclipse-duration arrow, depth-readout wiring, and preset combo box
 * arrive in later milestones (M5).
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
import { Range, toFixed, Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Orientation } from "scenerystack/phet-core";
import { Line, Node, Text } from "scenerystack/scenery";
import { ArrowNode, PhetFont } from "scenerystack/scenery-phet";
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
  TRANSIT_NO_MEASUREMENTS_NOISE,
} from "../../ExtrasolarPlanetsConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import { unwrapPhaseIntoWindow, wrapPhase } from "../model/EclipseGeometry.js";
import type { TransitModel } from "../model/TransitModel.js";

// ── Layout (px) ──────────────────────────────────────────────────────────────
/** Target number of x-axis divisions across the transit window. */
const PHASE_AXIS_DIVISIONS = 4;
/** Half-height (flux) of the y-window used when there is no transit (flat @ 1). */
const FLAT_HALF_WINDOW_FLUX = 0.01;
/** Room for the y-axis tick labels to the left of the plotting area. */
const CHART_LEFT_PADDING = 54;
/** Room for the chart title above the plotting area. */
const CHART_TOP_PADDING = 28;
/** Vertical position (px from top of plotting area) of the eclipse-duration arrow. */
const DURATION_ARROW_Y = 16;

const TICK_LABEL_FONT = new PhetFont(12);
const TITLE_FONT = new PhetFont(14);

/** Phase tick label: the unwrapped axis value shown as a phase in [0, 1). */
function createPhaseLabel(decimals: number): (value: number) => Text {
  return (value) =>
    new Text(formatTickValue(wrapPhase(Number(toFixed(value, decimals))), decimals), {
      font: TICK_LABEL_FONT,
      fill: ExtrasolarPlanetsColors.chartTickColorProperty,
    });
}

export class TransitChartNode extends Node {
  public constructor(model: TransitModel) {
    const chartStrings = StringManager.getInstance().getTransitStrings().chart;

    // ── Chart transform + frame ────────────────────────────────────────────────
    const initialWindow = model.chartPhaseWindowProperty.value;
    const initialXStep = niceStep(initialWindow.getLength(), PHASE_AXIS_DIVISIONS);
    const chartTransform = new ChartTransform({
      viewWidth: CHART_VIEW_WIDTH,
      viewHeight: CHART_VIEW_HEIGHT,
      modelXRange: initialWindow,
      modelYRange: new Range(1 - FLAT_HALF_WINDOW_FLUX, 1 + FLAT_HALF_WINDOW_FLUX),
    });

    const chartRectangle = new ChartRectangle(chartTransform, {
      fill: ExtrasolarPlanetsColors.chartBackgroundColorProperty,
      stroke: ExtrasolarPlanetsColors.chartGridColorProperty,
      lineWidth: 1,
    });

    const xGrid = new GridLineSet(chartTransform, Orientation.HORIZONTAL, initialXStep, {
      stroke: ExtrasolarPlanetsColors.chartGridColorProperty,
    });
    const yGrid = new GridLineSet(chartTransform, Orientation.VERTICAL, niceStep(2 * FLAT_HALF_WINDOW_FLUX), {
      stroke: ExtrasolarPlanetsColors.chartGridColorProperty,
    });

    const xTicks = new TickMarkSet(chartTransform, Orientation.HORIZONTAL, initialXStep, {
      edge: "min",
      stroke: ExtrasolarPlanetsColors.chartTickColorProperty,
      extent: 6,
    });
    const yTicks = new TickMarkSet(chartTransform, Orientation.VERTICAL, niceStep(2 * FLAT_HALF_WINDOW_FLUX), {
      edge: "min",
      stroke: ExtrasolarPlanetsColors.chartTickColorProperty,
      extent: 6,
    });

    const xLabels = new TickLabelSet(chartTransform, Orientation.HORIZONTAL, initialXStep, {
      edge: "min",
      extent: 6,
      createLabel: createPhaseLabel(decimalPlacesForStep(initialXStep)),
    });
    const yLabels = new TickLabelSet(chartTransform, Orientation.VERTICAL, niceStep(2 * FLAT_HALF_WINDOW_FLUX), {
      edge: "min",
      extent: 6,
      createLabel: (value) =>
        new Text(formatTickValue(value, 2), {
          font: TICK_LABEL_FONT,
          fill: ExtrasolarPlanetsColors.chartTickColorProperty,
        }),
    });

    // Flux = 1 baseline reference (the unocculted level).
    const baselineAxis = new AxisLine(chartTransform, Orientation.HORIZONTAL, {
      value: 1,
      stroke: ExtrasolarPlanetsColors.textColorProperty,
      lineWidth: 1,
    });

    // ── Theoretical flux curve ─────────────────────────────────────────────────
    const fluxPlot = new LinePlot(chartTransform, [], {
      stroke: ExtrasolarPlanetsColors.theoreticalCurveColorProperty,
      lineWidth: 2,
    });
    model.showTheoreticalCurveProperty.link((visible) => fluxPlot.setVisible(visible));

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
    // Shown only while the orbital phase lies inside the displayed window.
    const updatePhaseIndicator = (): void => {
      const unwrapped = unwrapPhaseIntoWindow(model.phaseProperty.value, chartTransform.modelXRange);
      phaseIndicator.visible = unwrapped !== null;
      if (unwrapped !== null) {
        const viewX = chartTransform.modelToViewX(unwrapped);
        phaseIndicator.setLine(viewX, 0, viewX, CHART_VIEW_HEIGHT);
      }
    };
    model.phaseProperty.link(updatePhaseIndicator);
    chartTransform.changedEmitter.addListener(updatePhaseIndicator);

    // ── Eclipse-duration arrow (spans first→last contact of the transit) ────────
    // Double-headed, near the top of the plot. Hidden for non-transiting systems
    // (zero/empty interval) and redrawn whenever the interval or y-axis changes.
    const durationArrow = new ArrowNode(0, DURATION_ARROW_Y, 0, DURATION_ARROW_Y, {
      doubleHead: true,
      headHeight: 8,
      headWidth: 8,
      tailWidth: 2,
      fill: ExtrasolarPlanetsColors.durationArrowColorProperty,
      stroke: ExtrasolarPlanetsColors.durationArrowColorProperty,
    });
    const updateDurationArrow = (): void => {
      const interval = model.eclipseIntervalProperty.value;
      const start = interval.occurs ? unwrapPhaseIntoWindow(interval.startPhase, chartTransform.modelXRange) : null;
      if (start !== null && interval.durationPhase > 0) {
        const startX = chartTransform.modelToViewX(start);
        const endX = chartTransform.modelToViewX(start + interval.durationPhase);
        durationArrow.setTailAndTip(startX, DURATION_ARROW_Y, endX, DURATION_ARROW_Y);
        durationArrow.setVisible(true);
      } else {
        durationArrow.setVisible(false);
      }
    };
    model.eclipseIntervalProperty.link(updateDurationArrow);
    chartTransform.changedEmitter.addListener(updateDurationArrow);

    // ── Layering: clip plots to the plotting area, keep labels outside ──────────
    const clippedLayer = new Node({
      clipArea: Shape.rect(0, 0, CHART_VIEW_WIDTH, CHART_VIEW_HEIGHT),
      children: [chartRectangle, xGrid, yGrid, baselineAxis, fluxPlot, measurementPlot, durationArrow, phaseIndicator],
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
    // When measurements are hidden a near-zero margin (noMeasurementsNoise) lets
    // the theoretical curve fill the view; when shown, ±CHART_NOISE_MARGIN_SIGMAS·σ
    // of headroom keeps the noisy points inside the plotting area.
    // x-axis follows the transit window; spacing and range are applied in the
    // order that never asks bamboo to fill a wide range with a tiny spacing.
    model.chartPhaseWindowProperty.lazyLink((window) => {
      const step = niceStep(window.getLength(), PHASE_AXIS_DIVISIONS);
      const spacingChanged = step !== xLabels.getSpacing();
      applyChartRescale(
        chartTransform.modelXRange.getLength(),
        window.getLength(),
        () => chartTransform.setModelXRange(window),
        () => {
          xGrid.setSpacing(step);
          xTicks.setSpacing(step);
          xLabels.setSpacing(step);
        },
      );
      if (spacingChanged) {
        xLabels.setCreateLabel(createPhaseLabel(decimalPlacesForStep(step)));
      }
    });

    Multilink.multilink(
      [model.fluxCurveProperty, model.noiseProperty, model.showSimulatedMeasurementsProperty],
      (curve: Vector2[], noise: number, showMeasurements: boolean) => {
        fluxPlot.setDataSet(curve);
        const noiseForMargin = showMeasurements ? noise : TRANSIT_NO_MEASUREMENTS_NOISE;
        updateYAxis(computeCurveYRange(curve, FLAT_HALF_WINDOW_FLUX, CHART_NOISE_MARGIN_SIGMAS * noiseForMargin));
      },
    );
  }
}
