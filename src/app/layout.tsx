import type { Metadata } from "next";
import {
  Inter,
  JetBrains_Mono,
  Lora,
  Noto_Sans_Bengali,
} from "next/font/google";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import { brandProfile } from "@/lib/branding";
import "./globals.css";

const bodyFont = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const monoFont = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const serifFont = Lora({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bengaliFont = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://jnuits.org.bd"),
  title: {
    default: `${brandProfile.fullName} (${brandProfile.shortName})`,
    template: `%s | ${brandProfile.shortName}`,
  },
  description:
    `${brandProfile.slogan}. ${brandProfile.fullName} is the non-profit university IT club of ${brandProfile.university}, based at ${brandProfile.address}.`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${bodyFont.variable} ${monoFont.variable} ${serifFont.variable} ${bengaliFont.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full bg-background text-foreground flex flex-col"
      >
        {children}
      </body>
    </html>
  );
}
