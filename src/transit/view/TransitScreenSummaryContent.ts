/**
 * TransitScreenSummaryContent.ts
 *
 * The accessible screen summary read by screen readers (SceneryStack's
 * Interactive Description). It appears at the top of the parallel DOM and gives
 * a non-visual user a way to orient themselves and to re-read the screen's
 * current state at any time.
 *
 * `currentDetailsContent` is a LIVE `DerivedProperty` over the model state — the
 * system period, transit depth/duration, and host-star spectral type —
 * substituted into a localized pattern. A second pattern covers the
 * non-transiting case (e.g. when the inclination lifts the planet clear of the
 * stellar disk), selected from `eclipseInterval.occurs`.
 */
import { DerivedProperty } from "scenerystack/axon";
import { StringUtils } from "scenerystack/phetcommon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { formatSignificant } from "../../common/view/formatSignificant.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { TransitModel } from "../model/TransitModel.js";

export class TransitScreenSummaryContent extends ScreenSummaryContent {
  public constructor(model: TransitModel) {
    const a11y = StringManager.getInstance().getTransitA11yStrings();

    const currentDetails = new DerivedProperty(
      [
        model.systemPeriodDaysProperty,
        model.eclipseIntervalProperty,
        model.eclipseDurationHoursProperty,
        model.eclipseDepthProperty,
        model.starPropertiesProperty,
        a11y.currentDetailsTransitingPatternStringProperty,
        a11y.currentDetailsNoTransitPatternStringProperty,
        a11y.unknownSpectralTypeStringProperty,
      ],
      (period, interval, duration, depth, star, transitingPattern, noTransitPattern, unknownType) => {
        const typeLabel = star.spectralType?.label ?? unknownType;
        if (interval.occurs) {
          return StringUtils.fillIn(transitingPattern, {
            period: formatSignificant(period),
            depth: formatSignificant(depth),
            duration: formatSignificant(duration),
            type: typeLabel,
          });
        }
        return StringUtils.fillIn(noTransitPattern, { period: formatSignificant(period), type: typeLabel });
      },
    );

    super({
      playAreaContent: a11y.screenSummary.playAreaStringProperty,
      controlAreaContent: a11y.screenSummary.controlAreaStringProperty,
      currentDetailsContent: currentDetails,
      interactionHintContent: a11y.screenSummary.interactionHintStringProperty,
    });
  }
}
