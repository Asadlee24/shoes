import { Box3, Vector3 } from "three";
import type { Object3D, Mesh } from "three";

export const STUDIO_SHOE_LENGTH = 4.5;
export const STUDIO_CLEARANCE = 0.1;
export const STUDIO_PLINTH_RADIUS = 2.8;

export function prepareStudioModel(original: Object3D) {
  const clone = original.clone(true);
  clone.position.set(0, 0, 0);
  clone.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(clone);
  const size = bounds.getSize(new Vector3());
  if (!Number.isFinite(size.x) || Math.max(size.x, size.z) <= 0)
    throw new Error("Invalid shoe model");
  // Equal length, with a fixed gap above the plinth for every yaw angle.
  clone.scale.multiplyScalar(STUDIO_SHOE_LENGTH / Math.max(size.x, size.z));
  clone.updateMatrixWorld(true);
  bounds.setFromObject(clone);
  const centre = bounds.getCenter(new Vector3());
  clone.position.set(-centre.x, STUDIO_CLEARANCE - bounds.min.y, -centre.z);
  clone.traverse((object) => {
    if ((object as Mesh).isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return clone;
}
