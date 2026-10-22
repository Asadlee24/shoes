// Product photographs only. Payment receipts keep their original bytes.
export async function prepareProductPhoto(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPG, PNG or WebP product photo.");
  if (file.size > 20_000_000)
    throw new Error("Choose a product photo smaller than 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const photo = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(
          new Error(
            "This photo could not be opened. Try exporting it as JPG or PNG.",
          ),
        );
      image.src = url;
    });
    if (!photo.naturalWidth || !photo.naturalHeight)
      throw new Error("This photo has no readable image dimensions.");
    const canvas = document.createElement("canvas");
    for (const longest of [1800, 1400, 1000]) {
      const scale = Math.min(
        1,
        longest / Math.max(photo.naturalWidth, photo.naturalHeight),
      );
      canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error(
          "Photo resizing is unavailable. Try a JPG smaller than 3 MB.",
        );
      context.drawImage(photo, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) =>
            result
              ? resolve(result)
              : reject(new Error("Could not prepare this photo.")),
          "image/webp",
          0.88,
        ),
      );
      if (blob.size <= 2_700_000) return blob;
    }
    throw new Error("This photo is still too large. Try a smaller JPG or PNG.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
