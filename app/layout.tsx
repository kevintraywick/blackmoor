import type { Metadata } from "next";
import { Geist, Geist_Mono, EB_Garamond } from "next/font/google";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ebGaramond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    await ensureSchema();
    const [campaign] = await query<{ description: string }>('SELECT description FROM campaign LIMIT 1');
    return {
      title: "Shadow of the Wolf",
      description: campaign?.description || "Campaign management for Shadow of the Wolf",
    };
  } catch {
    return {
      title: "Shadow of the Wolf",
      description: "Campaign management for Shadow of the Wolf",
    };
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${ebGaramond.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
        <footer
          style={{
            padding: '24px 20px 32px',
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: '#5a4f46',
            textAlign: 'center',
            borderTop: '1px solid #231f1c',
            marginTop: 40,
          }}
        >
          © 2026 Grey Assassins Guild, LLC
        </footer>
      </body>
    </html>
  );
}
