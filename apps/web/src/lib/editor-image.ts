const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_WIDTH = 1400;
const JPEG_QUALITY = 0.82;

export const EDITOR_IMAGE_ACCEPT = "image/png,image/jpeg,image/jpg,image/gif,image/webp";

export async function fileToEditorImageSrc(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("not-image");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("too-large");
  }

  const dataUrl = await readFileAsDataUrl(file);
  if (file.type === "image/gif") {
    return dataUrl;
  }
  return resizeDataUrl(dataUrl, file.type);
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

function resizeDataUrl(dataUrl: string, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const scale = Math.min(1, MAX_WIDTH / Math.max(image.width, 1));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(image, 0, 0, width, height);
      const keepPng = mimeType === "image/png";
      resolve(keepPng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    image.onerror = () => reject(new Error("read-failed"));
    image.src = dataUrl;
  });
}
