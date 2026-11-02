import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "DevMemo",
    template: "%s · DevMemo",
  },
  description:
    "An open-source personal developer journal that tracks daily work, Git activity, and connects with AI assistants through MCP.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
