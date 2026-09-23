import type { Metadata } from "next";
import { JOURNAL_TITLE } from "@/lib/journal/config";

// Private: keep every journal page out of Google and other search engines.
export const metadata: Metadata = {
  title: JOURNAL_TITLE,
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function JournalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
