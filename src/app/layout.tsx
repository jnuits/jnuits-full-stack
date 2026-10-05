import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import {
  Inter,
  JetBrains_Mono,
  Lora,
} from "next/font/google";
import { brandProfile } from "@/lib/branding";
import { NonceProvider } from "@/components/security/nonce-provider";
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
