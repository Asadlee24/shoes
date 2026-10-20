import { test } from "node:test";
import assert from "node:assert/strict";
import { Euler, Vector3 } from "three";
import { studioPhoto, studioPhotoHeight } from "../src/studio-photo.ts";
import { studioPose } from "../src/studio-motion.ts";

test("approved photo crops have equal visible width and clear the platform at every supported tilt", () => {
  for (const image of [
    "/products/hero-textured.png",
    "/products/hero-loafer.png",
  ]) {
    const photo = studioPhoto(image);
    assert.ok(Math.abs(photo.cropWidth * photo.unit - 4.8) < 1e-9);
    for (let x = -1; x <= 1; x += 0.1)
      for (let y = -1; y <= 1; y += 0.1) {
        const pose = studioPose({ x, y }),
          rotation = new Euler(pose.pitch, pose.yaw, pose.roll);
        const bottom = Math.min(
          ...[-1, 1].flatMap((a) =>
            [-1, 1].map(
              (b) =>
                new Vector3(
                  a * photo.halfWidth,
                  b * photo.halfHeight,
                  0,
                ).applyEuler(rotation).y,
            ),
          ),
        );
        assert.ok(studioPhotoHeight(photo, pose) + bottom >= 0.24 - 1e-9);
      }
  }
});
