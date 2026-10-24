import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assembly Emulator",
  description: "A browser-local assembly editor, assembler, and educational CPU emulator with live registers, memory, and ISA v1 documentation.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
