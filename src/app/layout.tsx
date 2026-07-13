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

export const metadata: Metadata = {
  title: {
    default: "Orbit: Social Network",
    template: "%s | Orbit",
  },
  description:
    "Connect, share, and discover. The next generation social platform.",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#141312" },
    { media: "(prefers-color-scheme: light)", color: "#f9f8f6" },
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
