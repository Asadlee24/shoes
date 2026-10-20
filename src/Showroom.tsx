import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode, RefObject } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import {
  DoubleSide,
  MathUtils,
  MeshDepthMaterial,
  RGBADepthPacking,
  SRGBColorSpace,
  TextureLoader,
} from "three";
import type { Group } from "three";
type Motion = { x: number; y: number };
type Props = {
  image: string;
  dark: boolean;
  active: boolean;
  reduced: boolean;
  onReady: () => void;
  motion: RefObject<Motion>;
};
function DisplayWorld({
  image,
  dark,
  active,
  reduced,
  onReady,
  motion,
}: Props) {
  const texture = useLoader(TextureLoader, image);
  const shoe = useRef<Group>(null);
  const [arrived] = useState(() => performance.now());
  const depth = useMemo(
    () =>
      new MeshDepthMaterial({
        map: texture,
        alphaTest: 0.2,
        depthPacking: RGBADepthPacking,
        side: DoubleSide,
      }),
    [texture],
  );
  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    onReady();
    return () => depth.dispose();
  }, [texture, depth, onReady]);
  const ratio = texture.image.width / texture.image.height;
  const width = ratio > 1.2 ? 5.8 : 3.8;
  const height = width / ratio;
  useFrame((state, delta) => {
    if (!shoe.current || !active) return;
    const dt = Math.min(delta, 0.05);
    const entry = reduced
      ? 1
      : Math.min((performance.now() - arrived) / 900, 1);
    shoe.current.scale.setScalar(0.9 + 0.1 * (1 - (1 - entry) ** 3));
    shoe.current.rotation.y = MathUtils.damp(
      shoe.current.rotation.y,
      reduced ? 0 : motion.current.x * 0.14,
      5,
      dt,
    );
    shoe.current.rotation.x = MathUtils.damp(
      shoe.current.rotation.x,
      reduced ? -0.035 : -0.035 + motion.current.y * 0.08,
      5,
      dt,
    );
    shoe.current.position.y = MathUtils.damp(
      shoe.current.position.y,
      1.6 + (reduced ? 0 : Math.sin(state.clock.elapsedTime * 0.65) * 0.035),
      4,
      dt,
    );
  });
  return (
    <>
      <ambientLight intensity={1.3} />
      <hemisphereLight
        args={[dark ? "#f7f7f7" : "#ffffff", dark ? "#171717" : "#c8c8c8", 1.5]}
      />
      <directionalLight
        position={[-3, 7, 5]}
        intensity={3}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-bias={-0.0003}
        shadow-normalBias={0.035}
      />
      <pointLight
        position={[5, 2, -3]}
        intensity={15}
        color={dark ? "#d8e4eb" : "#ffffff"}
      />
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <cylinderGeometry args={[2.52, 2.55, 0.15, 96]} />
        <meshStandardMaterial
          color={dark ? "#252525" : "#dededb"}
          roughness={0.6}
          metalness={0.2}
        />
      </mesh>
      <mesh position={[0, -0.145, 0]}>
        <cylinderGeometry args={[2.55, 2.55, 0.025, 96]} />
        <meshStandardMaterial
          color={dark ? "#444444" : "#b9b9b6"}
          metalness={0.8}
          roughness={0.23}
        />
      </mesh>
      <mesh
        position={[0, -0.18, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial
          color={dark ? "#101010" : "#f4f4f2"}
          roughness={1}
        />
      </mesh>
      <group ref={shoe} position={[0, 1.6, 0.45]}>
        <mesh
          rotation={[0, 0, ratio > 1.2 ? 0.14 : 0.42]}
          castShadow
          customDepthMaterial={depth}
        >
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial
            map={texture}
            transparent
            alphaTest={0.02}
            side={DoubleSide}
            toneMapped={false}
          />
        </mesh>
      </group>
    </>
  );
}
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
    motion = useRef<Motion>({ x: 0, y: 0 });
  const [ready, setReady] = useState(false),
    [active, setActive] = useState(true),
    [supported, setSupported] = useState(false),
    [reduced, setReduced] = useState(false);
  const readyCallback = useMemo(() => () => setReady(true), []);
  useEffect(() => {
    motion.current = { x: 0, y: 0 };
  }, [image, reset]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    try {
      const probe = document.createElement("canvas");
      const gl = probe.getContext("webgl2");
      setSupported(Boolean(gl));
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      setSupported(false);
    }
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "80px" },
    );
    if (element.current) observer.observe(element.current);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", change);
    };
  }, []);
  return (
    <div
      className={`showroom ${ready ? "scene-ready" : ""}`}
      ref={element}
      role="img"
      aria-label="Photographic loafer displayed in an interactive three-dimensional studio"
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const b = e.currentTarget.getBoundingClientRect();
        motion.current = {
          x: ((e.clientX - b.left) / b.width) * 2 - 1,
          y: ((e.clientY - b.top) / b.height) * 2 - 1,
        };
      }}
      onPointerLeave={() => {
        motion.current = { x: 0, y: 0 };
      }}
    >
      <div className="showroom-fallback" aria-hidden="true">
        <span className="fallback-plinth" />
        <img
          src={image}
          alt=""
          className={
            image.includes("textured") ? "black-cutout" : "brown-cutout"
          }
        />
      </div>
      {supported && (
        <SceneBoundary onError={() => setReady(false)}>
          <Suspense fallback={null}>
            <Canvas
              className="showroom-canvas"
              key={image + reset}
              camera={{
                position: [0, 2.7, 10.8],
                fov: 35,
                near: 0.1,
                far: 250,
              }}
              dpr={[1, 1.5]}
              shadows
              frameloop={active && !reduced ? "always" : "demand"}
              gl={{ alpha: true, antialias: true, powerPreference: "default" }}
              onCreated={({ camera, gl }) => {
                camera.lookAt(0, 1.0, 0);
                gl.setClearAlpha(0);
                gl.domElement.addEventListener(
                  "webglcontextlost",
                  (event) => {
                    event.preventDefault();
                    setReady(false);
                    setSupported(false);
                  },
                  { once: true },
                );
              }}
              aria-hidden="true"
            >
              <DisplayWorld
                image={image}
                dark={dark}
                active={active}
                reduced={reduced}
                onReady={readyCallback}
                motion={motion}
              />
            </Canvas>
          </Suspense>
        </SceneBoundary>
      )}
    </div>
  );
}
