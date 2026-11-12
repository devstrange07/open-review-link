import type { Metadata, Viewport } from "next";
import { getBusinessSettings } from "@/lib/settings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  let name = "Feedback";
  try {
    const settings = await getBusinessSettings();
    if (settings) name = settings.name;
  } catch {
    // Env not configured yet (first run, or a build without secrets). A generic
    // title is better than a build failure.
  }

  return {
    title: {
      default: `${name} | Share your experience`,
      template: `%s | ${name}`,
    },
    description: "Share feedback about your visit or write a Google review.",
    applicationName: name,
    // The QR page is the canonical entry point; nothing here should be indexed
    // under a crawler-friendly "review us" keyword set.
    robots: { index: true, follow: true },
    formatDetection: { telephone: false, email: false, address: false },
    openGraph: {
      type: "website",
      title: `${name} | Share your experience`,
      description: "Share feedback about your visit or write a Google review.",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Not user-scalable=no: blocking pinch zoom is an accessibility failure.
  maximumScale: 5,
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen-safe antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
