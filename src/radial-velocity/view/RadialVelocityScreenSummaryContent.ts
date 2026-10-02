/**
 * RadialVelocityScreenSummaryContent.ts
 *
 * The accessible screen summary read by screen readers (SceneryStack's
 * Interactive Description). It appears at the top of the parallel DOM and gives
 * a non-visual user a way to orient themselves and to re-read the screen's
 * current state at any time.
 *
 * `currentDetailsContent` is a LIVE `DerivedProperty` over the model state — the
 * orbital period, RV semi-amplitude, and host-star spectral type — substituted
 * into a localized pattern, so the paragraph is re-announced as the user changes
 * the system. (Plain string substitution rather than PatternStringProperty
 * because this is screen-reader text — no rich-text markup is wanted here.)
 */
import { DerivedProperty } from "scenerystack/axon";
import { StringUtils } from "scenerystack/phetcommon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { formatSignificant } from "../../common/view/formatSignificant.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { RadialVelocityModel } from "../model/RadialVelocityModel.js";

export class RadialVelocityScreenSummaryContent extends ScreenSummaryContent {
  public constructor(model: RadialVelocityModel) {
    const a11y = StringManager.getInstance().getRadialVelocityA11yStrings();

    const currentDetails = new DerivedProperty(
      [
        model.periodDaysProperty,
        model.amplitudeProperty,
        model.starPropertiesProperty,
        a11y.currentDetailsPatternStringProperty,
        a11y.unknownSpectralTypeStringProperty,
      ],
      (period, amplitude, star, pattern, unknownType) =>
        StringUtils.fillIn(pattern, {
          period: formatSignificant(period),
          amplitude: formatSignificant(amplitude),
          type: star.spectralType?.label ?? unknownType,
        }),
    );

    super({
      playAreaContent: a11y.screenSummary.playAreaStringProperty,
      controlAreaContent: a11y.screenSummary.controlAreaStringProperty,
      currentDetailsContent: currentDetails,
      interactionHintContent: a11y.screenSummary.interactionHintStringProperty,
    });
  }
}
