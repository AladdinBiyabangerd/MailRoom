import { config } from "../config.js";
import { Codes, Msg, bad } from "../errors.js";

export function decodeAttachmentBase64(contentBase64: string): Buffer {
  try {
    const content = Buffer.from(contentBase64.replace(/\s+/g, ""), "base64");
    if (!content.length) {
      throw new Error("empty");
    }
    return content;
  } catch {
    throw bad(Codes.SENT_EMAIL, Msg.EMAIL_ATTACHMENT_INVALID);
  }
}

export function assertAttachmentSize(content: Buffer) {
  if (content.length > config.limits.maxAttachmentBytes) {
    throw bad(Codes.SENT_EMAIL, Msg.EMAIL_ATTACHMENT_TOO_LARGE, config.limits.maxAttachmentBytes);
  }
}

export function assertAttachmentCount(count: number) {
  if (count > config.limits.maxAttachments) {
    throw bad(Codes.SENT_EMAIL, Msg.EMAIL_ATTACHMENT_LIMIT, config.limits.maxAttachments);
  }
}
