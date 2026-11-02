import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "../styles/globals.css";

export const metadata: Metadata = {
  applicationName: "DevMemo",
  title: {
    default: "DevMemo",
    template: "%s · DevMemo",
  },
  description:
    "An open-source personal developer journal that tracks daily work, Git activity, and connects with AI assistants through MCP.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0e" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. ColorZilla, Grammarly,
    // password managers) inject attributes into <html>/<body> before React
    // hydrates. This only silences attribute mismatches on these two elements,
    // not in the rest of the tree.
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
