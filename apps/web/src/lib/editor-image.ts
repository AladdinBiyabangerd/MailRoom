const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
/** Typical email column is ~600px; 1200 covers 2× retina. Small images are never upscaled. */
const MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.82;
/** Keep original GIF only when it already fits email width and is not huge. */
const MAX_KEEP_GIF_BYTES = 1024 * 1024;

export const EDITOR_IMAGE_ACCEPT = "image/png,image/jpeg,image/jpg,image/gif,image/webp";

export async function fileToEditorImageSrc(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("not-image");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("too-large");
  }

  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_WIDTH / Math.max(image.width, 1));
  const needsDownscale = scale < 1;

  if (file.type === "image/gif") {
    if (!needsDownscale && file.size <= MAX_KEEP_GIF_BYTES) {
      return dataUrl;
    }
    return rasterizeToJpeg(image, scale);
  }

  const isJpeg = file.type === "image/jpeg" || file.type === "image/jpg";
  if (isJpeg && !needsDownscale) {
    return dataUrl;
  }

  const canvas = drawScaled(image, scale);
  if (!canvas) {
    return dataUrl;
  }

  const keepPng =
    (file.type === "image/png" || file.type === "image/webp") && hasVisibleAlpha(canvas);
  if (keepPng && !needsDownscale) {
    return dataUrl;
  }

  return keepPng
    ? canvas.toDataURL("image/png")
    : canvasToJpeg(canvas);
}

export function altFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  return base || "image";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("read-failed"));
    };
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("read-failed"));
    image.src = dataUrl;
  });
}

function drawScaled(image: HTMLImageElement, scale: number): HTMLCanvasElement | null {
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, width, height);
  return canvas;
}

function rasterizeToJpeg(image: HTMLImageElement, scale: number): string {
  const canvas = drawScaled(image, scale);
  if (!canvas) {
    throw new Error("read-failed");
  }
  return canvasToJpeg(canvas);
}

function canvasToJpeg(canvas: HTMLCanvasElement): string {
  const flattened = document.createElement("canvas");
  flattened.width = canvas.width;
  flattened.height = canvas.height;
  const ctx = flattened.getContext("2d");
  if (!ctx) {
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, flattened.width, flattened.height);
  ctx.drawImage(canvas, 0, 0);
  return flattened.toDataURL("image/jpeg", JPEG_QUALITY);
}

function hasVisibleAlpha(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return false;
  }
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      return true;
    }
  }
  return false;
}
