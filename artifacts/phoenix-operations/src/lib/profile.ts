import { apiRequest } from "./store/api";

/**
 * The signed-in person's own account — name, password, photo. Everything here is
 * about *them*, not about the workspace they happen to be standing in, so none of
 * it is gated by a role: a partner with the thinnest seat edits their profile
 * exactly as a super admin does.
 */

/** Longest edge of a stored photo. A circle 34px across never needs more, and retina screens are covered twice over. */
const AVATAR_SIZE = 512;
/** Largest file we will even open. Anything bigger is a photo library original, not an avatar. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type ProfilePhoto = { avatarUrl: string | null };

/**
 * Crops an image file to a centred square and re-encodes it small.
 *
 * The browser does this, not the server: it turns a 4 MB phone photo into ~50 KB
 * before it ever crosses the wire, and it means the bytes the server stores are
 * ones a canvas produced — never the uploaded file itself, whatever it claimed
 * to be. Transparency survives as PNG; everything else becomes JPEG, which is
 * several times smaller for a photograph.
 */
export const squareImageDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("not_an_image"));
    if (file.size > MAX_UPLOAD_BYTES) return reject(new Error("file_too_large"));
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const edge = Math.min(image.naturalWidth, image.naturalHeight);
        if (!edge) throw new Error("not_an_image");
        const size = Math.min(AVATAR_SIZE, edge);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("canvas_unavailable");
        // Centre crop: the middle of a portrait is where the face is.
        context.drawImage(image, (image.naturalWidth - edge) / 2, (image.naturalHeight - edge) / 2, edge, edge, 0, 0, size, size);
        const transparent = file.type === "image/png" || file.type === "image/webp" || file.type === "image/gif";
        resolve(canvas.toDataURL(transparent ? "image/png" : "image/jpeg", 0.86));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("image_unreadable"));
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_unreadable"));
    };
    image.src = url;
  });

/** Changes the display name shown in the sidebar and the member directory. */
export const updateProfileName = (name: string) =>
  apiRequest<{ user: { id: string; email: string; name: string } }>("/me", { method: "PATCH", body: JSON.stringify({ name }) });

/** Replaces the profile photo. `image` is a data: URL, already cropped and re-encoded. */
export const uploadProfilePhoto = (image: string) =>
  apiRequest<ProfilePhoto>("/me/avatar", { method: "PUT", body: JSON.stringify({ image }) });

/** Removes the photo. The UI falls back to initials. */
export const removeProfilePhoto = () => apiRequest<ProfilePhoto>("/me/avatar", { method: "DELETE" });

/** Changes the password, proving the current one. */
export const changePassword = (currentPassword: string, newPassword: string) =>
  apiRequest<{ ok: true }>("/me/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });

const ERROR_COPY: Record<string, string> = {
  not_an_image: "That file is not an image. Use a JPEG, PNG, GIF or WebP.",
  unsupported_image_type: "That image format is not supported. Use a JPEG, PNG, GIF or WebP.",
  image_unreadable: "That image could not be read. Try a different file.",
  file_too_large: "That file is too large. Pick an image under 10 MB.",
  image_too_large: "That image is too large once processed. Try a smaller one.",
  canvas_unavailable: "This browser could not process the image.",
  invalid_name: "Enter a name between 1 and 120 characters.",
  invalid_credentials: "That is not your current password.",
  weak_password: "Use at least 8 characters with an uppercase letter, a lowercase letter and a number.",
  password_unchanged: "The new password has to differ from the current one.",
  rate_limited: "Too many attempts. Wait a minute and try again.",
  unauthorized: "Your session has expired. Sign in again.",
};

/** Human-readable copy for anything these calls can fail with. */
export const profileErrorMessage = (error: unknown) => {
  const code = error instanceof Error ? error.message : String(error);
  return ERROR_COPY[code] ?? "Something went wrong. Please try again.";
};

/** Up to two initials for someone with no photo — the fallback that is never somebody else's face. */
export const initialsOf = (name: string, email = "") => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (email.trim()[0] ?? "?").toUpperCase();
};
