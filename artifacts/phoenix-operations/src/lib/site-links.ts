/**
 * Links that leave the admin for the public site or the sign-in page.
 *
 * The admin shell runs inside wouter's nested `/admin` router, where a <Link>
 * resolves relative to /admin — so `<Link href="/">` there means the dashboard,
 * not the homepage. Links that cross that boundary are plain anchors built from
 * Vite's base URL instead. That is a full page load, which suits a public page
 * (and, on sign-out, drops every cached admin query along with the session).
 */
const basePath = () => import.meta.env.BASE_URL.replace(/\/$/, "");

/** A public page of the active workspace. The slug rides along so a partner admin previews their own site, not the default one. */
export const publicSiteHref = (path: string, workspaceSlug?: string) => {
  const url = `${basePath()}${path}`;
  if (!workspaceSlug) return url;
  return `${url}${path.includes("?") ? "&" : "?"}workspace=${encodeURIComponent(workspaceSlug)}`;
};

/** Where the admin sends a visitor who is not (or no longer) signed in. */
export const adminLoginHref = () => `${basePath()}/admin/login`;
