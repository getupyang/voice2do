import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voice2Do",
  description: "用声音记录生活中的每一个灵感",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
