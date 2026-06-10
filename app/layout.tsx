import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Musk OS Chat",
  description: "A first-principles AI chat powered by Zhipu GLM."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
