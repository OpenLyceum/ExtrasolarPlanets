import { describe, expect, it } from "vitest";
import { RadialVelocityModel } from "../src/radial-velocity/model/RadialVelocityModel.js";
import { TransitModel } from "../src/transit/model/TransitModel.js";

for (const Model of [RadialVelocityModel, TransitModel]) {
  describe(Model.name, () => {
    it("advances one paused frame without starting playback", () => {
      const model = new Model();
      model.phaseProperty.value = 0.9999;
      model.animationSpeedProperty.value = 0.001;
      model.step(1 / 60);
      expect(model.phaseProperty.value).toBe(0.9999);
      model.step(1 / 60, true);
      expect(model.phaseProperty.value).toBeCloseTo(0.0009, 12);
      expect(model.timer.timeProperty.value).toBeCloseTo(1 / 60, 12);
      expect(model.timer.isPlayingProperty.value).toBe(false);
    });
  });
}
