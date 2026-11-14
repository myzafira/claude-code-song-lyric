import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ร้องเพลงกัน – เนื้อเพลงตัวใหญ่ อ่านง่าย",
  description: "ค้นหาเนื้อเพลง ต่อคิว แล้วเปิดภาพเนื้อเพลงตัวใหญ่ร้องตามได้ทันที",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
