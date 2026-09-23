"use client";

import { upload, uploadPresigned } from "@vercel/blob/client";
import type { Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { ALLOWED_MEDIA_TYPES, MAX_UPLOAD_BYTES } from "@/lib/journal/media";
import type { StorageMode } from "@/lib/journal/types";
import { DEFAULT_SINGLE_WIDTH, type DropTarget, type Photo } from "./extensions/PhotoRow";

const MAX_IMAGE_SIDE = 2400; // plenty for a full-width photo on a big screen
const JPEG_QUALITY = 0.85;

// Phone photos are often 4-8 MB. Shrinking them first keeps you far from the 1 GB limit.
async function prepareImage(file: File): Promise<{ file: File; ratio: number | null }> {
  if (!file.type.startsWith("image/")) return { file, ratio: null };
  try {
    const bitmap = await createImageBitmap(file);
    const ratio = +(bitmap.width / bitmap.height).toFixed(4);
    if (file.type === "image/gif") return { file, ratio };
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    const keepPng = file.type === "image/png" && file.size < 1.5 * 1024 * 1024; // screenshots stay crisp
    const type = keepPng ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return { file, ratio };
    const name = file.name.replace(/\.[^.]+$/, "") + (keepPng ? ".png" : ".jpg");
    return { file: new File([blob], name, { type }), ratio };
  } catch {
    return { file, ratio: null }; // the browser can't read it (e.g. HEIC in Chrome), send as-is
  }
}

async function uploadFile(file: File, weekId: string, mode: StorageMode): Promise<string> {
  if (!ALLOWED_MEDIA_TYPES.includes(file.type)) {
    throw new Error(`"${file.name}" isn't a photo or video type the journal can use.`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`"${file.name}" is over 100 MB. Upload it to YouTube or Vimeo and paste the link instead.`);
  }
  const safeName = file.name.replace(/[^\w.-]+/g, "-").toLowerCase();
  if (mode === "presigned") {
    // Newer stores don't add a random ending themselves, so add one to keep names unique.
    const unique = safeName.replace(/(\.[^.]+)?$/, `-${Math.random().toString(36).slice(2, 10)}$1`);
    const blob = await uploadPresigned(`journal/${weekId}/${unique}`, file, {
      access: "public",
      handleUploadUrl: "/api/journal/upload",
      contentType: file.type,
    });
    return blob.url;
  }
  if (mode === "cloud") {
    const blob = await upload(`journal/${weekId}/${safeName}`, file, {
      access: "public",
      handleUploadUrl: "/api/journal/upload",
      contentType: file.type,
    });
    return blob.url;
  }
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/journal/upload-local", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed.");
  return data.url;
}

const newId = () => Math.random().toString(36).slice(2);

/*
 * Puts photos/videos into the entry right away (as previews), then swaps in
 * the real links once each upload finishes. Photos picked together go two per row.
 */
export async function insertFiles(
  editor: Editor,
  files: File[],
  opts: {
    weekId: string;
    mode: StorageMode;
    target?: DropTarget;
    onError: (message: string) => void;
    onUploaded: (url: string) => void;
  },
) {
  const media = files.filter((f) => /^(image|video)\//.test(f.type));
  if (media.length < files.length) opts.onError("Only photos and videos can be added.");
  if (!media.length) return;

  type Item = { file: File; uploadId: string; preview: string; kind: "image" | "video" };
  const items: Item[] = media.map((file) => ({
    file,
    uploadId: newId(),
    preview: URL.createObjectURL(file),
    kind: file.type.startsWith("video/") ? "video" : "image",
  }));

  const toPhoto = (it: Item): Photo => ({ src: it.preview, caption: "", ratio: null, uploadId: it.uploadId });
  let images = items.filter((i) => i.kind === "image");
  const videos = items.filter((i) => i.kind === "video");
  const { state } = editor;
  const tr = state.tr;
  const nodes: PMNode[] = [];

  // Dropped onto a single photo: the first new photo joins it.
  const target = opts.target;
  if (target && "row" in target && images.length) {
    const row = state.doc.nodeAt(target.row);
    const existing = (row?.attrs.photos as Photo[] | undefined) ?? [];
    if (row && existing.length === 1) {
      const add = toPhoto(images[0]);
      tr.setNodeMarkup(target.row, undefined, {
        ...row.attrs,
        photos: target.side === "left" ? [add, existing[0]] : [existing[0], add],
        width: 100,
      });
      images = images.slice(1);
    }
  }
  for (let i = 0; i < images.length; i += 2) {
    const pair = images.slice(i, i + 2).map(toPhoto);
    nodes.push(state.schema.nodes.photoRow.create({ photos: pair, width: pair.length === 2 ? 100 : DEFAULT_SINGLE_WIDTH }));
  }
  for (const v of videos) {
    nodes.push(state.schema.nodes.video.create({ src: v.preview, provider: "file", embedUrl: v.preview, uploadId: v.uploadId }));
  }

  if (nodes.length) {
    let at: number;
    if (target && "at" in target) at = target.at;
    else if (target && "row" in target) {
      const row = tr.doc.nodeAt(target.row);
      at = target.row + (row?.nodeSize ?? 0);
    } else {
      const { $to } = state.selection;
      at = $to.depth === 0 ? $to.pos : $to.after(1);
    }
    tr.insert(at, nodes);
  }
  editor.view.dispatch(tr.scrollIntoView());

  await Promise.all(
    items.map(async (it) => {
      try {
        const prepared = it.kind === "image" ? await prepareImage(it.file) : { file: it.file, ratio: null };
        const url = await uploadFile(prepared.file, opts.weekId, opts.mode);
        opts.onUploaded(url);
        finishUpload(editor, it.uploadId, url, prepared.ratio);
      } catch (e) {
        dropUpload(editor, it.uploadId);
        opts.onError((e as Error).message);
      } finally {
        setTimeout(() => URL.revokeObjectURL(it.preview), 10_000);
      }
    }),
  );
}

function locate(editor: Editor, uploadId: string): { pos: number; node: PMNode } | null {
  let hit: { pos: number; node: PMNode } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (hit) return false;
    if (node.attrs?.uploadId === uploadId || (node.attrs?.photos as Photo[] | undefined)?.some((p) => p.uploadId === uploadId)) {
      hit = { pos, node };
    }
    return true;
  });
  return hit;
}

function finishUpload(editor: Editor, uploadId: string, url: string, ratio: number | null) {
  const hit = locate(editor, uploadId);
  if (!hit) return;
  const { pos, node } = hit;
  const attrs =
    node.type.name === "photoRow"
      ? {
          ...node.attrs,
          photos: (node.attrs.photos as Photo[]).map((p) =>
            p.uploadId === uploadId ? { ...p, src: url, ratio: ratio ?? p.ratio, uploadId: null } : p,
          ),
        }
      : { ...node.attrs, src: url, embedUrl: url, uploadId: null };
  // Not an undo step: undoing should never bring back the temporary preview.
  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, attrs).setMeta("addToHistory", false));
}

function dropUpload(editor: Editor, uploadId: string) {
  const hit = locate(editor, uploadId);
  if (!hit) return;
  const { pos, node } = hit;
  const tr = editor.state.tr.setMeta("addToHistory", false);
  const photos = node.attrs.photos as Photo[] | undefined;
  if (photos && photos.length > 1) {
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, photos: photos.filter((p) => p.uploadId !== uploadId), width: DEFAULT_SINGLE_WIDTH });
  } else {
    tr.delete(pos, pos + node.nodeSize);
  }
  editor.view.dispatch(tr);
}

export function hasPendingUploads(editor: Editor): boolean {
  let pending = false;
  editor.state.doc.descendants((node) => {
    if (node.attrs?.uploadId || (node.attrs?.photos as Photo[] | undefined)?.some((p) => p.uploadId)) pending = true;
    return !pending;
  });
  return pending;
}
