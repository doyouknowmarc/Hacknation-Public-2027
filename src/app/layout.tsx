import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = {
  title: "Sensei",
  description: "Learn the judgment behind expert work: capture it, confirm it, teach it.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="hanko" aria-hidden>
              先
            </span>
            Sensei
          </Link>
          <nav>
            <Link href="/story">Story</Link>
            <Link href="/studio">Live app</Link>
            <Link href="/capture">Capture</Link>
            <Link href="/teach">Teach</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
