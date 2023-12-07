// CSS - Fonts
import "../globals.css";

// Clerk
import { ClerkProvider } from "@clerk/nextjs";
import { trTR } from "@clerk/localizations";

export const metadata = {
  title: "Eru Social Web",
  description: "Erciyes University Social Web",
  icons: {
    icon: "/assets/logo.svg",
  },
  creator: "Burak Boduroglu",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider localization={trTR}>
      <html lang="en">
        <link rel="icon" href="../favicon.ico" sizes="any" />
        <body className={` bg-dark-1`}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
