/**
 * TransitVisualizationNode.test.ts
 *
 * The sky-plane drawing agrees with the light curve: the planet is drawn over the star at
 * inferior conjunction (the transit) and behind it at superior conjunction half an orbit later,
 * where the sky position is the same but the flux does not dip.
 */

import { Circle } from "scenerystack/scenery";
import { describe, expect, it } from "vitest";
import { TRANSIT_STAR_VIEW_RADIUS } from "../src/ExtrasolarPlanetsConstants.js";
import { TransitModel } from "../src/transit/model/TransitModel.js";
import { TransitVisualizationNode } from "../src/transit/view/TransitVisualizationNode.js";

/** The star and planet disks, and whether the planet is drawn above the star. */
function disks(node: TransitVisualizationNode): { planetOnTop: boolean; planetOverStar: boolean } {
  const parent = node.children.find((child) => child.children.some((c) => c instanceof Circle));
  const circles = (parent?.children ?? []).filter((c): c is Circle => c instanceof Circle);
  const star = circles.find((c) => c.radius === TRANSIT_STAR_VIEW_RADIUS);
  const planet = circles.find((c) => c !== star);
  if (!(parent && star && planet)) {
    throw new Error("star and planet disks not found");
  }
  return {
    planetOnTop: parent.indexOfChild(planet) > parent.indexOfChild(star),
    planetOverStar: planet.center.distance(star.center) < star.radius,
  };
}

describe("TransitVisualizationNode", () => {
  // Option A: e = 0, ω = 0, i = 90°, so inferior conjunction is at phase 0.25 and superior at 0.75.
  it("draws the planet in front of the star during the transit", () => {
    const model = new TransitModel();
    const node = new TransitVisualizationNode(model, 200);
    model.phaseProperty.value = 0.25;
    expect(disks(node)).toEqual({ planetOnTop: true, planetOverStar: true });
  });

  it("hides the planet behind the star at superior conjunction", () => {
    const model = new TransitModel();
    const node = new TransitVisualizationNode(model, 200);
    model.phaseProperty.value = 0.75;
    expect(disks(node)).toEqual({ planetOnTop: false, planetOverStar: true });
    model.phaseProperty.value = 0.25;
    expect(disks(node).planetOnTop).toBe(true);
  });
});
