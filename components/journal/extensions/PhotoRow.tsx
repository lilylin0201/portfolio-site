"use client";

import { useState, type PointerEvent as ReactPointerEvent, type DragEvent as ReactDragEvent } from "react";
import { Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import type { EditorView } from "@tiptap/pm/view";
import { MdClose, MdViewAgenda, MdViewColumn, MdDeleteOutline, MdDragIndicator } from "react-icons/md";

/*
 * A row of one or two photos.
 * - Drag a photo onto another single photo to snap them side by side.
 * - Drag a photo out of a pair (or press "One per row") to split them.
 * - Drag the handle on the right edge to resize the row.
 */

export interface Photo {
  src: string;
  caption: string;
  ratio: number | null; // width / height, used to line pairs up at the same height
  uploadId?: string | null; // set only while uploading
}

export const PHOTO_MIME = "application/x-journal-photo";
export const DEFAULT_SINGLE_WIDTH = 70;
const MIN_WIDTH = 25;

export type DropTarget = { row: number; side: "left" | "right" } | { at: number };

export const PhotoRow = Node.create({
  name: "photoRow",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      photos: { default: [] as Photo[], rendered: false },
      width: { default: DEFAULT_SINGLE_WIDTH, rendered: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="photo-row"]',
        getAttrs: (el) => {
          const node = el as HTMLElement;
          const photos: Photo[] = Array.from(node.querySelectorAll("figure")).map((f) => ({
            src: f.querySelector("img")?.getAttribute("src") ?? "",
            caption: f.querySelector("figcaption")?.textContent ?? "",
            ratio: Number(f.getAttribute("data-ratio")) || null,
          }));
          return { photos: photos.filter((p) => p.src).slice(0, 2), width: Number(node.getAttribute("data-width")) || 100 };
        },
      },
      // A plain image, e.g. pasted from another website.
      {
        tag: "img[src]",
        getAttrs: (el) => ({
          photos: [{ src: (el as HTMLElement).getAttribute("src"), caption: "", ratio: null }],
          width: DEFAULT_SINGLE_WIDTH,
        }),
      },
    ];
  },

  renderHTML({ node }) {
    const photos = node.attrs.photos as Photo[];
    const width = node.attrs.width as number;
    return [
      "div",
      {
        "data-type": "photo-row",
        "data-width": String(width),
        class: `jrow jrow-${photos.length}`,
        style: `width:${width}%`,
      },
      ...photos.map((p) => [
        "figure",
        {
          class: "jphoto",
          "data-ratio": p.ratio ? String(p.ratio) : "",
          style: photos.length > 1 && p.ratio ? `flex:${p.ratio.toFixed(4)} 1 0%` : "",
        },
        ["img", { src: p.src, alt: p.caption || "", loading: "lazy" }],
        ...(p.caption ? [["figcaption", {}, p.caption]] : []),
      ]),
    ] as never;
  },

  addNodeView() {
    return ReactNodeViewRenderer(PhotoRowView);
  },
});

/* ---------------- moving photos around ---------------- */

export function findRowPos(view: EditorView, el: Element): number | null {
  let found: number | null = null;
  view.state.doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.type.name === "photoRow" && view.nodeDOM(pos)?.contains(el)) found = pos;
    return true;
  });
  return found;
}

// Where a dropped photo should land if it's not dropped on another photo:
// just before or after the paragraph/heading under the pointer.
export function blockDropPos(view: EditorView, x: number, y: number): number {
  const hit = view.posAtCoords({ left: x, top: y });
  const doc = view.state.doc;
  if (!hit) return doc.content.size;
  const $pos = doc.resolve(hit.pos);
  if ($pos.depth === 0) return hit.pos;
  const before = $pos.before(1);
  const dom = view.nodeDOM(before) as HTMLElement | null;
  if (dom?.getBoundingClientRect) {
    const r = dom.getBoundingClientRect();
    if (y < r.top + r.height / 2) return before;
  }
  return $pos.after(1);
}

export function movePhoto(view: EditorView, from: { row: number; index: number }, target: DropTarget) {
  const { state } = view;
  const src = state.doc.nodeAt(from.row);
  if (!src || src.type.name !== "photoRow") return;
  const photos = src.attrs.photos as Photo[];
  const photo = photos[from.index];
  if (!photo) return;

  // Dropped on its own row: swap the order of a pair.
  if ("row" in target && target.row === from.row) {
    if (photos.length !== 2) return;
    const other = photos[1 - from.index];
    const order = target.side === "left" ? [photo, other] : [other, photo];
    view.dispatch(state.tr.setNodeMarkup(from.row, undefined, { ...src.attrs, photos: order }));
    return;
  }
  if ("row" in target) {
    const tgt = state.doc.nodeAt(target.row);
    if (!tgt) return;
    // That row already has two photos: put this one on its own row just below.
    if ((tgt.attrs.photos as Photo[]).length >= 2) target = { at: target.row + tgt.nodeSize };
  }

  const tr = state.tr;
  const remaining = photos.filter((_, i) => i !== from.index);
  if (remaining.length) {
    tr.setNodeMarkup(from.row, undefined, { ...src.attrs, photos: remaining, width: DEFAULT_SINGLE_WIDTH });
  } else {
    tr.delete(from.row, from.row + src.nodeSize);
  }

  if ("row" in target) {
    const t = tr.mapping.map(target.row);
    const tgt = tr.doc.nodeAt(t)!;
    const tp = tgt.attrs.photos as Photo[];
    tr.setNodeMarkup(t, undefined, { ...tgt.attrs, photos: target.side === "left" ? [photo, ...tp] : [...tp, photo], width: 100 });
  } else {
    const at = tr.mapping.map(target.at);
    tr.insert(at, state.schema.nodes.photoRow.create({ photos: [photo], width: DEFAULT_SINGLE_WIDTH }));
  }
  view.dispatch(tr.scrollIntoView());
}

/* ---------------- how a row looks while editing ---------------- */

function PhotoRowView({ node, updateAttributes, deleteNode, selected, editor, getPos }: ReactNodeViewProps) {
  const photos = node.attrs.photos as Photo[];
  const width = node.attrs.width as number;
  const editable = editor.isEditable;
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const [dropSide, setDropSide] = useState<"left" | "right" | null>(null);
  const shown = liveWidth ?? width;

  const pos = () => (typeof getPos === "function" ? getPos() : undefined);

  const setPhoto = (i: number, patch: Partial<Photo>) =>
    updateAttributes({ photos: photos.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  const removePhoto = (i: number) => {
    if (photos.length === 1) deleteNode();
    else updateAttributes({ photos: photos.filter((_, j) => j !== i), width: DEFAULT_SINGLE_WIDTH });
  };

  const split = () => {
    const p = pos();
    if (typeof p !== "number" || photos.length !== 2) return;
    const tr = editor.state.tr;
    tr.setNodeMarkup(p, undefined, { ...node.attrs, photos: [photos[0]], width: DEFAULT_SINGLE_WIDTH });
    const after = p + tr.doc.nodeAt(p)!.nodeSize;
    tr.insert(after, editor.schema.nodes.photoRow.create({ photos: [photos[1]], width: DEFAULT_SINGLE_WIDTH }));
    editor.view.dispatch(tr);
  };

  const nextSingle = (() => {
    const p = pos();
    if (typeof p !== "number" || photos.length !== 1) return null;
    const next = editor.state.doc.nodeAt(p + node.nodeSize);
    return next?.type.name === "photoRow" && (next.attrs.photos as Photo[]).length === 1 ? next : null;
  })();

  const pairWithNext = () => {
    const p = pos();
    if (typeof p !== "number" || !nextSingle) return;
    const nextPos = p + node.nodeSize;
    const tr = editor.state.tr;
    tr.delete(nextPos, nextPos + nextSingle.nodeSize);
    tr.setNodeMarkup(p, undefined, { ...node.attrs, photos: [photos[0], (nextSingle.attrs.photos as Photo[])[0]], width: 100 });
    editor.view.dispatch(tr);
  };

  // Drag the right edge; the row stays centered, so it grows on both sides.
  const startResize = (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const row = (e.currentTarget as HTMLElement).parentElement; // the photo row
    const column = row?.parentElement?.parentElement; // the editor column
    if (!row || !column) return;
    const startX = e.clientX;
    const startPx = row.getBoundingClientRect().width;
    const columnPx = column.getBoundingClientRect().width;
    let latest = width;
    const move = (ev: PointerEvent) => {
      const px = startPx + 2 * (ev.clientX - startX);
      latest = Math.max(MIN_WIDTH, Math.min(100, Math.round(((px / columnPx) * 100) / 5) * 5));
      setLiveWidth(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setLiveWidth(null);
      if (latest !== width) updateAttributes({ width: latest });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const canAccept = (e: ReactDragEvent) => {
    const types = Array.from(e.dataTransfer.types);
    const isPhoto = types.includes(PHOTO_MIME);
    const isFile = types.includes("Files");
    if (!isPhoto && !isFile) return false;
    return photos.length < 2 || isPhoto; // a pair can still be reordered
  };

  return (
    <NodeViewWrapper
      data-type="photo-row"
      className={`jrow jrow-${photos.length} ${selected ? "is-selected" : ""} ${dropSide ? `drop-${dropSide}` : ""}`}
      style={{ width: `${shown}%` }}
      onDragOver={(e: ReactDragEvent) => {
        if (!editable || !canAccept(e)) return;
        e.preventDefault();
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setDropSide(e.clientX < r.left + r.width / 2 ? "left" : "right");
      }}
      onDragLeave={(e: ReactDragEvent) => {
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as globalThis.Node)) setDropSide(null);
      }}
      onDrop={() => setDropSide(null)}
    >
      {photos.map((p, i) => (
        <figure
          key={i}
          className="jphoto"
          style={photos.length > 1 && p.ratio ? { flex: `${p.ratio} 1 0%` } : undefined}
        >
          <div
            className="jphoto-media"
            draggable={editable && !p.uploadId}
            onDragStart={(e) => {
              const rowPos = pos();
              if (typeof rowPos !== "number") return;
              e.stopPropagation();
              e.dataTransfer.setData(PHOTO_MIME, JSON.stringify({ row: rowPos, index: i }));
              e.dataTransfer.effectAllowed = "move";
            }}
            title={editable ? "Drag onto another photo to put them side by side" : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.src}
              alt={p.caption}
              draggable={false}
              className={p.uploadId ? "opacity-50" : ""}
              onLoad={(e) => {
                const img = e.currentTarget;
                const ratio = img.naturalWidth && img.naturalHeight ? +(img.naturalWidth / img.naturalHeight).toFixed(4) : null;
                if (ratio && ratio !== p.ratio && editable) setPhoto(i, { ratio });
              }}
            />
            {p.uploadId && <div className="jupload-badge">Uploading…</div>}
            {editable && !p.uploadId && (
              <>
                <span className="jphoto-grip" aria-hidden>
                  <MdDragIndicator />
                </span>
                <button
                  type="button"
                  className="jphoto-remove"
                  title="Remove photo"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => removePhoto(i)}
                >
                  <MdClose />
                </button>
              </>
            )}
          </div>
          {editable ? (
            <input
              className="jcaption-input"
              value={p.caption}
              placeholder="Add a caption"
              onChange={(e) => setPhoto(i, { caption: e.target.value })}
            />
          ) : (
            p.caption && <figcaption>{p.caption}</figcaption>
          )}
        </figure>
      ))}

      {editable && (
        <>
          <div className="jrow-tools" contentEditable={false}>
            {photos.length === 2 && (
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={split}>
                <MdViewAgenda /> One per row
              </button>
            )}
            {nextSingle && (
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={pairWithNext}>
                <MdViewColumn /> Side by side with next
              </button>
            )}
            <button type="button" title="Delete" onMouseDown={(e) => e.preventDefault()} onClick={deleteNode}>
              <MdDeleteOutline />
            </button>
          </div>
          <div
            className="jrow-resize"
            title="Drag to resize"
            onPointerDown={startResize}
            onMouseDown={(e) => e.preventDefault()}
          />
          {liveWidth !== null && <div className="jrow-width-label">{liveWidth}%</div>}
        </>
      )}
    </NodeViewWrapper>
  );
}
