"use client";

import { Link, useLocation } from "wouter";
import { useState } from "react";
import type { Workspace } from "@/lib/types";
import { publicWorkspaceSlug } from "@/lib/store/api";

// Sticky public-site nav. Anchor links only apply on the homepage.
export default function SiteNav({ variant = "full", workspace }: { variant?: "full" | "back"; workspace?: Workspace }) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const tenant = `?workspace=${encodeURIComponent(publicWorkspaceSlug())}`;

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    setOpen(false);
    if (location !== "/") return;
    
    e.preventDefault();
    const target = document.querySelector(hash);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="site-nav">
      <div className="site-nav-inner">
        <Link href={`/?workspace=${publicWorkspaceSlug()}`} aria-label={`${workspace?.name ?? "Phoenix Operations"} home`} style={{ display: "flex", ["--brand-primary" as string]: workspace?.brand.primaryColor }}>
          <img
            src={workspace?.brand.logoUrl || "/assets/logo.png"}
            alt={workspace?.name ?? "Phoenix Operations"}
            width={222}
            height={66}
            className="site-logo"
            style={{ width: "auto" }}
          />
        </Link>
        <button
          className="site-nav-toggle"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        {variant === "full" ? (
          <nav className={`site-nav-links${open ? " open" : ""}`} aria-label="Main">
            <Link href={`/${tenant}`} onClick={(e) => handleAnchorClick(e, "#approach")}>How It Works</Link>
            <Link href={`/${tenant}`} onClick={(e) => handleAnchorClick(e, "#who")}>Who We Help</Link>
            <Link href={`/${tenant}`} onClick={(e) => handleAnchorClick(e, "#results")}>Results</Link>
            <Link href={`/${tenant}`} onClick={(e) => handleAnchorClick(e, "#faq")}>FAQ</Link>
            <Link href={`/guide${tenant}`} onClick={() => setOpen(false)}>Your Guide</Link>
            <Link href={`/f/lack-of-control?workspace=${publicWorkspaceSlug()}`} className="cta" onClick={() => setOpen(false)}>
              Schedule a Call
            </Link>
          </nav>
        ) : (
          <nav className={`site-nav-links${open ? " open" : ""}`} aria-label="Main">
            <Link href={`/${tenant}`} onClick={() => setOpen(false)}>← Back to Site</Link>
            <Link href={`/f/lack-of-control?workspace=${publicWorkspaceSlug()}`} className="cta" onClick={() => setOpen(false)}>
              Schedule a Call
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
