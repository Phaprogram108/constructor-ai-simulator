import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

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

const siteUrl = "https://constructor-ai-simulator.vercel.app";

export const metadata: Metadata = {
  title: "PHA - Convertimos consultas en ventas para tu constructora",
  description: "IA + Publicidad + CRM. Un equipo dedicado que responde en menos de 60 segundos, califica leads y agenda reuniones. 24/7.",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: siteUrl,
    siteName: "PHA Notes",
    title: "PHA - Convertimos consultas en ventas para tu constructora",
    description: "IA + Publicidad + CRM. Un equipo dedicado que responde en menos de 60 segundos, califica leads y agenda reuniones. 24/7.",
  },
  twitter: {
    card: "summary_large_image",
    title: "PHA - Convertimos consultas en ventas para tu constructora",
    description: "IA + Publicidad + CRM. Un equipo dedicado que responde en menos de 60 segundos, califica leads y agenda reuniones. 24/7.",
  },
  metadataBase: new URL(siteUrl),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
