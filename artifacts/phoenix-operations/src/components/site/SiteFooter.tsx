import { Link } from "wouter";
import type { Workspace } from "@/lib/types";
import { publicWorkspaceSlug } from "@/lib/store/api";

type Props = {
  variant?: "home" | "guide" | "results";
  workspace?: Workspace;
};

export default function SiteFooter({ variant = "home", workspace }: Props) {
  const tenant = `?workspace=${encodeURIComponent(publicWorkspaceSlug())}`;
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <img src={workspace?.brand.markUrl || "/assets/mark.png"} alt="" width={44} height={44} style={{ height: 44, width: "auto" }} />
          <span className="footer-wordmark">
            {workspace?.name ?? "PHOENIX OPERATIONS"}
          </span>
        </div>
        {variant === "home" && (
          <div className="footer-cta-copy">
            <p className="lead">Ready to Take the First Step?</p>
            <p className="sub">Let&apos;s have a real conversation about what&apos;s getting in your way.</p>
          </div>
        )}
        {variant === "guide" && (
          <p className="footer-tagline">
            Let&apos;s talk about what&apos;s keeping you up at night—and where to start.
          </p>
        )}
        {variant === "results" && (
          <p className="footer-note">
            Want to know what these tools would change in your business? That&apos;s a 15-minute
            conversation.
          </p>
        )}
        <Link href={`/f/lack-of-control?workspace=${publicWorkspaceSlug()}`} className="btn-primary on-dark">
          {variant === "results" ? "Schedule a Conversation" : "Schedule a 15-Minute Conversation"}{" "}
          <span className="arrow">→</span>
        </Link>
      </div>
      <div className="site-footer-bar">
        <div className="site-footer-bar-inner">
          <span>
            © 2026 {workspace?.name ?? "Phoenix Operations"}. All rights reserved.
            {variant === "results" &&
              " EOS® and the Entrepreneurial Operating System® are registered trademarks of EOS Worldwide."}
          </span>
          <div className="site-footer-links">
            <Link href={`/guide${tenant}`}>Your Guide</Link>
            <Link href={`/legal/privacy${tenant}`}>Privacy</Link>
            <Link href={`/legal/terms${tenant}`}>Terms</Link>
            <Link href="/admin">Admin</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
