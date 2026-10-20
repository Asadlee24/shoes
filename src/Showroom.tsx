import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  clampAxis,
  createStudioMotion,
  pointerPosition,
  studioPose,
} from "./studio-motion";
import type { StudioMotion, StudioPosition } from "./studio-motion";
import { studioPhoto } from "./studio-photo";
const StudioScene = lazy(() => import("./StudioScene"));
class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
export default function Showroom({
  image,
  dark,
  reset,
}: {
  image: string;
  dark: boolean;
  reset: number;
}) {
  const element = useRef<HTMLDivElement>(null),
    photo = useRef<HTMLDivElement>(null);
  const motion = useRef<StudioPosition>({ x: 0, y: 0 });
  const control = useRef<StudioMotion | null>(null);
  const resting = useRef<StudioPosition>({ x: 0, y: 0 });
  const invalidate = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false),
    [supported, setSupported] = useState(false);
  const help = useId();
  const layout = studioPhoto(image);
  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback(() => {
    setReady(false);
    setSupported(false);
    invalidate.current = () => {};
  }, []);
  const onInvalidate = useCallback((render: () => void) => {
    invalidate.current = render;
    render();
  }, []);
  useEffect(() => {
    const host = element.current;
    if (!host) return;
    const surface = host.closest<HTMLElement>(".mono-stage") || host;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const controller = createStudioMotion({
      requestFrame: (callback) => requestAnimationFrame(callback),
      cancelFrame: (id) => cancelAnimationFrame(id),
      reduced: media.matches,
      onChange: (position) => {
        motion.current = position;
        if (photo.current)
          photo.current.style.transform = studioPose(position).css;
        invalidate.current();
      },
    });
    control.current = controller;
    let drag: {
      id: number;
      x: number;
      y: number;
      start: StudioPosition;
    } | null = null;
    const move = (event: PointerEvent) => {
      const bounds = surface.getBoundingClientRect();
      if (drag && event.pointerId === drag.id) {
        controller.moveTo({
          x:
            drag.start.x +
            ((event.clientX - drag.x) / Math.max(bounds.width, 1)) * 2,
          y:
            drag.start.y +
            ((event.clientY - drag.y) / Math.max(bounds.height, 1)) * 2.5,
        });
      } else if (event.pointerType !== "touch") {
        const pointer = pointerPosition(event.clientX, event.clientY, bounds);
        controller.moveTo({
          x: resting.current.x + pointer.x * 0.18,
          y: clampAxis(resting.current.y + pointer.y * 0.5),
        });
      }
    };
    const down = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        (event.target instanceof Element &&
          event.target.closest("a,button,input,select,textarea"))
      )
        return;
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        start: controller.readTarget(),
      };
      surface.dataset.dragging = "true";
      surface.setPointerCapture(event.pointerId);
      if (event.pointerType !== "touch") event.preventDefault();
    };
    const end = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      resting.current = controller.readTarget();
      drag = null;
      delete surface.dataset.dragging;
      if (surface.hasPointerCapture(event.pointerId))
        surface.releasePointerCapture(event.pointerId);
    };
    const leave = () => {
      if (!drag) controller.moveTo(resting.current);
    };
    const change = () => controller.setReduced(media.matches);
    surface.addEventListener("pointermove", move, true);
    surface.addEventListener("pointerdown", down, true);
    surface.addEventListener("pointerup", end, true);
    surface.addEventListener("pointercancel", end, true);
    surface.addEventListener("lostpointercapture", end, true);
    surface.addEventListener("pointerleave", leave);
    media.addEventListener("change", change);
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([entry]) => controller.setActive(entry.isIntersecting),
            { rootMargin: "80px" },
          )
        : null;
    observer?.observe(host);
    try {
      const probe = document.createElement("canvas"),
        gl = probe.getContext("webgl2");
      setSupported(Boolean(gl));
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      setSupported(false);
    }
    return () => {
      controller.dispose();
      control.current = null;
      observer?.disconnect();
      surface.removeEventListener("pointermove", move, true);
      surface.removeEventListener("pointerdown", down, true);
      surface.removeEventListener("pointerup", end, true);
      surface.removeEventListener("pointercancel", end, true);
      surface.removeEventListener("lostpointercapture", end, true);
      surface.removeEventListener("pointerleave", leave);
      media.removeEventListener("change", change);
      delete surface.dataset.dragging;
    };
  }, []);
  useEffect(() => {
    resting.current = { x: 0, y: 0 };
    control.current?.reset();
  }, [image, reset]);
  return (
    <div
      className={`showroom ${ready ? "scene-ready" : ""}`}
      ref={element}
      role="group"
      tabIndex={0}
      aria-label="Interactive shoe display"
      aria-describedby={help}
      onKeyDown={(event) => {
        const position = control.current?.readTarget() || { x: 0, y: 0 };
        if (event.key === "Home" || event.key === "0") {
          event.preventDefault();
          resting.current = { x: 0, y: 0 };
          control.current?.reset();
          return;
        }
        const keys: Record<string, StudioPosition> = {
          ArrowLeft: { x: -0.2, y: 0 },
          ArrowRight: { x: 0.2, y: 0 },
          ArrowUp: { x: 0, y: -0.2 },
          ArrowDown: { x: 0, y: 0.2 },
        };
        const step = keys[event.key];
        if (step) {
          event.preventDefault();
          resting.current = {
            x: position.x + step.x,
            y: clampAxis(position.y + step.y),
          };
          control.current?.moveTo(resting.current);
        }
      }}
    >
      <span className="showroom-help" id={help}>
        Move your mouse to tilt the shoe photograph. Drag left or right to flip
        the display. Arrow keys rotate it. Home resets it.
      </span>
      <div className="showroom-fallback" aria-hidden="true">
        <span className="fallback-plinth" />
        <div className="showroom-object" ref={photo}>
          <svg
            viewBox={`${layout.bounds[0]} ${layout.bounds[1]} ${layout.cropWidth} ${layout.cropHeight}`}
            width={layout.cropWidth}
            height={layout.cropHeight}
          >
            <image
              href={image}
              x={-layout.width / 2}
              y={-layout.height / 2}
              width={layout.width}
              height={layout.height}
              transform={`rotate(${layout.angle})`}
            />
          </svg>
        </div>
      </div>
      {supported && (
        <SceneBoundary onError={onFailure}>
          <Suspense fallback={null}>
            <StudioScene
              image={image}
              dark={dark}
              motion={motion}
              onReady={onReady}
              onFailure={onFailure}
              onInvalidate={onInvalidate}
            />
          </Suspense>
        </SceneBoundary>
      )}
    </div>
  );
}
