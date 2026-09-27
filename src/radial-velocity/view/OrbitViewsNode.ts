/**
 * OrbitViewsNode.ts
 *
 * The radial-velocity orbit visualization: a star–planet system drawn from up
 * to four perspectives. By default only the **2-D Orbit View** (top-down /
 * face-on) is shown; toggling `showMultipleViewsProperty` reveals the **Side
 * View** (edge-on, line of sight horizontal), the **Earth View** (the sky
 * projection an earth-bound observer sees), and a pseudo-**3-D Orbit View**
 * built with `Projection3D`.
 *
 * Geometry (AU model units, faithful to the Flash original):
 *   - planet orbital-plane position: r = a(1−e²)/(1+e·cos ν), in direction ν+ω
 *   - star position = −(m_planet/m_star)·planet position (barycentric, opposite
 *     side; the Flash a1=(m2/m1)·a approximation).
 *   - inclination tilts the orbit plane about the x-axis so z becomes the line
 *     of sight. Earth view drops z; side view keeps (x, z); 3-D adds an oblique
 *     camera via `projectToScreen`.
 *
 * The chart's phase cursor and this node both read `phaseProperty`, so playing
 * the animation drives them together.
 */

import { Multilink, type TReadOnlyProperty } from "scenerystack/axon";
import { Vector2, type Vector3 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Circle, Line, Node, Path, Rectangle, Text } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { meanToTrueAnomaly } from "../../common/OrbitalMechanics.js";
import { orbitalPlanePosition, projectToScreen, rotateX } from "../../common/Projection3D.js";
import ExtrasolarPlanetsColors from "../../ExtrasolarPlanetsColors.js";
import { M_SUN_KG, RV_M_JUP_KG } from "../../ExtrasolarPlanetsConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { RadialVelocityModel } from "../model/RadialVelocityModel.js";

const TWO_PI = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;
/** Number of samples around each orbit ellipse path. */
const ELLIPSE_SAMPLES = 96;
/** Pixel radius of the planet / star disks in the views. */
const PLANET_DISK_RADIUS = 5;
const STAR_DISK_RADIUS = 8;
/** Fraction of the half-view occupied by the planet's apoapsis (margin). */
const VIEW_PADDING = 0.85;

type ViewKind = "orbit" | "side" | "earth" | "threeD";

/**
 * Build an orbit view: a titled, bordered panel of the given pixel size with
 * its own star/planet disks and orbit paths. Returns the view plus an
 * `update(projection)` callback the caller uses to (re)draw geometry.
 */
function createView(
  size: number,
  titleProperty: TReadOnlyProperty<string>,
  project: (orbitalPlanePoint: Vector3, inclinationRad: number) => Vector2,
): {
  node: Node;
  redraw: (model: RadialVelocityModel) => void;
} {
  const background = new Rectangle(0, 0, size, size, {
    fill: ExtrasolarPlanetsColors.chartBackgroundColorProperty,
    stroke: ExtrasolarPlanetsColors.panelBorderColorProperty,
    lineWidth: 1,
  });

  const title = new Text(titleProperty, {
    font: new PhetFont(12),
    fill: ExtrasolarPlanetsColors.textColorProperty,
    maxWidth: size - 8,
  });

  // Star + planet orbit ellipse paths (filled-none strokes).
  const planetOrbitPath = new Path(null, {
    stroke: ExtrasolarPlanetsColors.orbitPathColorProperty,
    lineWidth: 1,
  });
  const starOrbitPath = new Path(null, {
    stroke: ExtrasolarPlanetsColors.orbitPathColorProperty,
    lineWidth: 1,
    lineDash: [3, 3],
  });

  // Current body disks.
  const starDisk = new Circle(STAR_DISK_RADIUS, { fill: ExtrasolarPlanetsColors.starColorProperty });
  const planetDisk = new Circle(PLANET_DISK_RADIUS, { fill: ExtrasolarPlanetsColors.planetColorProperty });

  // A barycenter crosshair marker.
  const half = size / 2;
  const cross = 4;
  const barycenter = new Node({
    children: [
      new Line(-cross, 0, cross, 0, { stroke: ExtrasolarPlanetsColors.orbitPathColorProperty, lineWidth: 1 }),
      new Line(0, -cross, 0, cross, { stroke: ExtrasolarPlanetsColors.orbitPathColorProperty, lineWidth: 1 }),
    ],
    center: new Vector2(half, half),
  });

  const content = new Node({
    children: [planetOrbitPath, starOrbitPath, barycenter, starDisk, planetDisk],
  });

  const node = new Node({
    children: [background, content, title],
  });
  title.centerX = half;
  title.top = 2;

  const redraw = (model: RadialVelocityModel): void => {
    const a = model.semimajorAxisProperty.value; // AU (planet semi-major axis ≈ separation)
    const e = model.eccentricityProperty.value;
    const omega = model.longitudeProperty.value * DEG_TO_RAD;
    // m_p / m_s in consistent units (planet mass is in M_Jup, star mass in M_Sun).
    const massRatio = (model.planetMassProperty.value * RV_M_JUP_KG) / (model.starMassProperty.value * M_SUN_KG);
    const inclRad = model.inclinationProperty.value * DEG_TO_RAD;

    // Scale: planet apoapsis a(1+e) fills VIEW_PADDING of the half-view.
    const maxR = a * (1 + e);
    const scale = (half * VIEW_PADDING) / maxR;
    const toView = (p: Vector2): Vector2 => new Vector2(half + p.x * scale, half - p.y * scale); // y flipped for screen

    // ── Sample orbit ellipses ─────────────────────────────────────────────────
    const planetShape = new Shape();
    const starShape = new Shape();
    for (let k = 0; k <= ELLIPSE_SAMPLES; k++) {
      const nu = (k / ELLIPSE_SAMPLES) * TWO_PI;
      const planetPlane = orbitalPlanePosition(nu, a, e, omega);
      const starPlane = planetPlane.timesScalar(-massRatio);
      const pp = toView(project(planetPlane, inclRad));
      const sp = toView(project(starPlane, inclRad));
      if (k === 0) {
        planetShape.moveTo(pp.x, pp.y);
        starShape.moveTo(sp.x, sp.y);
      } else {
        planetShape.lineTo(pp.x, pp.y);
        starShape.lineTo(sp.x, sp.y);
      }
    }
    planetShape.close();
    starShape.close();
    planetOrbitPath.shape = planetShape;
    starOrbitPath.shape = starShape;

    // ── Current body positions ────────────────────────────────────────────────
    const meanAnomaly = model.phaseProperty.value * TWO_PI;
    const nu = meanToTrueAnomaly(meanAnomaly, e);
    const planetPlane = orbitalPlanePosition(nu, a, e, omega);
    const starPlane = planetPlane.timesScalar(-massRatio);
    const pp = toView(project(planetPlane, inclRad));
    const sp = toView(project(starPlane, inclRad));
    planetDisk.center = pp;
    starDisk.center = sp;
  };

  return { node, redraw };
}

/** Pseudo-3D camera: a gentle oblique tilt so the inclined orbit reads as 3-D. */
const CAMERA_3D = { thetaRad: -Math.PI / 7, phiRad: Math.PI / 7 };

export class OrbitViewsNode extends Node {
  /** The interactive nodes (none yet — views are decorative) for pdomOrder. */
  public readonly controlsInOrder: Node[] = [];

  public constructor(model: RadialVelocityModel, availableWidth: number, availableHeight: number) {
    super();

    const viewTitles = StringManager.getInstance().getRadialVelocityStrings().viewTitles;

    // Projection functions per perspective (orbital-plane point + inclination → 2-D).
    const projections: Record<ViewKind, (p: Vector3, i: number) => Vector2> = {
      // Top-down: the raw orbital plane.
      orbit: (p) => new Vector2(p.x, p.y),
      // Edge-on: keep x and the line-of-sight depth z = y·sin i.
      side: (p, i) => {
        const r = rotateX(p, i);
        return new Vector2(r.x, r.z);
      },
      // Sky projection (earth-bound): drop the line-of-sight z, keep (x, y·cos i).
      earth: (p, i) => {
        const r = rotateX(p, i);
        return new Vector2(r.x, r.y);
      },
      // Pseudo-3D: apply inclination then an oblique orthographic camera.
      threeD: (p, i) => projectToScreen(rotateX(p, i), CAMERA_3D),
    };

    // ── Build the four views ──────────────────────────────────────────────────
    // Single-view mode: one large 2-D orbit. Grid mode: 2×2 of all four.
    const primarySize = Math.min(availableWidth, availableHeight);
    const primary = createView(primarySize, viewTitles.orbitViewStringProperty, projections.orbit);

    const gridSize = Math.floor(Math.min((availableWidth - 8) / 2, (availableHeight - 8) / 2));
    const side = createView(gridSize, viewTitles.sideViewStringProperty, projections.side);
    const earth = createView(gridSize, viewTitles.earthViewStringProperty, projections.earth);
    const threeD = createView(gridSize, viewTitles.orbitView3DStringProperty, projections.threeD);
    const orbitSmall = createView(gridSize, viewTitles.orbitViewStringProperty, projections.orbit);

    // Add a line-of-sight indicator to the side view (arrow toward observer).
    const losArrow = new Line(gridSize - 14, gridSize - 14, gridSize - 4, gridSize - 4, {
      stroke: ExtrasolarPlanetsColors.lineOfSightColorProperty,
      lineWidth: 2,
    });
    side.node.addChild(losArrow);

    // Layout: primary centered; grid as a 2×2 block.
    this.addChild(primary.node);
    // Position the 2×2 cells before centering the grid: centering first used the
    // bounds of four stacked cells, so the grid spilled onto the chart and panel.
    orbitSmall.node.leftTop = new Vector2(0, 0);
    side.node.leftTop = new Vector2(gridSize + 8, 0);
    earth.node.leftTop = new Vector2(0, gridSize + 8);
    threeD.node.leftTop = new Vector2(gridSize + 8, gridSize + 8);
    const grid = new Node({ children: [orbitSmall.node, side.node, earth.node, threeD.node] });
    grid.center = new Vector2(availableWidth / 2, availableHeight / 2);
    this.addChild(grid);

    const layout = (): void => {
      if (model.showMultipleViewsProperty.value) {
        primary.node.visible = false;
        grid.visible = true;
      } else {
        primary.node.visible = true;
        grid.visible = false;
        primary.node.center = new Vector2(availableWidth / 2, primarySize / 2);
      }
    };

    const redrawAll = (): void => {
      primary.redraw(model);
      orbitSmall.redraw(model);
      side.redraw(model);
      earth.redraw(model);
      threeD.redraw(model);
    };

    // React to every input that affects geometry or the current phase.
    Multilink.multilink(
      [
        model.phaseProperty,
        model.semimajorAxisProperty,
        model.eccentricityProperty,
        model.longitudeProperty,
        model.inclinationProperty,
        model.planetMassProperty,
        model.starMassProperty,
      ],
      redrawAll,
    );
    model.showMultipleViewsProperty.link(() => {
      layout();
      redrawAll();
    });

    layout();
  }
}
