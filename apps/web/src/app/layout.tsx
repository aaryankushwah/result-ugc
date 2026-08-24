import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const resultFont = localFont({
  src: "../assets/Result-Font.woff2",
  variable: "--font-result",
  display: "swap",
  style: "italic",
  weight: "700",
});

export const metadata: Metadata = {
  title: "Result",
  description: "Result's workspace for UGC tracking, intelligence, and briefs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`light ${geistSans.variable} ${geistMono.variable} ${resultFont.variable} h-full antialiased`}
      data-theme="light"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Script id="result-theme" strategy="beforeInteractive">{`var t=null;try{t=localStorage.getItem("result-theme")}catch(e){}if(t!=="dark"&&t!=="light"){var m=document.cookie.match(/(?:^|; )result-theme=(light|dark)/);t=m?m[1]:"light"}var e=document.documentElement;e.classList.remove("dark","light");e.classList.add(t);e.dataset.theme=t`}</Script>
      </body>
    </html>
  );
}
