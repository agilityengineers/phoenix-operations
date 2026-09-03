import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import "./site.css";
import "./funnel.css";

const poppins = Poppins({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-poppins",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Phoenix Operations — Business Coaching for Founders",
    template: "%s · Phoenix Operations",
  },
  description:
    "You're working harder. Shouldn't this be getting easier? Phoenix Operations coaches founders and leadership teams to build stronger, healthier, more profitable businesses.",
  openGraph: {
    siteName: "Phoenix Operations",
    type: "website",
    url: siteUrl,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body>{children}</body>
    </html>
  );
}
