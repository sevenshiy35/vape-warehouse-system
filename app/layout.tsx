import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { FeedbackProvider } from "@/components/FeedbackProvider";
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
  title: "仓库拣货作业台",
  description: "截图录单、多库位库存、集中拣货与按单分货打包",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <FeedbackProvider>{children}</FeedbackProvider>
      </body>
    </html>
  );
}
