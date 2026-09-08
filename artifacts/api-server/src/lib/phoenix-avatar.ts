/**
 * Profile photos. Every account owns one, independently of any workspace — the
 * guide photo in the workspace record is the *brand's* face on the public site,
 * which is a different thing entirely and must never stand in for a person.
 *
 * Photos arrive as `data:` URLs on a JSON body rather than multipart, so the API
 * needs no upload middleware; the browser has already cropped and re-encoded the
 * file to a small square, so what lands here is tens of kilobytes, not megabytes.
 */

/** Ceiling on the decoded image, well above a 512px square and well below anything worth storing in a row. */
export const MAX_AVATAR_BYTES = 1_000_000;

/** Raster formats a browser renders inline without any chance of executing markup — SVG is deliberately absent. */
const SIGNATURES: Array<{ type: string; matches: (bytes: Buffer) => boolean }> = [
  { type: "image/png", matches: b => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: "image/jpeg", matches: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/gif", matches: b => b.subarray(0, 6).toString("latin1") === "GIF87a" || b.subarray(0, 6).toString("latin1") === "GIF89a" },
  { type: "image/webp", matches: b => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
];

/**
 * The image type these bytes actually are, or null. Sniffed rather than taken
 * from the `data:` URL's own label, so the stored content type can never be
 * something the uploader chose — that label is attacker-controlled, and it is
 * what a browser would honour when the photo is served back.
 */
export const sniffImageType = (bytes: Buffer): string | null =>
  bytes.length >= 12 ? (SIGNATURES.find(signature => signature.matches(bytes))?.type ?? null) : null;

export type AvatarUpload = { contentType: string; data: string };
export type AvatarRejection = "not_an_image" | "image_too_large" | "unsupported_image_type";

/**
 * Validates one uploaded `data:` URL and returns what to store: the sniffed
 * content type and the image re-encoded as canonical base64 (re-encoded, so a
 * padded or whitespace-laden payload cannot round-trip back out as written).
 */
export const readAvatarUpload = (value: unknown): AvatarUpload | AvatarRejection => {
  const match = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(value ?? "").trim());
  if (!match) return "not_an_image";
  const payload = match[1].replace(/\s+/g, "");
  // Base64 inflates by 4/3, so this rejects an oversized body before allocating it.
  if (payload.length > Math.ceil(MAX_AVATAR_BYTES / 3) * 4 + 4) return "image_too_large";
  const bytes = Buffer.from(payload, "base64");
  if (bytes.length > MAX_AVATAR_BYTES) return "image_too_large";
  const contentType = sniffImageType(bytes);
  if (!contentType) return "unsupported_image_type";
  return { contentType, data: bytes.toString("base64") };
};

/**
 * Where a person's photo is served from, or null when they have none.
 *
 * The version query is the row's `updated_at`: the bytes at one URL never change
 * without it changing too, so the photo can be cached hard and a new upload still
 * appears immediately.
 */
export const avatarUrl = (userId: string, updatedAt: Date | null | undefined) =>
  updatedAt ? `/api/users/${encodeURIComponent(userId)}/avatar?v=${updatedAt.getTime()}` : null;
