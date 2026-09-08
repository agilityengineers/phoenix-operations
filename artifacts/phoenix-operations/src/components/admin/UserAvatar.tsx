import { useEffect, useState } from "react";
import { initialsOf } from "@/lib/profile";

// One person's face, everywhere a person is shown. The fallback is their own
// initials — never a stand-in photograph, and never the workspace's guide photo,
// which is the brand's face on the public site rather than anybody's account.

export default function UserAvatar({
  name,
  email = "",
  src,
  size = 34,
  className = "",
}: {
  name: string;
  email?: string;
  /** The account's photo URL, or null/undefined when it has none. */
  src?: string | null;
  size?: number;
  className?: string;
}) {
  // A photo that 404s (removed on another device, or a stale cached URL) falls
  // back to initials instead of the browser's broken-image glyph.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (!src || failed) {
    return (
      <span className={`user-avatar fallback ${className}`} style={style} aria-hidden="true">
        {initialsOf(name, email)}
      </span>
    );
  }
  return (
    <img
      className={`user-avatar ${className}`}
      style={style}
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
    />
  );
}
