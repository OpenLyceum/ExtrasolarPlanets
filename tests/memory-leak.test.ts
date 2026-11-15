/**
 * Memory-leak regression suite (fleet standard): each object below is collected after
 * dispose(), survives a double dispose(), and leaves no survivors across repeated cycles
 * (tests/helpers/memoryLeak.ts). TimeModel is the only class with a dispose(); the screen
 * models and views live for the whole sim (doc/implementation-notes.md, "Disposal").
 *
 * TransitModel and RadialVelocityModel own all their Properties and listeners, so they are
 * checked with create/drop + forceGC instead (stepped and reset first, to exercise the
 * play-driven state). Chart nodes are not covered here: they live as long as their screen.
 */

import { describe, expect, it } from "vitest";
import { TimeModel } from "../src/common/TimeModel.js";
import { RadialVelocityModel } from "../src/radial-velocity/model/RadialVelocityModel.js";
import { TransitModel } from "../src/transit/model/TransitModel.js";
import { describeDisposalLeaks, forceGC } from "./helpers/memoryLeak.js";

type ScreenModel = TransitModel | RadialVelocityModel;

const SCREEN_MODELS: readonly { name: string; create: () => ScreenModel }[] = [
  { name: "TransitModel", create: () => new TransitModel() },
  { name: "RadialVelocityModel", create: () => new RadialVelocityModel() },
];

function createAndDropModel(create: () => ScreenModel): WeakRef<object> {
  const model = create();
  model.timer.isPlayingProperty.value = true;
  for (let i = 0; i < 30; i++) {
    model.step(1 / 60);
  }
  model.reset();
  return new WeakRef<object>(model);
}

describe("Screen models (no dispose(): create/drop)", () => {
  for (const { name, create } of SCREEN_MODELS) {
    it(`${name} is collected after drop`, async () => {
      const ref = createAndDropModel(create);
      await forceGC(ref);
      expect(ref.deref()).toBeUndefined();
    });

    it(`${name}: repeated create/drop cycles leave no survivors`, async () => {
      const refs: WeakRef<object>[] = [];
      for (let i = 0; i < 10; i++) {
        refs.push(createAndDropModel(create));
      }
      await forceGC(refs);
      expect(refs.filter((r) => r.deref() !== undefined).length).toBe(0);
    });
  }
});

describeDisposalLeaks([{ name: "TimeModel", create: () => new TimeModel(), idempotentDispose: true }]);
