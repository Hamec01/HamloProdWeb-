import type { Metadata } from "next";
import { Bebas_Neue, IBM_Plex_Mono } from "next/font/google";
import { StickyPlayer } from "@/components/player/sticky-player";
import { getLocale } from "@/lib/i18n-server";
import "./globals.css";

const headingFont = Bebas_Neue({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: "400",
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "HamloProd",
  description: "Archive / case-file style music producer website for HamloProd.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${headingFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body className="min-h-full text-[var(--color-paper-100)]">
        {children}
        <StickyPlayer locale={locale} />
      </body>
    </html>
  );
}
