export type StudioPosition = { x: number; y: number };
export const clampAxis = (value: number) =>
  Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;

export function pointerPosition(
  x: number,
  y: number,
  bounds: { left: number; top: number; width: number; height: number },
): StudioPosition {
  return {
    x:
      bounds.width > 0
        ? clampAxis(((x - bounds.left) / bounds.width) * 2 - 1)
        : 0,
    y:
      bounds.height > 0
        ? clampAxis(((y - bounds.top) / bounds.height) * 2 - 1)
        : 0,
  };
}

export function studioPose(position: StudioPosition) {
  const x = clampAxis(position.x),
    y = clampAxis(position.y);
  return {
    yaw: x * 0.72,
    pitch: -0.035 + y * 0.34,
    roll: -x * 0.07,
    offsetX: x * 0.28,
    offsetY: 1.65 - y * 0.1,
    css: `translate3d(${x * 28}px, ${y * 9}px, 0) rotateX(${-y * 19.5}deg) rotateY(${x * 41.25}deg) rotateZ(${-x * 4}deg)`,
  };
}

type Options = {
  requestFrame: (callback: (time: number) => void) => number;
  cancelFrame: (id: number) => void;
  onChange: (position: StudioPosition) => void;
  reduced?: boolean;
};

// One controller drives the WebGL scene and photographic fallback. Manual
// input stays available with reduced motion; only its interpolation is removed.
export function createStudioMotion(options: Options) {
  let position: StudioPosition = { x: 0, y: 0 };
  let target: StudioPosition = { x: 0, y: 0 };
  let frame: number | null = null,
    last = 0;
  let active = true,
    disposed = false,
    reduced = options.reduced ?? false;
  const stop = () => {
    if (frame !== null) options.cancelFrame(frame);
    frame = null;
    last = 0;
  };
  const emit = () => options.onChange({ ...position });
  const tick = (time: number) => {
    frame = null;
    if (!active || disposed) return;
    const delta = last ? Math.min((time - last) / 1000, 0.05) : 1 / 60;
    last = time;
    const blend = 1 - Math.exp(-12 * delta);
    position.x += (target.x - position.x) * blend;
    position.y += (target.y - position.y) * blend;
    const settled =
      Math.abs(position.x - target.x) + Math.abs(position.y - target.y) <
      0.0006;
    if (settled) position = { ...target };
    emit();
    if (!settled) frame = options.requestFrame(tick);
    else last = 0;
  };
  const wake = () => {
    if (disposed || !active) return;
    if (reduced) {
      stop();
      position = { ...target };
      emit();
    } else if (frame === null) frame = options.requestFrame(tick);
  };
  return {
    moveTo(next: StudioPosition) {
      target = { x: clampAxis(next.x), y: clampAxis(next.y) };
      wake();
    },
    readTarget: () => ({ ...target }),
    reset() {
      target = { x: 0, y: 0 };
      wake();
    },
    setReduced(value: boolean) {
      reduced = value;
      wake();
    },
    setActive(value: boolean) {
      active = value;
      if (active) wake();
      else stop();
    },
    dispose() {
      disposed = true;
      stop();
    },
  };
}
export type StudioMotion = ReturnType<typeof createStudioMotion>;
