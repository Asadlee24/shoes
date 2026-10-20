import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Box3, Group, Vector3 } from "three";
import {
  prepareStudioModel,
  STUDIO_SHOE_LENGTH,
  STUDIO_CLEARANCE,
  STUDIO_PLINTH_RADIUS,
} from "../src/studio-model.ts";

test("both delivered GLB shoes have equal scale and stay above and inside the plinth through complete turns", async () => {
  const bytes = await readFile(
    new URL("../public/models/qadam-loafers.glb", import.meta.url),
  );
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  for (const name of ["HERO_BLACK", "HERO_SUEDE"]) {
    const original = gltf.scene.getObjectByName(name);
    assert.ok(original, `${name} is included in the shipped asset`);
    const model = prepareStudioModel(original),
      turntable = new Group();
    turntable.add(model);
    const bounds = new Box3().setFromObject(turntable),
      size = bounds.getSize(new Vector3());
    assert.ok(Math.abs(Math.max(size.x, size.z) - STUDIO_SHOE_LENGTH) < 1e-6);
    assert.ok(
      size.y > 0.9 && Math.min(size.x, size.z) > 1,
      "shoe has real volume rather than a flat image",
    );
    for (let degrees = -720; degrees <= 720; degrees += 15) {
      turntable.rotation.y = (degrees * Math.PI) / 180;
      turntable.updateMatrixWorld(true);
      bounds.setFromObject(turntable);
      assert.ok(
        bounds.min.y >= STUDIO_CLEARANCE - 1e-6,
        `${name} clears the platform at ${degrees} degrees`,
      );
      assert.ok(
        Math.max(
          Math.abs(bounds.min.x),
          Math.abs(bounds.max.x),
          Math.abs(bounds.min.z),
          Math.abs(bounds.max.z),
        ) < STUDIO_PLINTH_RADIUS,
      );
    }
  }
});
