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
};
export function studioPhoto(image: string) {
  const photo = image.includes("textured") ? photos.black : photos.brown;
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
  return Math.min(Math.max(width, 1) / 7, Math.max(height, 1) / 4.8);
}
