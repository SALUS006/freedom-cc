import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterSW } from "./register-sw";

export const metadata: Metadata = {
  title: "Freedom CC",
  description: "Club cricket: match days, team selection and ball-by-ball scoring.",
  manifest: "/manifest.webmanifest",
  applicationName: "Freedom CC",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Freedom CC",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f3d68",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app">{children}</div>
        <RegisterSW />
      </body>
    </html>
  );
}
