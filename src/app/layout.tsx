import type { Metadata } from "next";
import Script from "next/script";
import {
  Cormorant_Garamond,
  IBM_Plex_Mono,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";

const headingFont = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const serifFont = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const bodyFont = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
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
    default: "JnUITS Full Stack",
    template: "%s | JnUITS",
  },
  description:
    "Unified Next.js and Supabase platform for the JnUITS public website, member portal, certificate verification, and operator workflows.",
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
      className={`${headingFont.variable} ${bodyFont.variable} ${monoFont.variable} ${serifFont.variable} h-full antialiased`}
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
