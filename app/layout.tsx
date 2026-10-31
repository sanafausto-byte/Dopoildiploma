import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dopo il diploma — Orienta il tuo prossimo passo",
  description: "Un’attività orientativa anonima per immaginare il futuro dopo il diploma.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="antialiased">{children}</body>
    </html>
  );
}
