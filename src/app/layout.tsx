import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { brandProfile } from "@/lib/branding";
import { NonceProvider } from "@/components/security/nonce-provider";
import { ThemeInitScript } from "@/components/theme/theme-init-script";
import "./globals.css";

// Bundled fonts keep builds independent of Google response formats and availability.
const bodyFont = localFont({
  src: "../assets/fonts/inter/Inter-Variable.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "400 800",
});

const monoFont = localFont({
  src: "../assets/fonts/jetbrainsmono/JetBrainsMono-Variable.woff2",
  variable: "--font-mono",
  display: "swap",
  weight: "400 600",
});

const serifFont = localFont({
  src: "../assets/fonts/lora/Lora-Variable.woff2",
  variable: "--font-serif",
  display: "swap",
  weight: "400 700",
  adjustFontFallback: "Times New Roman",
});

const bengaliFont = localFont({
  src: "../assets/fonts/noto-sans-bengali/NotoSansBengali-Variable.ttf",
  variable: "--font-bengali",
  display: "swap",
  weight: "100 900",
  fallback: ["Arial", "sans-serif"],
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme="light"
      data-scroll-behavior="smooth"
      className={`${bodyFont.variable} ${monoFont.variable} ${serifFont.variable} ${bengaliFont.variable} h-full antialiased`}
    >
      <head>
        <ThemeInitScript nonce={nonce} />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-full bg-background text-foreground flex flex-col"
      >
        <NonceProvider nonce={nonce}>
          {children}
        </NonceProvider>
      </body>
    </html>
  );
}
