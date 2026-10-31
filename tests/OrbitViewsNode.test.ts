/**
 * OrbitViewsNode.test.ts
 *
 * What the radial-velocity orbit views redraw: the ellipses only when the orbit changes, the
 * bodies every phase step, and only the views that are showing (hidden ones catch up when they
 * appear).
 */

import { type Node, Path } from "scenerystack/scenery";
import { describe, expect, it } from "vitest";
import { RadialVelocityModel } from "../src/radial-velocity/model/RadialVelocityModel.js";
import { OrbitViewsNode } from "../src/radial-velocity/view/OrbitViewsNode.js";

/** The orbit-ellipse paths of every view (plain Paths; disks and arrows are subclasses). */
function orbitPaths(node: Node): Path[] {
  const found: Path[] = [];
  const visit = (n: Node): void => {
    if (n.constructor === Path) {
      found.push(n as Path);
    }
    n.children.forEach(visit);
  };
  visit(node);
  return found;
}

describe("OrbitViewsNode", () => {
  it("keeps the ellipses while the phase advances", () => {
    const model = new RadialVelocityModel();
    const node = new OrbitViewsNode(model, 400, 400);
    const before = orbitPaths(node).map((path) => path.shape);
    model.phaseProperty.value = 0.3;
    expect(orbitPaths(node).map((path) => path.shape)).toEqual(before);
  });

  it("redraws hidden views only once they are shown", () => {
    const model = new RadialVelocityModel();
    const node = new OrbitViewsNode(model, 400, 400);
    const paths = orbitPaths(node);
    expect(paths).toHaveLength(10); // five views × (planet orbit, star orbit)
    const before = paths.map((path) => path.shape);
    model.eccentricityProperty.value = 0.5;
    const changed = (): number => paths.filter((path, i) => path.shape !== before[i]).length;
    expect(changed()).toBe(2); // the single 2-D view
    model.showMultipleViewsProperty.value = true;
    expect(changed()).toBe(10);
  });
});
