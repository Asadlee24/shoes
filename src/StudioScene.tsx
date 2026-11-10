import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
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
import {
  studioCamera,
  studioPhoto,
  studioPhotoHeight,
  studioPlinth,
  studioShoeDepth,
  studioZoom,
} from "./studio-photo";
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
  useLayoutEffect(() => {
    if (camera instanceof OrthographicCamera) {
      camera.zoom = studioZoom(size.width, size.height);
      camera.updateProjectionMatrix();
      invalidate();
    }
  }, [camera, size.width, size.height, invalidate]);
  const shoe = useRef<Group>(null);
  const hasDrawn = useRef(false);
  const layout = studioPhoto(image);
  const { topRadius, bottomRadius, height, rimHeight } = studioPlinth;
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
  useLayoutEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);
  useEffect(() => () => depth.dispose(), [depth]);
  useFrame(({ camera }) => {
    if (!shoe.current) return;
    const pose = studioPose(motion.current);
    shoe.current.rotation.set(pose.pitch, pose.yaw, pose.roll);
    shoe.current.position.set(
      0,
      studioPhotoHeight(layout, pose),
      studioShoeDepth,
    );
    camera.position.x = Math.sin(pose.yaw) * 0.12;
    camera.lookAt(0, studioCamera.targetY, 0);
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
      <mesh position={[0, -height / 2, 0]} receiveShadow>
        <cylinderGeometry args={[topRadius, bottomRadius, height, 96]} />
        <meshStandardMaterial
          color={dark ? "#292929" : "#dededb"}
          roughness={0.75}
        />
      </mesh>
      <mesh position={[0, -height - rimHeight / 2, 0]}>
        <cylinderGeometry args={[bottomRadius, bottomRadius, rimHeight, 96]} />
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
            onAfterRender={() => {
              if (hasDrawn.current) return;
              hasDrawn.current = true;
              onReady();
            }}
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
      camera={{
        position: [0, studioCamera.y, studioCamera.z],
        zoom: 50,
        near: 0.1,
        far: 250,
      }}
      dpr={[1, 1.5]}
      shadows
      frameloop="demand"
      style={{ pointerEvents: "none" }}
      gl={{ alpha: true, antialias: true, powerPreference: "default" }}
      onCreated={({ camera, gl, invalidate }) => {
        camera.lookAt(0, studioCamera.targetY, 0);
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
