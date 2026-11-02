/**
 * ExtrasolarPlanetsButtonOptions.ts
 *
 * Shared flat button appearance for the sim. Rectangular and round push buttons
 * (including ResetAllButton, TimeControlNode's play/pause/step buttons, and
 * NumberControl's arrow buttons) default to SceneryStack's 3-D beveled
 * appearance; spread these options (or the nested bundles) into a button's
 * options for a flat look everywhere.
 *
 * Template-owned toolkit: each sim uses only some of these, so every export is tagged
 * `@public` to tell dead-code checkers (knip) that an unused one is not dead code.
 */

import type {
  NumberControlOptions,
  PlayPauseStepButtonGroupOptions,
  TimeControlNodeOptions,
} from "scenerystack/scenery-phet";
import { ButtonNode } from "scenerystack/sun";

/** @public */
export const FLAT_BUTTON_APPEARANCE_OPTIONS = {
  buttonAppearanceStrategy: ButtonNode.FlatAppearanceStrategy,
} as const;

/** Options for RectangularPushButton, RoundPushButton, and other plain push buttons. */
export const FLAT_PUSH_BUTTON_OPTIONS = FLAT_BUTTON_APPEARANCE_OPTIONS;

/** Options for ResetAllButton (extends RoundPushButton via ResetButton). @public */
export const FLAT_RESET_ALL_BUTTON_OPTIONS = { ...FLAT_BUTTON_APPEARANCE_OPTIONS } as const;

/** Options for NumberControl's increment/decrement arrow buttons (ArrowButton extends RectangularPushButton). */
export const FLAT_ARROW_BUTTON_OPTIONS = {
  arrowButtonOptions: FLAT_BUTTON_APPEARANCE_OPTIONS,
} satisfies Pick<NumberControlOptions, "arrowButtonOptions">;

/** Nested options for TimeControlNode's play / pause / step round buttons. @public */
export const FLAT_PLAY_PAUSE_STEP_BUTTON_OPTIONS = {
  playPauseButtonOptions: FLAT_BUTTON_APPEARANCE_OPTIONS,
  stepForwardButtonOptions: FLAT_BUTTON_APPEARANCE_OPTIONS,
  stepBackwardButtonOptions: FLAT_BUTTON_APPEARANCE_OPTIONS,
} satisfies PlayPauseStepButtonGroupOptions;

/** Options for TimeControlNode: flattens its nested play/pause/step buttons. */
export const FLAT_TIME_CONTROL_NODE_OPTIONS = {
  playPauseStepButtonOptions: FLAT_PLAY_PAUSE_STEP_BUTTON_OPTIONS,
} satisfies Pick<TimeControlNodeOptions, "playPauseStepButtonOptions">;
