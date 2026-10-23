import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assembly Emulator — Editor Workspace",
  description: "A browser-local assembly source editor with an ISA v1 reference. Assembly and execution are not implemented yet.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
