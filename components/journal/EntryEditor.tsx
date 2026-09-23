"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { EditorContent, useEditor, Extension, type Editor, type JSONContent } from "@tiptap/react";
import { Plugin } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extensions";
import { PhotoRow, PHOTO_MIME, findRowPos, blockDropPos, movePhoto, type DropTarget } from "./extensions/PhotoRow";
import { Video } from "./extensions/Video";
import { DescriptionText } from "./extensions/TextStyles";
import { Toolbar } from "./Toolbar";
import { hasPendingUploads, insertFiles } from "./upload";
import type { StorageMode, Week } from "@/lib/journal/types";
import { newEntryTemplate } from "@/lib/journal/template";
import { parseISODate, startOfWeek, toISODate, weekTitle } from "@/lib/journal/dates";

type Props = {
  week: Week | null; // null = a brand-new entry
  suggestedStart: string;
  existingIds: string[];
  mediaMode: StorageMode;
  dirtyRef: MutableRefObject<boolean>;
  onSaved: (id: string) => void;
  onCancel: () => void;
  onDeleted: () => void;
};

// Handles photos dragged in from your computer, photos dragged between rows, and pasted screenshots.
function dropExtension(onFiles: (files: File[], target?: DropTarget) => void) {
  return Extension.create({
    name: "journalDrop",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            handleDrop: (view, event) => {
              const dt = (event as DragEvent).dataTransfer;
              if (!dt) return false;
              const moving = dt.getData(PHOTO_MIME);
              const files = Array.from(dt.files ?? []);
              if (!moving && !files.length) return false;
              event.preventDefault();
              const { clientX: x, clientY: y } = event as DragEvent;
              const rowEl = (event.target as Element | null)?.closest?.('[data-type="photo-row"]');
              let target: DropTarget = { at: blockDropPos(view, x, y) };
              if (rowEl) {
                const row = findRowPos(view, rowEl);
                const r = rowEl.getBoundingClientRect();
                if (row !== null) target = { row, side: x < r.left + r.width / 2 ? "left" : "right" };
              }
              if (moving) movePhoto(view, JSON.parse(moving), target);
              else onFiles(files, target);
              return true;
            },
            handlePaste: (_view, event) => {
              const files = Array.from(event.clipboardData?.files ?? []).filter((f) => /^(image|video)\//.test(f.type));
              if (!files.length) return false;
              event.preventDefault();
              onFiles(files);
              return true;
            },
          },
        }),
      ];
    },
  });
}

const backupKey = (id: string) => `lily-journal-backup:${id}`;

export function EntryEditor({ week, suggestedStart, existingIds, mediaMode, dirtyRef, onSaved, onCancel, onDeleted }: Props) {
  const isNew = !week;
  const [startDate, setStartDate] = useState(week?.startDate ?? suggestedStart);
  const [title, setTitle] = useState(week?.title ?? weekTitle(suggestedStart));
  const [titleEdited, setTitleEdited] = useState(false);
  const [dirty, setDirtyState] = useState(isNew);
  const [busy, setBusy] = useState<null | "saving" | "deleting">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [backup, setBackup] = useState<{ title: string; doc: JSONContent; at: string } | null>(null);
  const touched = useRef(false); // has the text been changed by hand?
  const uploaded = useRef<string[]>([]);
  const editorRef = useRef<Editor | null>(null);
  const weekId = week?.id ?? startDate;
  const key = backupKey(week?.id ?? "new");
  const taken = isNew && existingIds.includes(startDate);

  const setDirty = useCallback(
    (v: boolean) => {
      dirtyRef.current = v;
      setDirtyState(v);
    },
    [dirtyRef],
  );

  const toast = useCallback((m: string) => setMessage(m), []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(t);
  }, [message]);

  const onFiles = (files: File[], target?: DropTarget) => {
    const ed = editorRef.current;
    if (!ed) return;
    insertFiles(ed, files, {
      weekId,
      mode: mediaMode,
      target,
      onError: toast,
      onUploaded: (url) => uploaded.current.push(url),
    });
  };
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;

  // Keeps a copy in this browser while you type, in case the tab closes before you save.
  const backupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef(title);
  titleRef.current = title;
  const writeBackup = () => {
    if (backupTimer.current) clearTimeout(backupTimer.current);
    backupTimer.current = setTimeout(() => {
      const ed = editorRef.current;
      if (!ed) return;
      try {
        localStorage.setItem(key, JSON.stringify({ title: titleRef.current, doc: ed.getJSON(), at: new Date().toISOString() }));
      } catch {}
    }, 800);
  };
  const clearBackup = () => {
    if (backupTimer.current) clearTimeout(backupTimer.current);
    try {
      localStorage.removeItem(key);
    } catch {}
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        blockquote: false,
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      DescriptionText,
      Placeholder.configure({
        placeholder: ({ node }) => (node.type.name === "heading" ? "Heading" : "Write here, or drag in photos"),
      }),
      PhotoRow,
      Video,
      dropExtension((files, target) => onFilesRef.current(files, target)),
    ],
    content: (week?.doc ?? newEntryTemplate(suggestedStart)) as JSONContent,
    editorProps: { attributes: { class: "journal-content journal-editing outline-none", spellcheck: "true" } },
    onUpdate: () => {
      touched.current = true;
      setDirty(true);
      writeBackup();
    },
  });
  editorRef.current = editor;

  // Offer to bring back unsaved writing from last time.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setBackup(JSON.parse(raw));
    } catch {}
  }, [key]);

  useEffect(() => {
    dirtyRef.current = isNew;
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      dirtyRef.current = false;
    };
  }, [dirtyRef, isNew]);

  const save = async () => {
    const ed = editorRef.current;
    if (!ed || busy) return;
    if (taken) return toast("There's already an entry for that week. Pick another week.");
    if (hasPendingUploads(ed)) return toast("Hang on, a photo is still uploading.");
    setBusy("saving");
    try {
      const body = JSON.stringify({ startDate, title, doc: ed.getJSON(), html: ed.getHTML() });
      const res = await fetch(isNew ? "/api/journal/weeks" : `/api/journal/weeks/${week!.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save. Check your connection and try again.");
      clearBackup();
      discard(data.id); // photos uploaded but then removed before saving
      setDirty(false);
      onSaved(data.id);
    } catch (e) {
      toast((e as Error).message);
      setBusy(null);
    }
  };
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const discard = (id: string) => {
    if (!uploaded.current.length) return;
    fetch("/api/journal/discard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekId: id, urls: uploaded.current }),
      keepalive: true,
    }).catch(() => {});
    uploaded.current = [];
  };

  const cancel = () => {
    if (dirty && touched.current && !confirm("Throw away your changes?")) return;
    clearBackup();
    discard(week?.id ?? "");
    setDirty(false);
    onCancel();
  };

  const remove = async () => {
    if (!week || !confirm(`Delete "${week.title}"? Its photos and uploaded videos will be deleted too.`)) return;
    setBusy("deleting");
    const res = await fetch(`/api/journal/weeks/${week.id}`, { method: "DELETE" });
    if (!res.ok) {
      setBusy(null);
      return toast("Couldn't delete this entry.");
    }
    clearBackup();
    setDirty(false);
    onDeleted();
  };

  const changeWeek = (value: string) => {
    if (!value) return;
    const start = toISODate(startOfWeek(parseISODate(value)));
    setStartDate(start);
    if (!titleEdited) setTitle(weekTitle(start));
    // Nothing typed yet? Refresh the template so the dates match.
    if (!touched.current && editor) editor.commands.setContent(newEntryTemplate(start) as JSONContent, { emitUpdate: false });
  };

  return (
    <div>
      {/* Toolbar + Save stay visible while you scroll */}
      <div className="sticky top-[60px] z-30 -mx-2 mb-8 rounded-2xl border border-gray-200 bg-white px-2 py-1.5 shadow-sm md:top-[104px] xl:-mr-16">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {editor && <Toolbar editor={editor} onPickFiles={(files) => onFiles(files)} />}
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={cancel} className="rounded-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!!busy || taken}
              className="rounded-full bg-primary px-5 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy === "saving" ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {backup && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg bg-[#f0f0ff] px-4 py-3 text-sm">
          <span className="flex-1">
            You have unsaved writing from {new Date(backup.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}.
          </span>
          <button
            className="font-medium text-primary"
            onClick={() => {
              editor?.commands.setContent(backup.doc, { emitUpdate: true });
              setTitle(backup.title);
              setTitleEdited(true);
              setBackup(null);
            }}
          >
            Bring it back
          </button>
          <button
            className="text-gray-600"
            onClick={() => {
              clearBackup();
              setBackup(null);
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setTitleEdited(true);
          setDirty(true);
          touched.current = true;
          writeBackup();
        }}
        aria-label="Entry title"
        placeholder="Title"
        className="journal-title mb-2 w-full bg-transparent text-center outline-none"
      />
      {isNew && (
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2 text-sm text-gray-500">
          <label htmlFor="week-start">Week of</label>
          <input
            id="week-start"
            type="date"
            value={startDate}
            onChange={(e) => changeWeek(e.target.value)}
            className="rounded border border-gray-300 px-2 py-0.5 text-gray-700"
          />
          {taken && <span className="text-red-600">already has an entry</span>}
        </div>
      )}
      {!isNew && <div className="mb-8" />}

      <EditorContent editor={editor} />

      {!isNew && (
        <div className="mt-16 border-t pt-6 text-right">
          <button onClick={remove} disabled={!!busy} className="text-sm text-red-600 hover:underline disabled:opacity-50">
            {busy === "deleting" ? "Deleting…" : "Delete this entry"}
          </button>
        </div>
      )}

      {message && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-lg bg-[#222] px-4 py-3 text-sm text-white shadow-lg"
        >
          {message}
        </div>
      )}
    </div>
  );
}
