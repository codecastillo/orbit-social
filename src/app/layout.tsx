import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppToaster } from "@/components/layout/app-toaster";
import { Providers } from "@/providers/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Canonicals and absolute OG URLs need the production host; previews and
// local dev fall back to Next's automatic base. Set NEXT_PUBLIC_SITE_URL in
// the Vercel production environment.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: {
    default: "Orbit: The internet, but smaller",
    template: "%s | Orbit",
  },
  description:
    "A social platform built for people who are tired of shouting into the void. Feed, clips, rooms, live, and messages in one place.",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    siteName: "Orbit",
    type: "website",
    title: "Orbit: The internet, but smaller",
    description:
      "A social platform built for people who are tired of shouting into the void.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Orbit: The internet, but smaller",
    description:
      "A social platform built for people who are tired of shouting into the void.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
    { media: "(prefers-color-scheme: light)", color: "#f7f6f8" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // next-themes stamps the theme class on <html> before hydration, so React
    // must not diff that attribute.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          {children}
          <AppToaster />
        </Providers>
      </body>
    </html>
  );
}
