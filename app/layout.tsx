import type { Metadata } from "next";
import {
  Caveat,
  Cinzel,
  Geist,
  Geist_Mono,
  Great_Vibes,
  Playfair_Display,
} from "next/font/google";
import "./globals.css";
import StudybookShell from "@/components/studybook-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const greatVibes = Great_Vibes({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-great-vibes",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
});

export const metadata: Metadata = {
  title: "Studybook",
  description:
    "Your personal student planner for class schedules, assignments, notes, and study goals.",
};

// Runs before the app hydrates so the right palette is on <html> for the first
// paint. Keep the storage key/shape in sync with StudybookProvider.
const themeScript = `
(function () {
  try {
    var raw = window.localStorage.getItem("studybook-data-v1");
    var saved = raw ? JSON.parse(raw) : null;
    var theme = saved
      ? (saved.theme === "dark" ? "dark" : "light")
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    var fonts = {
      geist: true,
      system: true,
      serif: true,
      mono: true,
      "great-vibes": true,
      playfair: true,
      caveat: true,
      cinzel: true
    };
    var font = saved && fonts[saved.font] ? saved.font : "geist";
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.font = font;
  } catch (error) {
    document.documentElement.dataset.theme = "light";
    document.documentElement.dataset.font = "geist";
  }
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${greatVibes.variable} ${playfair.variable} ${caveat.variable} ${cinzel.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <StudybookShell>{children}</StudybookShell>
      </body>
    </html>
  );
}
