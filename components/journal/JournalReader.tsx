import Navbar from "@/components/NavBar";
import Footer from "@/components/Footer";
import { JournalShell } from "./JournalShell";
import type { StorageMode, Week, WeekMeta } from "@/lib/journal/types";
import { JOURNAL_SUBTITLE, JOURNAL_TITLE } from "@/lib/journal/config";

// The journal. Anyone with the link can read; Edit and New entry ask for the password.
export function JournalReader(props: {
  weeks: WeekMeta[];
  week: Week | null;
  canEdit: boolean;
  mediaMode: StorageMode;
  startNew?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1 px-6 pb-20 pt-24 md:px-20 md:pt-40">
        <header className="mb-8 md:mb-12">
          <h1 className="text-xl font-medium md:text-3xl">{JOURNAL_TITLE}</h1>
          <p className="mt-1 text-gray-600">{JOURNAL_SUBTITLE}</p>
        </header>
        <JournalShell {...props} />
      </div>
      <div className="px-6 md:px-0">
        <Footer />
      </div>
    </div>
  );
}
