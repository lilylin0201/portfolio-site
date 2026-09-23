import type { JournalDoc } from "./types";
import { addDays, parseISODate, shortDate } from "./dates";

// What a brand-new entry starts with. Edit freely: this is plain Tiptap JSON.
export function newEntryTemplate(startISO: string): JournalDoc {
  const heading = (level: 2 | 3, text: string) => ({
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  });
  const emptyBullets = { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] };
  const start = parseISODate(startISO);
  const days = Array.from({ length: 7 }, (_, i) => [
    heading(3, shortDate(addDays(start, i))),
    { type: "paragraph" },
  ]).flat();

  return {
    type: "doc",
    content: [
      heading(2, "Main Achievements:"),
      emptyBullets,
      heading(2, "To-do:"),
      emptyBullets,
      { type: "horizontalRule" },
      ...days,
    ],
  };
}
