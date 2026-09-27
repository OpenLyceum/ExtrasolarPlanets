/**
 * TransitVisualizationNode.ts
 *
 * The transit screen's sky-plane visualization: a black "sky" panel with the
 * host-star disk at center and the planet disk crossing in front of it during
 * transit. The planet's position is the sky-projected separation (dropping the
 * line-of-sight depth), derived from the same eclipse geometry that drives the
 * light curve — so the planet is on the star disk exactly when the curve dips.
 *
 * The view is scaled by the stellar radius (star disk = `TRANSIT_STAR_VIEW_RADIUS`
 * px), so the planet's apparent size and chord offset are physically faithful:
 * a hot Jupiter crosses as a visible disk at the impact-parameter height, while
 * the planet spends the rest of the (vastly larger) orbit off-screen — exactly
 * as in the Flash original.
 *
 * The planet's sky position (metres, relative to the star centre) is:
 *   X = r · cos(ν + ω)
 *   Y = r · sin(ν + ω) · cos i
 * with r = a(1−e²)/(1+e·cos ν). This reproduces `projectedSeparation`'s
 * magnitude d = √(X² + Y²).
 */

import { Multilink } from "scenerystack/axon";
import { Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Circle, Line, Node, Rectangle, Text } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { meanToTrueAnomaly } from "../../common/OrbitalMechanics.js";
import ExtrasolarPlanetsColors from "../../ExtrasolarPlanetsColors.js";
import { TRANSIT_STAR_VIEW_RADIUS } from "../../ExtrasolarPlanetsConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { TransitModel } from "../model/TransitModel.js";

const TWO_PI = Math.PI * 2;
/** Minimum planet pixel radius so even terrestrial planets remain visible. */
const MIN_PLANET_PIXEL_RADIUS = 3;

export class TransitVisualizationNode extends Node {
  /** The interactive nodes (none yet — the view is decorative) for pdomOrder. */
  public readonly controlsInOrder: Node[] = [];

  public constructor(model: TransitModel, viewSize: number) {
    super();

    const VIEW_SIZE = viewSize;
    const viewStrings = StringManager.getInstance().getTransitStrings().viewTitles;

    const sky = new Rectangle(0, 0, VIEW_SIZE, VIEW_SIZE, {
      fill: ExtrasolarPlanetsColors.skyBackgroundColorProperty,
      stroke: ExtrasolarPlanetsColors.panelBorderColorProperty,
      lineWidth: 1,
    });

    const title = new Text(viewStrings.transitViewStringProperty, {
      font: new PhetFont(12),
      fill: ExtrasolarPlanetsColors.chartTickColorProperty,
      maxWidth: VIEW_SIZE - 8,
    });
    title.centerX = VIEW_SIZE / 2;
    title.top = 2;

    // The star sits centered in the area below the title strip.
    const centerX = VIEW_SIZE / 2;
    const centerY = (VIEW_SIZE + 16) / 2 + 6;

    // The transit chord (dashed) marks the path the planet takes at the impact
    // parameter height; redrawn when the geometry changes.
    const chord = new Line(0, 0, VIEW_SIZE - 16, 0, {
      stroke: ExtrasolarPlanetsColors.orbitPathColorProperty,
      lineWidth: 1,
      lineDash: [4, 4],
    });

    const starDisk = new Circle(TRANSIT_STAR_VIEW_RADIUS, { fill: ExtrasolarPlanetsColors.starColorProperty });
    starDisk.center = new Vector2(centerX, centerY);

    const planetDisk = new Circle(MIN_PLANET_PIXEL_RADIUS, {
      fill: ExtrasolarPlanetsColors.planetColorProperty,
    });

    // Clip the moving planet to the sky panel so the off-transit excursions
    // (which span the whole, much larger orbit) never overflow the view.
    const clip = new Node({
      clipArea: Shape.rect(0, 16, VIEW_SIZE, VIEW_SIZE - 16),
      children: [chord, starDisk, planetDisk],
    });

    this.addChild(sky);
    this.addChild(clip);
    this.addChild(title);

    const redraw = (): void => {
      const system = model.transitSystemProperty.value;
      const phase = model.phaseProperty.value;

      // Star disk (size fixed to TRANSIT_STAR_VIEW_RADIUS for clarity).
      starDisk.center = new Vector2(centerX, centerY);

      // Scale: metres → pixels via the stellar radius.
      const scale = TRANSIT_STAR_VIEW_RADIUS / system.starRadiusM;
      // Planet pixel radius: physically to scale, with a visibility floor.
      const planetRadiusPx = Math.max(MIN_PLANET_PIXEL_RADIUS, system.planetRadiusM * scale);
      planetDisk.setRadius(planetRadiusPx);

      // Planet sky-plane position relative to the star (metres).
      const e = system.eccentricity;
      const omega = system.argumentRad;
      const inclRad = system.inclinationRad;
      const nu = meanToTrueAnomaly(phase * TWO_PI, e);
      const r = (system.separationM * (1 - e * e)) / (1 + e * Math.cos(nu));
      const cosI = Math.cos(inclRad);
      const skyX = r * Math.cos(nu + omega);
      const skyY = r * Math.sin(nu + omega) * cosI;

      planetDisk.center = new Vector2(centerX + skyX * scale, centerY - skyY * scale);

      // Chord height = impact-parameter sky offset (Y at mid-transit, ν+ω ≈ π/2).
      const chordNu = TWO_PI / 4 - omega;
      const rChord = (system.separationM * (1 - e * e)) / (1 + e * Math.cos(chordNu));
      const chordY = centerY - rChord * cosI * scale;
      chord.setLine(8, chordY, VIEW_SIZE - 8, chordY);
    };

    Multilink.multilink([model.phaseProperty, model.transitSystemProperty], redraw);
  }
}
