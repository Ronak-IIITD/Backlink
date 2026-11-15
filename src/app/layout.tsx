import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "SEO Agent — A clearer path to better SEO",
  description:
    "Find website issues, review practical fixes, and track what improves with SEO Agent.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-paper font-sans text-slate-900 antialiased`}
      >
        <Suspense fallback={null}>
          <SmoothScroll />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
