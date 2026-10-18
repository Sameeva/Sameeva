import { MAX_LOGO_DATA_URL_LENGTH } from "@/db/schema";

export const MAX_LOGO_FILE_BYTES = 2 * 1024 * 1024;
const MAX_LOGO_SIDE_PX = 400;

/** Detects PNG/JPEG from the file's first bytes (the declared MIME type can lie). */
export function detectImageType(bytes: Uint8Array): "png" | "jpeg" | null {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  return null;
}

export type LogoResult = { ok: true; dataUrl: string } | { ok: false; error: "type" | "size" | "read" };

/**
 * Validates an uploaded logo and re-encodes it through a canvas (browser only).
 * Re-encoding drops anything hidden in the original file (metadata, trailing
 * data) and caps the size; the stored value is always a fresh PNG data URL.
 */
export async function processLogo(file: File): Promise<LogoResult> {
  if (file.size > MAX_LOGO_FILE_BYTES) return { ok: false, error: "size" };
  if (file.type !== "image/png" && file.type !== "image/jpeg") return { ok: false, error: "type" };

  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (!detectImageType(head)) return { ok: false, error: "type" };

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, error: "read" };
  }
  const scale = Math.min(1, MAX_LOGO_SIDE_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, error: "read" };
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/png");
  if (!dataUrl.startsWith("data:image/png;base64,") || dataUrl.length > MAX_LOGO_DATA_URL_LENGTH) {
    return { ok: false, error: "size" };
  }
  return { ok: true, dataUrl };
}
