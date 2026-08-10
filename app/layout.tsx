import type { Metadata } from "next";
import "./globals.css";

const assetPath = process.env.GITHUB_PAGES === "true" ? "/mainline-board" : "";

export const metadata: Metadata = {
  title: "主线看板",
  description: "随时知道自己在哪里、要去哪里。",
  manifest: `${assetPath}/manifest.webmanifest`,
  icons: {
    icon: [{ url: `${assetPath}/icon-192.png`, sizes: "192x192", type: "image/png" }],
    shortcut: `${assetPath}/icon-192.png`,
    apple: [{ url: `${assetPath}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
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
