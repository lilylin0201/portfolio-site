"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MdAdd, MdEdit } from "react-icons/md";
import dynamic from "next/dynamic";
import { PasswordDialog } from "./PasswordDialog";
import type { StorageMode, Week, WeekMeta } from "@/lib/journal/types";
import { startOfWeek, suggestNextWeek, toISODate } from "@/lib/journal/dates";

// The editor only downloads when you press New entry or Edit, so visitors get a light page.
const EntryEditor = dynamic(() => import("./EntryEditor").then((m) => m.EntryEditor), {
  ssr: false,
  loading: () => <p className="py-10 text-gray-500">Opening editor…</p>,
});

type Mode = "view" | "edit" | "new";

export function JournalShell({
  weeks,
  week,
  canEdit,
  mediaMode,
  startNew,
}: {
  weeks: WeekMeta[];
  week: Week | null;
  canEdit: boolean;
  mediaMode: StorageMode;
  startNew?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(canEdit && startNew ? "new" : "view");
  const [askFor, setAskFor] = useState<null | "edit" | "new">(!canEdit && startNew ? "new" : null);
  const [pending, setPending] = useState<null | "edit" | "new">(null);
  const dirtyRef = useRef(false);

  // Editing needs the password. Once it's accepted, the page reloads its data and opens the editor.
  const requestMode = (next: "edit" | "new") => {
    if (canEdit) setMode(next);
    else setAskFor(next);
  };
  useEffect(() => {
    if (canEdit && pending) {
      setMode(pending);
      setPending(null);
    }
  }, [canEdit, pending]);

  // New entries default to this week, or the week after your latest one if this week is done.
  const suggestedStart = useMemo(() => {
    const thisWeek = toISODate(startOfWeek(new Date()));
    return weeks.some((w) => w.id === thisWeek) ? suggestNextWeek(weeks.map((w) => w.startDate)) : thisWeek;
  }, [weeks]);

  const index = week ? weeks.findIndex((w) => w.id === week.id) : -1;
  const newer = index > 0 ? weeks[index - 1] : null;
  const older = index >= 0 && index < weeks.length - 1 ? weeks[index + 1] : null;

  const guard = (e: MouseEvent) => {
    if (mode !== "view" && dirtyRef.current && !confirm("Leave without saving?")) {
      e.preventDefault();
      return;
    }
    dirtyRef.current = false;
    setMode("view");
  };

  const startNewEntry = () => {
    if (mode !== "view" && dirtyRef.current && !confirm("Leave without saving?")) return;
    requestMode("new");
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="md:flex md:gap-16">
      {/* Week tabs */}
      <nav aria-label="Weeks" className="mb-8 md:mb-0 md:w-56 md:shrink-0">
        <div className="hide-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 md:sticky md:top-40 md:mx-0 md:flex-col md:gap-1 md:overflow-visible md:px-0">
          <button
              onClick={startNewEntry}
              className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-primary px-4 py-2 text-[15px] md:mb-3 ${
                mode === "new" ? "bg-primary text-white" : "text-primary hover:bg-[#f0f0ff]"
              }`}
            >
              <MdAdd className="text-lg" /> New entry
            </button>
          {weeks.map((w) => {
            const active = mode !== "new" && w.id === week?.id;
            return (
              <Link
                key={w.id}
                href={`/journal/${w.id}`}
                onClick={guard}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[15px] transition-colors ${
                  active ? "bg-[#e8e8ff] font-medium text-primary" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {w.title}
              </Link>
            );
          })}
          {canEdit && (
            <form action="/api/journal/logout" method="post" className="hidden md:mt-6 md:block">
              <button
                type="submit"
                onClick={(e) => {
                  if (mode !== "view" && dirtyRef.current && !confirm("Log out without saving?")) e.preventDefault();
                }}
                className="px-4 text-sm text-gray-400 hover:text-gray-600"
              >
                Log out
              </button>
            </form>
          )}
        </div>
      </nav>

      <article className="min-w-0 max-w-3xl flex-1">
        {mode === "new" ? (
          <EntryEditor
            key="new"
            week={null}
            suggestedStart={suggestedStart}
            existingIds={weeks.map((w) => w.id)}
            mediaMode={mediaMode}
            dirtyRef={dirtyRef}
            onSaved={(id) => {
              setMode("view");
              router.push(`/journal/${id}`);
              router.refresh();
            }}
            onCancel={() => setMode("view")}
            onDeleted={() => setMode("view")}
          />
        ) : mode === "edit" && week ? (
          <EntryEditor
            key={`edit-${week.id}`}
            week={week}
            suggestedStart={suggestedStart}
            existingIds={weeks.map((w) => w.id)}
            mediaMode={mediaMode}
            dirtyRef={dirtyRef}
            onSaved={() => {
              setMode("view");
              router.refresh();
            }}
            onCancel={() => setMode("view")}
            onDeleted={() => {
              setMode("view");
              router.push("/journal");
              router.refresh();
            }}
          />
        ) : week ? (
          <>
            <div className="relative">
              <h2 className="journal-title mb-8 text-center md:px-20">{week.title}</h2>
              <button
                  onClick={() => requestMode("edit")}
                  className="mx-auto -mt-4 mb-8 flex items-center gap-1 rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-700 hover:border-primary hover:text-primary md:absolute md:right-0 md:top-0 md:m-0"
                >
                  <MdEdit /> Edit
                </button>
            </div>
            <div className="journal-content" dangerouslySetInnerHTML={{ __html: week.html }} />

            <div className="mt-16 flex justify-between gap-4 border-t pt-6 text-sm">
              {older ? (
                <Link href={`/journal/${older.id}`} className="text-gray-600 hover:text-primary">
                  ← {older.title}
                </Link>
              ) : (
                <span />
              )}
              {newer && (
                <Link href={`/journal/${newer.id}`} className="text-right text-gray-600 hover:text-primary">
                  {newer.title} →
                </Link>
              )}
            </div>
          </>
        ) : (
          <div className="py-10 text-gray-500">
            <button onClick={startNewEntry} className="rounded-full bg-primary px-5 py-2 text-white">
              Write the first entry
            </button>
          </div>
        )}
      </article>

      {askFor && (
        <PasswordDialog
          action={askFor === "new" ? "add an entry" : "edit this entry"}
          onClose={() => setAskFor(null)}
          onSuccess={() => {
            setPending(askFor);
            setAskFor(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
