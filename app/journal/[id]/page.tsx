import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadJournal } from "@/lib/journal/load";
import { getWeek, setupProblems } from "@/lib/journal/store";
import { JournalReader } from "@/components/journal/JournalReader";
import { SetupNeeded } from "@/components/journal/SetupNeeded";
import { JOURNAL_TITLE } from "@/lib/journal/config";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const week = setupProblems().length ? null : await getWeek((await params).id);
  return { title: week ? `${week.title} · ${JOURNAL_TITLE}` : JOURNAL_TITLE };
}

export default async function JournalWeekPage({ params }: Props) {
  if (setupProblems().length) return <SetupNeeded />;
  const data = await loadJournal((await params).id);
  if (!data.week) notFound();
  return <JournalReader {...data} />;
}
