export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;

export type EmailAttachmentItem = {
  key: string;
  fileName: string;
  contentType: string;
  size: number;
  contentBase64?: string;
  persistedId?: number;
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Invalid file content"));
        return;
      }
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("Invalid file content"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function filesToAttachments(files: File[]): Promise<EmailAttachmentItem[]> {
  const next: EmailAttachmentItem[] = [];
  for (const file of files) {
    const contentBase64 = await readFileAsBase64(file);
    next.push({
      key: `${file.name}-${Date.now()}-${Math.random()}`,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
      contentBase64,
    });
  }
  return next;
}
