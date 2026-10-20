import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createStudioMotion,
  pointerPosition,
  studioPose,
} from "../src/studio-motion.ts";

function harness(reduced = false) {
  const queue = new Map(),
    rendered = [];
  let id = 0,
    time = 0;
  const controller = createStudioMotion({
    reduced,
    requestFrame(callback) {
      queue.set(++id, callback);
      return id;
    },
    cancelFrame(key) {
      queue.delete(key);
    },
    onChange(position) {
      rendered.push(position);
    },
  });
  const flush = () => {
    let count = 0;
    while (queue.size) {
      if (++count > 200) throw new Error("Motion did not settle");
      const [key, callback] = queue.entries().next().value;
      queue.delete(key);
      time += 1000 / 60;
      callback(time);
    }
  };
  return { controller, queue, rendered, flush };
}

test("pointer coordinates use the entire stage and remain bounded outside it", () => {
  const bounds = { left: 100, top: 50, width: 600, height: 400 };
  assert.deepEqual(pointerPosition(400, 250, bounds), { x: 0, y: 0 });
  assert.deepEqual(pointerPosition(700, 450, bounds), { x: 1, y: 1 });
  assert.deepEqual(pointerPosition(-100, 900, bounds), { x: -1, y: 1 });
  assert.deepEqual(
    pointerPosition(100, 100, { left: 0, top: 0, width: 0, height: 0 }),
    { x: 0, y: 0 },
  );
});

test("manual movement visibly rotates both render paths and stops scheduling frames when settled", () => {
  const { controller, rendered, flush, queue } = harness();
  controller.moveTo({ x: 1, y: -1 });
  assert.equal(queue.size, 1);
  flush();
  assert.deepEqual(rendered.at(-1), { x: 1, y: -1 });
  const pose = studioPose(rendered.at(-1));
  assert.equal(pose.yaw, 0.38);
  assert.equal(pose.pitch, -0.16);
  assert.match(pose.css, /rotateY/);
  assert.equal(queue.size, 0);
  controller.reset();
  flush();
  assert.deepEqual(rendered.at(-1), { x: 0, y: 0 });
});

test("reduced motion still permits immediate intentional movement and renderer invalidation", () => {
  const { controller, rendered, queue } = harness(true);
  controller.moveTo({ x: -1, y: 0.5 });
  assert.deepEqual(rendered.at(-1), { x: -1, y: 0.5 });
  assert.equal(queue.size, 0);
  controller.reset();
  assert.deepEqual(rendered.at(-1), { x: 0, y: 0 });
});

test("offscreen motion pauses, resumes at the requested view and cleans up pending work", () => {
  const { controller, rendered, flush, queue } = harness();
  controller.setActive(false);
  controller.moveTo({ x: 10, y: -10 });
  assert.equal(queue.size, 0);
  assert.equal(rendered.length, 0);
  controller.setActive(true);
  flush();
  assert.deepEqual(rendered.at(-1), { x: 1, y: -1 });
  controller.moveTo({ x: 0, y: 0 });
  assert.equal(queue.size, 1);
  controller.dispose();
  assert.equal(queue.size, 0);
});
