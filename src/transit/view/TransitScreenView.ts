/**
 * TransitScreenView.ts
 *
 * The top-level view for the Transit screen.
 *
 * Layout (within layoutBounds 1024×618) — arranged to mirror the NAAP Flash
 * simulator:
 *   - transit visualization (top-left; the star disk + transiting planet)
 *   - light-curve chart (top-right)
 *   - grouped control panel (bottom, spanning the width: presets / planet / orbit
 *     / star / measurements)
 *   - time control (play/pause/step, beneath the visualization)
 *   - Reset All button (bottom-right)
 *
 * step(dt) forwards to the model so the orbital phase advances while playing,
 * driving the chart cursor and the planet across the star together.
 */

import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { Node, Rectangle } from "scenerystack/scenery";
import { ResetAllButton, TimeControlNode } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import {
  FLAT_RESET_ALL_BUTTON_OPTIONS,
  FLAT_TIME_CONTROL_NODE_OPTIONS,
} from "../../common/ExtrasolarPlanetsButtonOptions.js";
import ExtrasolarPlanetsColors from "../../ExtrasolarPlanetsColors.js";
import { SCREEN_VIEW_MARGIN } from "../../ExtrasolarPlanetsConstants.js";
import type { TransitModel } from "../model/TransitModel.js";
import { TransitChartNode } from "./TransitChartNode.js";
import { TransitControlPanel } from "./TransitControlPanel.js";
import { TransitScreenSummaryContent } from "./TransitScreenSummaryContent.js";
import { TransitVisualizationNode } from "./TransitVisualizationNode.js";

export type TransitScreenViewOptions = ScreenViewOptions;

export class TransitScreenView extends ScreenView {
  private readonly model: TransitModel;

  public constructor(model: TransitModel, providedOptions?: TransitScreenViewOptions) {
    const options = optionize<TransitScreenViewOptions, EmptySelfOptions, ScreenViewOptions>()(
      {
        screenSummaryContent: new TransitScreenSummaryContent(model),
      },
      providedOptions,
    );
    super(options);

    this.model = model;

    // ── Background ────────────────────────────────────────────────────────────
    const backgroundRect = new Rectangle(0, 0, this.layoutBounds.width, this.layoutBounds.height, {
      fill: ExtrasolarPlanetsColors.backgroundColorProperty,
    });
    this.addChild(backgroundRect);

    // Combo-box list parent — created here (passed into the control panel below)
    // but added as the LAST child so its dropdown overlays every panel.
    const comboBoxListParent = new Node();

    // ── Top row: visualization (left) + chart (right) ───────────────────────────
    // Matches the NAAP Flash arrangement: the sky-plane transit view sits on the
    // left and the light-curve plot on the right, side by side at the top.
    const chartNode = new TransitChartNode(model);
    const vizSize = chartNode.height; // square visualization, sized to the chart height
    const topGap = 18;
    const topRowWidth = vizSize + topGap + chartNode.width;
    const topRowLeft = (this.layoutBounds.width - topRowWidth) / 2;
    const topY = SCREEN_VIEW_MARGIN;

    const transitViz = new TransitVisualizationNode(model, vizSize);
    transitViz.left = topRowLeft;
    transitViz.top = topY;
    this.addChild(transitViz);

    chartNode.left = topRowLeft + vizSize + topGap;
    chartNode.top = topY;
    this.addChild(chartNode);

    // ── Bottom: grouped control panel spanning the screen width ─────────────────
    const controlPanel = new TransitControlPanel(model, comboBoxListParent);
    const bottomStripHeight = 44; // room for the time control + Reset All below
    const panelTop = transitViz.bottom + 10;
    const panelMaxHeight = this.layoutBounds.maxY - SCREEN_VIEW_MARGIN - bottomStripHeight - panelTop;
    const panelMaxWidth = this.layoutBounds.width - 2 * SCREEN_VIEW_MARGIN;
    const panelScale = Math.min(1, panelMaxWidth / controlPanel.width, panelMaxHeight / controlPanel.height);
    controlPanel.setScaleMagnitude(panelScale);
    controlPanel.centerX = this.layoutBounds.centerX;
    controlPanel.top = panelTop;
    this.addChild(controlPanel);

    // ── Time control (play/pause/step) — beneath the visualization ──────────────
    const timeControlNode = new TimeControlNode(model.timer.isPlayingProperty, {
      tandem: this.tandem.createTandem("timeControlNode"),
      ...FLAT_TIME_CONTROL_NODE_OPTIONS,
      playPauseStepButtonOptions: {
        ...FLAT_TIME_CONTROL_NODE_OPTIONS.playPauseStepButtonOptions,
        stepForwardButtonOptions: {
          ...FLAT_TIME_CONTROL_NODE_OPTIONS.playPauseStepButtonOptions.stepForwardButtonOptions,
          listener: () => model.step(1 / 60, true),
        },
      },
    });
    timeControlNode.centerX = transitViz.centerX;
    timeControlNode.bottom = this.layoutBounds.maxY - SCREEN_VIEW_MARGIN;
    this.addChild(timeControlNode);

    // ── Reset All button ──────────────────────────────────────────────────────
    const resetAllButton = new ResetAllButton({
      listener: () => {
        model.reset();
        this.reset();
      },
      right: this.layoutBounds.maxX - SCREEN_VIEW_MARGIN,
      bottom: this.layoutBounds.maxY - SCREEN_VIEW_MARGIN,
      ...FLAT_RESET_ALL_BUTTON_OPTIONS,
    });
    this.addChild(resetAllButton);

    // ── Accessibility: keyboard / reading traversal order ───────────────────────
    this.addChild(
      new Node({
        pdomOrder: [...controlPanel.controlsInOrder, timeControlNode, resetAllButton],
      }),
    );

    // Combo-box dropdown overlay (kept on top of all panels).
    this.addChild(comboBoxListParent);
  }

  public reset(): void {
    // No view-side mutable state to reset yet (the visualization listens to the model).
  }

  public override step(dt: number): void {
    this.model.step(dt);
  }
}
