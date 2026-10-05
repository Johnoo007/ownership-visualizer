import type { Metadata } from "next";

// The full tool, for tracking a real portfolio. Kept out of search results —
// the public face of the project is the showcase at `/`.
export const metadata: Metadata = {
  title: "City of Ownership · App",
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return children;
}
