import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppearanceProvider } from "@/components/fleet/AppearanceProvider";
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
  title: "Fleet enterprise",
  description: "Fleet management MVP (Next.js + NestJS)",
};

/** Anti-FOUC: aplică data-theme din localStorage înainte de paint. */
const appearanceBootScript = `(function(){try{var k='fleet-appearance-v1';var raw=localStorage.getItem(k);var p=raw?JSON.parse(raw):{};var t=p.theme||'dark';if(t==='system'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}var root=document.documentElement;root.setAttribute('data-theme',t);root.setAttribute('data-density',p.density==='compact'?'compact':'comfortable');if(p.reduceMotion)root.setAttribute('data-reduce-motion','1');root.style.colorScheme=t;}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ro"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceBootScript }} />
      </head>
      <body className="flex min-h-full min-h-dvh flex-col bg-background text-foreground">
        <AppearanceProvider>{children}</AppearanceProvider>
      </body>
    </html>
  );
}
