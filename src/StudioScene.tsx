import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import type { Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { studioPose } from "./studio-motion";
import { prepareStudioModel } from "./studio-model";
import type { StudioPosition } from "./studio-motion";

type Props = {
  image: string;
  dark: boolean;
  motion: RefObject<StudioPosition>;
  onReady: () => void;
};
function DisplayWorld({ image, dark, onReady, motion }: Props) {
  const gltf = useLoader(GLTFLoader, "/models/qadam-loafers.glb");
  const shoe = useRef<Group>(null);
  const model = useMemo(() => {
    const name = image.includes("textured") ? "HERO_BLACK" : "HERO_SUEDE";
    const original = gltf.scene.getObjectByName(name);
    if (!original) throw new Error("Shoe model unavailable");
    return prepareStudioModel(original);
  }, [gltf, image]);
  useEffect(() => onReady(), [model, onReady]);
  useFrame(({ camera }) => {
    if (!shoe.current) return;
    const pose = studioPose(motion.current);
    shoe.current.rotation.y = pose.yaw;
    camera.position.y = pose.cameraHeight;
    camera.lookAt(0, 0.5, 0);
  });
  return (
    <>
      <ambientLight intensity={0.9} />
      <hemisphereLight args={["#ffffff", dark ? "#404040" : "#b9b9b9", 1.9]} />
      <directionalLight
        position={[-3, 7, 5]}
        intensity={3.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
      />
      <directionalLight position={[4, 3, -5]} intensity={2.4} />
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
      <mesh
        position={[0, -0.26, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial
          color={dark ? "#101010" : "#f4f4f2"}
          roughness={1}
        />
      </mesh>
      <group ref={shoe} dispose={null}>
        <primitive object={model} />
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
      camera={{ position: [3.4, 4.2, 10], fov: 36, near: 0.1, far: 250 }}
      dpr={[1, 1.5]}
      shadows
      frameloop="demand"
      style={{ pointerEvents: "none" }}
      gl={{ alpha: true, antialias: true, powerPreference: "default" }}
      onCreated={({ camera, gl, invalidate }) => {
        camera.lookAt(0, 0.5, 0);
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
