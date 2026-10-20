import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import {
  DoubleSide,
  MeshDepthMaterial,
  RGBADepthPacking,
  SRGBColorSpace,
  TextureLoader,
} from "three";
import type { Group } from "three";
import { studioPose } from "./studio-motion";
import type { StudioPosition } from "./studio-motion";
type Props = {
  image: string;
  dark: boolean;
  motion: RefObject<StudioPosition>;
  onReady: () => void;
};
function DisplayWorld({ image, dark, onReady, motion }: Props) {
  const texture = useLoader(TextureLoader, image);
  const shoe = useRef<Group>(null);
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
  }, [texture, onReady]);
  useEffect(() => () => depth.dispose(), [depth]);
  const ratio = texture.image.width / texture.image.height;
  const width = ratio > 1.2 ? 5.8 : 3.8;
  const height = width / ratio;
  useFrame(({ camera }) => {
    if (!shoe.current) return;
    const pose = studioPose(motion.current);
    shoe.current.rotation.set(pose.pitch, pose.yaw, pose.roll);
    shoe.current.position.set(pose.offsetX, pose.offsetY, 0.45);
    camera.position.x = motion.current.x * 0.22;
    camera.position.y = 2.7 - motion.current.y * 0.16;
    camera.lookAt(0, 1.0, 0);
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
export default function StudioScene({
  image,
  dark,
  motion,
  onReady,
  onFailure,
  onInvalidate,
}: Props & {
  onFailure: () => void;
  onInvalidate: (invalidate: () => void) => void;
}) {
  return (
    <Canvas
      className="showroom-canvas"
      camera={{ position: [0, 2.7, 10.8], fov: 35, near: 0.1, far: 250 }}
      dpr={[1, 1.5]}
      shadows
      frameloop="demand"
      style={{ pointerEvents: "none" }}
      gl={{ alpha: true, antialias: true, powerPreference: "default" }}
      onCreated={({ camera, gl, invalidate }) => {
        camera.lookAt(0, 1, 0);
        gl.setClearAlpha(0);
        onInvalidate(invalidate);
        gl.domElement.addEventListener(
          "webglcontextlost",
          (event) => {
            event.preventDefault();
            onFailure();
          },
          { once: true },
        );
      }}
      aria-hidden="true"
    >
      <DisplayWorld
        image={image}
        dark={dark}
        motion={motion}
        onReady={onReady}
      />
    </Canvas>
  );
}
