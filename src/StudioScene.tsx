import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  DoubleSide,
  OrthographicCamera,
  MeshDepthMaterial,
  RGBADepthPacking,
  SRGBColorSpace,
  TextureLoader,
} from "three";
import type { Group } from "three";
import { studioPose } from "./studio-motion";
import { studioPhoto, studioPhotoHeight, studioZoom } from "./studio-photo";
import type { StudioPosition } from "./studio-motion";

type Props = {
  image: string;
  dark: boolean;
  motion: RefObject<StudioPosition>;
  onReady: () => void;
};
function DisplayWorld({ image, dark, onReady, motion }: Props) {
  const texture = useLoader(TextureLoader, image);
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    if (camera instanceof OrthographicCamera) {
      camera.zoom = studioZoom(size.width, size.height);
      camera.updateProjectionMatrix();
      invalidate();
    }
  }, [camera, size.width, size.height, invalidate]);
  const shoe = useRef<Group>(null);
  const layout = studioPhoto(image);
  const depth = useMemo(
    () =>
      new MeshDepthMaterial({
        map: texture,
        alphaTest: 0.125,
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
  useFrame(({ camera }) => {
    if (!shoe.current) return;
    const pose = studioPose(motion.current);
    shoe.current.rotation.set(pose.pitch, pose.yaw, pose.roll);
    shoe.current.position.set(0, studioPhotoHeight(layout, pose), 0.3);
    camera.position.x = motion.current.x * 0.12;
    camera.lookAt(0, 0.95, 0);
  });
  return (
    <>
      <ambientLight intensity={1.1} />
      <hemisphereLight args={["#ffffff", dark ? "#303030" : "#b9b9b9", 1.5]} />
      <directionalLight
        position={[-3, 7, 5]}
        intensity={2.7}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
      />
      <mesh position={[0, -0.11, 0]} receiveShadow>
        <cylinderGeometry args={[2.8, 2.83, 0.22, 96]} />
        <meshStandardMaterial
          color={dark ? "#292929" : "#dededb"}
          roughness={0.75}
        />
      </mesh>
      <mesh position={[0, -0.235, 0]}>
        <cylinderGeometry args={[2.83, 2.83, 0.03, 96]} />
        <meshStandardMaterial
          color={dark ? "#454545" : "#b9b9b6"}
          metalness={0.65}
          roughness={0.3}
        />
      </mesh>
      <group ref={shoe}>
        <group position={[layout.offsetX, layout.offsetY, 0]}>
          <mesh
            rotation={[0, 0, (-layout.angle * Math.PI) / 180]}
            castShadow
            customDepthMaterial={depth}
          >
            <planeGeometry args={[layout.planeWidth, layout.planeHeight]} />
            <meshBasicMaterial
              map={texture}
              transparent
              alphaTest={0.125}
              side={DoubleSide}
              toneMapped={false}
            />
          </mesh>
        </group>
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
      orthographic
      camera={{ position: [0, 3.2, 10.3], zoom: 50, near: 0.1, far: 250 }}
      dpr={[1, 1.5]}
      shadows
      frameloop="demand"
      style={{ pointerEvents: "none" }}
      gl={{ alpha: true, antialias: true, powerPreference: "default" }}
      onCreated={({ camera, gl, invalidate }) => {
        camera.lookAt(0, 0.95, 0);
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
