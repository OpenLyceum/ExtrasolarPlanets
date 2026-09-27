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
import { StringManager } from "../../i18n/StringManager.js";
import type { TransitModel } from "../model/TransitModel.js";

/** Three significant figures, integerized where possible (e.g. 3.469 → "3.47"). */
function format3(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toPrecision(3))) : "—";
}

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
      ],
      (period, interval, duration, depth, star, transitingPattern, noTransitPattern) => {
        const typeLabel = star.spectralType?.label ?? "unknown";
        if (interval.occurs) {
          return StringUtils.fillIn(transitingPattern, {
            period: format3(period),
            depth: format3(depth),
            duration: format3(duration),
            type: typeLabel,
          });
        }
        return StringUtils.fillIn(noTransitPattern, { period: format3(period), type: typeLabel });
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
