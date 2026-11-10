import { test } from "node:test";
import assert from "node:assert/strict";
import { Euler, Vector3, OrthographicCamera } from "three";
import {
  studioCamera,
  studioDepthScale,
  studioPhoto,
  studioPhotoHeight,
  studioPlinth,
  studioScreenY,
  studioShoeDepth,
  studioVerticalScale,
  studioZoom,
} from "../src/studio-photo.ts";
import { studioPose } from "../src/studio-motion.ts";
const approvedPhotos = [
  "/products/hero-textured.png",
  "/products/hero-loafer.png",
  "/products/hero-olive-v1.webp",
  "/products/hero-chocolate-v1.webp",
];

test("the loading preview matches the rendered shoe and plinth at rest", () => {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 250);
  camera.position.set(0, studioCamera.y, studioCamera.z);
  camera.lookAt(0, studioCamera.targetY, 0);
  camera.updateMatrixWorld(true);
  const assertProjection = (world, previewX, previewY) => {
    const projected = world.project(camera);
    assert.ok(Math.abs(projected.x - previewX) < 1e-9);
    assert.ok(Math.abs(-projected.y - previewY) < 1e-9);
  };
  for (const image of approvedPhotos) {
    const photo = studioPhoto(image);
    const y = studioPhotoHeight(photo, studioPose({ x: 0, y: 0 }));
    const previewTop = studioScreenY(y + photo.halfHeight, studioShoeDepth);
    assertProjection(
      new Vector3(-photo.halfWidth, y + photo.halfHeight, studioShoeDepth),
      -photo.halfWidth,
      previewTop,
    );
    assertProjection(
      new Vector3(photo.halfWidth, y - photo.halfHeight, studioShoeDepth),
      photo.halfWidth,
      previewTop + 2 * photo.halfHeight * studioVerticalScale,
    );
  }
  const { topRadius, bottomRadius, height, rimHeight } = studioPlinth;
  for (const [y, radius] of [
    [0, topRadius],
    [-height - rimHeight, bottomRadius],
  ]) {
    assertProjection(new Vector3(radius, y, 0), radius, studioScreenY(y));
    assertProjection(
      new Vector3(0, y, radius),
      0,
      studioScreenY(y) + radius * studioDepthScale,
    );
  }
});

test("approved photo crops have equal visible width and clear the platform at every full-turn angle", () => {
  for (const image of approvedPhotos) {
    const photo = studioPhoto(image);
    assert.ok(Math.abs(photo.cropWidth * photo.unit - 4.8) < 1e-9);
    for (let x = -4; x <= 4; x += 0.125)
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

test("shoe and platform fit inside desktop and mobile frames without clipping", () => {
  for (const [width, height] of [
    [320, 240],
    [480, 300],
    [844, 350],
    [1100, 520],
  ]) {
    const camera = new OrthographicCamera(
      -width / 2,
      width / 2,
      height / 2,
      -height / 2,
      0.1,
      250,
    );
    camera.zoom = studioZoom(width, height);
    camera.position.set(0, 3.2, 10.3);
    camera.lookAt(0, 0.95, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const inside = (point) => {
      const p = point.project(camera);
      assert.ok(
        Math.abs(p.x) < 0.92 && Math.abs(p.y) < 0.92,
        `${width}x${height}: ${p.toArray()}`,
      );
    };
    for (const image of approvedPhotos) {
      const photo = studioPhoto(image);
      for (let x = -4; x <= 4; x += 0.125)
        for (const y of [-1, 0, 1]) {
          const pose = studioPose({ x, y }),
            r = new Euler(pose.pitch, pose.yaw, pose.roll);
          camera.position.x = Math.sin(pose.yaw) * 0.12;
          camera.lookAt(0, 0.95, 0);
          camera.updateMatrixWorld(true);
          for (const a of [-1, 1])
            for (const b of [-1, 1])
              inside(
                new Vector3(a * photo.halfWidth, b * photo.halfHeight, 0)
                  .applyEuler(r)
                  .add(new Vector3(0, studioPhotoHeight(photo, pose), 0.3)),
              );
        }
    }
    for (let a = 0; a < Math.PI * 2; a += 0.1)
      for (const y of [0, -0.26])
        inside(new Vector3(Math.cos(a) * 2.83, y, Math.sin(a) * 2.83));
  }
});
