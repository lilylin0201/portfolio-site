"use client";

import { useRef, useState, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  MdFormatBold,
  MdFormatItalic,
  MdFormatUnderlined,
  MdStrikethroughS,
  MdFormatAlignLeft,
  MdFormatAlignCenter,
  MdFormatAlignRight,
  MdFormatListBulleted,
  MdInsertPhoto,
  MdSmartDisplay,
} from "react-icons/md";
import { Popover } from "./Popover";
import { parseVideoUrl } from "@/lib/journal/media";
import { TEXT_STYLES, type TextStyleName } from "./extensions/TextStyles";

export function Toolbar({ editor, onPickFiles }: { editor: Editor; onPickFiles: (files: File[]) => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      style: (e.isActive("heading", { level: 2 })
        ? "heading"
        : e.isActive("heading", { level: 3 })
          ? "subheading"
          : e.isActive("paragraph", { kind: "description" })
            ? "description"
            : e.isActive("paragraph")
              ? "body"
              : null) as TextStyleName | null,
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      center: e.isActive({ textAlign: "center" }),
      right: e.isActive({ textAlign: "right" }),
      bullet: e.isActive("bulletList"),
    }),
  });
  const [videoOpen, setVideoOpen] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const applyStyle = (name: TextStyleName) => {
    const c = editor.chain().focus();
    if (name === "heading") c.setHeading({ level: 2 }).run();
    else if (name === "subheading") c.setHeading({ level: 3 }).run();
    else c.setParagraph().updateAttributes("paragraph", { kind: name === "description" ? "description" : null }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 text-sm">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Text style">
        {TEXT_STYLES.map(({ name, label }) => (
          <button
            key={name}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyStyle(name)}
            aria-pressed={s.style === name}
            className={`rounded-full border px-2.5 py-0.5 text-[13px] transition-colors ${
              s.style === name ? "border-primary bg-primary text-white" : "border-gray-300 hover:border-gray-500"
            } ${name === "heading" ? "font-bold" : name === "subheading" ? "font-semibold" : name === "description" ? "italic text-gray-500" : ""} ${
              s.style === name && name === "description" ? "!text-white" : ""
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <Sep />
      <Btn title="Bold (⌘B)" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <MdFormatBold />
      </Btn>
      <Btn title="Italic (⌘I)" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <MdFormatItalic />
      </Btn>
      <Btn title="Underline (⌘U)" active={s.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <MdFormatUnderlined />
      </Btn>
      <Btn title="Strikethrough" active={s.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <MdStrikethroughS />
      </Btn>
      <Sep />
      <Btn title="Align left" active={!s.center && !s.right} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        <MdFormatAlignLeft />
      </Btn>
      <Btn title="Center" active={s.center} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        <MdFormatAlignCenter />
      </Btn>
      <Btn title="Align right" active={s.right} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        <MdFormatAlignRight />
      </Btn>
      <Btn title="Bullet list" active={s.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <MdFormatListBulleted />
      </Btn>
      <Sep />
      <Btn title="Add photos (or drag them in)" onClick={() => photoInput.current?.click()}>
        <MdInsertPhoto />
      </Btn>
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          onPickFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <div className="relative">
        <Btn title="Add a video" onClick={() => setVideoOpen((o) => !o)}>
          <MdSmartDisplay />
        </Btn>
        <Popover open={videoOpen} onClose={() => setVideoOpen(false)} align="right" className="w-[min(24rem,85vw)]">
          <VideoForm
            editor={editor}
            onUpload={() => {
              setVideoOpen(false);
              videoInput.current?.click();
            }}
            onDone={() => setVideoOpen(false)}
          />
        </Popover>
      </div>
      <input
        ref={videoInput}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        hidden
        onChange={(e) => {
          onPickFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Btn({ children, title, onClick, active }: { children: ReactNode; title: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-8 w-7 items-center justify-center rounded-full text-[19px] transition-colors ${
        active ? "bg-[#e8e8ff] text-primary" : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-0.5 hidden h-5 w-px bg-gray-300 sm:block" />;
}

function VideoForm({ editor, onUpload, onDone }: { editor: Editor; onUpload: () => void; onDone: () => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const info = parseVideoUrl(url);
        if (!info) {
          setError("That link isn't a YouTube, Vimeo, Loom or Google Drive video.");
          return;
        }
        editor.chain().focus().insertVideo({ src: url.trim(), ...info }).run();
        onDone();
      }}
      className="flex flex-col gap-2"
    >
      <label className="font-medium">Add a video</label>
      <input
        autoFocus
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setError("");
        }}
        placeholder="Paste a YouTube, Vimeo, Loom or Drive link"
        className="rounded border border-gray-300 px-2 py-1.5 outline-none focus:border-primary"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onUpload} className="rounded px-2 py-1 text-primary hover:bg-[#f0f0ff]">
          Upload a clip instead
        </button>
        <button type="submit" className="rounded-full bg-primary px-4 py-1 font-medium text-white">
          Add
        </button>
      </div>
    </form>
  );
}
