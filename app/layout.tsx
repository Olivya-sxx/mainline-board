import type { Metadata } from "next";
import "./globals.css";

const assetPath = process.env.GITHUB_PAGES === "true" ? "/mainline-board" : "";

export const metadata: Metadata = {
  title: "主线看板",
  description: "随时知道自己在哪里、要去哪里。",
  icons: {
    icon: `${assetPath}/mainline-board-icon.png`,
    shortcut: `${assetPath}/mainline-board-icon.png`,
    apple: `${assetPath}/mainline-board-icon.png`,
  },
  appleWebApp: {
    capable: true,
    title: "主线看板",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
