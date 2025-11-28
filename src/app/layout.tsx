import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UnDoc - Undo the Docs",
  description: "Transform complex documentation into structured, readable, and actionable pages",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
