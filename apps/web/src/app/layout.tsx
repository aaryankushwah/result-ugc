import type { Metadata } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import "./script-pipeline.css";
import "./interaction-states.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Companion face for the "UGC" mark in the Result lockup. There is no
// "Archivo Expanded" family in next/font; Archivo is variable with a width axis,
// so pull in `wdth` and dial it to the expanded end in .result-ugc-mark.
const archivoExpanded = Archivo({
  variable: "--font-archivo-expanded",
  subsets: ["latin"],
  axes: ["wdth"],
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
      className={`light ${geistSans.variable} ${geistMono.variable} ${archivoExpanded.variable} ${resultFont.variable} h-full antialiased`}
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        <script
          type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: `var t=null;try{t=localStorage.getItem("result-theme")}catch(e){}if(t!=="dark"&&t!=="light"){var m=document.cookie.match(/(?:^|; )result-theme=(light|dark)/);t=m?m[1]:"light"}var e=document.documentElement;e.classList.remove("dark","light");e.classList.add(t);e.dataset.theme=t` }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
