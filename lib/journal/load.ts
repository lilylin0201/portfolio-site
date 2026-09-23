import { isAuthed } from "./auth";
import { getWeek, listWeeks, mediaStorageMode } from "./store";
import type { StorageMode, Week, WeekMeta } from "./types";

export type JournalData = { weeks: WeekMeta[]; week: Week | null; canEdit: boolean; mediaMode: StorageMode };

// Anyone with the link can read. Editing needs the password (canEdit).
export async function loadJournal(id?: string): Promise<JournalData> {
  const canEdit = await isAuthed();
  const weeks = await listWeeks();
  const targetId = id ?? weeks[0]?.id;
  const full = targetId ? await getWeek(targetId) : null;
  // Readers only need the finished page, not the editor's copy.
  const week = full && !canEdit ? { ...full, doc: { type: "doc" as const } } : full;
  return { weeks, week, canEdit, mediaMode: mediaStorageMode() };
}
