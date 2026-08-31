import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Disco Campaign Planner",
  description: "Ad placement and creative generation prototype for Disco's take-home exercise."
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
