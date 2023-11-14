// CSS - Fonts
import "../globals.css";
import { Inter } from "next/font/google";

// Clerk
import { ClerkProvider } from "@clerk/nextjs";
import { trTR } from "@clerk/localizations";

import { Analytics } from "@vercel/analytics/react";

export const metadata = {
  title: "Eru Social Web",
  description: "Erciyes University Social Web",
  icons: {
    icon: "/assets/logo.svg",
  },
  creator: "Burak Boduroglu",
};

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider localization={trTR}>
      <html lang="en">
        <link rel="icon" href="../favicon.ico" sizes="any" />
        <body className={`${inter.className} bg-dark-1`}>
          {children}
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
