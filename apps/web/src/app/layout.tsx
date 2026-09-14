import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { dictionary } from "@/i18n";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: dictionary.app.title,
  description: dictionary.app.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={dictionary.locale} className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
