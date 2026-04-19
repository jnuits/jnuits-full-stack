import type { Metadata } from "next";
import Script from "next/script";
import {
  Inter,
  JetBrains_Mono,
  Lora,
} from "next/font/google";
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

const themeInitScript = `
(() => {
  const storageKey = "jnuits-theme";
  const root = document.documentElement;
  const savedTheme = localStorage.getItem(storageKey);
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme = savedTheme === "dark" || savedTheme === "light"
    ? savedTheme
    : systemPrefersDark
      ? "dark"
      : "light";

  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.theme = resolvedTheme;
})();
`;

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
      className={`${bodyFont.variable} ${monoFont.variable} ${serifFont.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground flex flex-col">
        <Script id="jnuits-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
