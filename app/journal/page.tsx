import { loadJournal } from "@/lib/journal/load";
import { setupProblems } from "@/lib/journal/store";
import { JournalReader } from "@/components/journal/JournalReader";
import { SetupNeeded } from "@/components/journal/SetupNeeded";

export const dynamic = "force-dynamic";

// /journal opens your latest entry. /journal?new=1 opens a new entry.
export default async function JournalPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  if (setupProblems().length) return <SetupNeeded />;
  const data = await loadJournal();
  return <JournalReader {...data} startNew={(await searchParams).new === "1"} />;
}
