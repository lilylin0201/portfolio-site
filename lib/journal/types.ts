// A Tiptap/ProseMirror document, stored as plain JSON.
export type JournalDoc = {
  type: "doc";
  content?: unknown[];
};

export interface WeekMeta {
  id: string; // the week's start date, e.g. "2026-09-21"
  title: string; // e.g. "Week 9/21-9/27"
  startDate: string; // ISO date (yyyy-mm-dd)
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Week extends WeekMeta {
  doc: JournalDoc; // what the editor loads
  html: string; // what the public page shows
}

export type StorageMode = "cloud" | "presigned" | "local";
