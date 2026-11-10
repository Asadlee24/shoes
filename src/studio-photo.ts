// Bounds measured from the approved cutouts, without changing their pixels.
const photos = {
  black: {
    width: 1214,
    height: 1295,
    angle: -38,
    bounds: [-667.251, -293.61, 813.256, 356.206],
  },
  brown: {
    width: 1536,
    height: 1024,
    angle: -22,
    bounds: [-641.533, -295.87, 730.053, 337.664],
  },
  olive: {
    width: 1536,
    height: 1024,
    angle: -10,
    bounds: [-724, -291, 791, 362],
  },
  chocolate: {
    width: 1536,
    height: 1024,
    angle: -5,
    bounds: [-724, -270, 767, 354],
  },
};
export const studioFrame = { width: 7, height: 4.8 };
export const studioCamera = { y: 3.2, z: 10.3, targetY: 0.95 };
export const studioPlinth = {
  topRadius: 2.8,
  bottomRadius: 2.83,
  height: 0.22,
  rimHeight: 0.03,
};
export const studioShoeDepth = 0.3;
const cameraRise = studioCamera.y - studioCamera.targetY;
const cameraDistance = Math.hypot(cameraRise, studioCamera.z);
export const studioVerticalScale = studioCamera.z / cameraDistance;
export const studioDepthScale = cameraRise / cameraDistance;

// Project onto the same centered frame as the resting orthographic camera.
export function studioScreenY(y: number, z = 0) {
  return (
    (studioCamera.targetY - y) * studioVerticalScale + z * studioDepthScale
  );
}

export function studioPhoto(image: string) {
  const photo = image.includes("hero-olive")
    ? photos.olive
    : image.includes("hero-chocolate")
      ? photos.chocolate
      : image.includes("textured")
        ? photos.black
        : photos.brown;
  const [left, top, right, bottom] = photo.bounds;
  const cropWidth = right - left,
    cropHeight = bottom - top;
  const unit = 4.8 / cropWidth;
  return {
    ...photo,
    cropWidth,
    cropHeight,
    unit,
    planeWidth: photo.width * unit,
    planeHeight: photo.height * unit,
    offsetX: (-(left + right) / 2) * unit,
    offsetY: ((top + bottom) / 2) * unit,
    halfWidth: 2.4,
    halfHeight: (cropHeight * unit) / 2,
  };
}
// Lowest visible pixel stays above the plinth for every supported tilt.
export function studioPhotoHeight(
  photo: ReturnType<typeof studioPhoto>,
  pose: { pitch: number; yaw: number; roll: number },
) {
  const { pitch, yaw, roll } = pose;
  const yOfX =
    Math.cos(pitch) * Math.sin(roll) +
    Math.sin(pitch) * Math.sin(yaw) * Math.cos(roll);
  const yOfY =
    Math.cos(pitch) * Math.cos(roll) -
    Math.sin(pitch) * Math.sin(yaw) * Math.sin(roll);
  return (
    0.24 + Math.abs(yOfX) * photo.halfWidth + Math.abs(yOfY) * photo.halfHeight
  );
}

// Fit the whole shoe and plinth with a margin on narrow and wide displays.
export function studioZoom(width: number, height: number) {
  return Math.min(
    Math.max(width, 1) / studioFrame.width,
    Math.max(height, 1) / studioFrame.height,
  );
}
