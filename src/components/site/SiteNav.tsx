"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

// Sticky public-site nav. Anchor links only apply on the homepage, so we
// prefix them with "/" — Next keeps same-page anchors smooth via CSS.
export default function SiteNav({ variant = "full" }: { variant?: "full" | "back" }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-nav">
      <div className="site-nav-inner">
        <Link href="/" aria-label="Phoenix Operations home" style={{ display: "flex" }}>
          <Image
            src="/assets/logo.png"
            alt="Phoenix Operations"
            width={222}
            height={66}
            className="site-logo"
            priority
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
            <Link href="/#approach" onClick={() => setOpen(false)}>How It Works</Link>
            <Link href="/#who" onClick={() => setOpen(false)}>Who We Help</Link>
            <Link href="/#results" onClick={() => setOpen(false)}>Results</Link>
            <Link href="/#faq" onClick={() => setOpen(false)}>FAQ</Link>
            <Link href="/guide" onClick={() => setOpen(false)}>Your Guide</Link>
            <Link href="/f/lack-of-control" className="cta" onClick={() => setOpen(false)}>
              Schedule a Call
            </Link>
          </nav>
        ) : (
          <nav className={`site-nav-links${open ? " open" : ""}`} aria-label="Main">
            <Link href="/" onClick={() => setOpen(false)}>← Back to Site</Link>
            <Link href="/f/lack-of-control" className="cta" onClick={() => setOpen(false)}>
              Schedule a Call
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
