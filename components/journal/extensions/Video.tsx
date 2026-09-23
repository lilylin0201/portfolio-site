"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { Plugin } from "@tiptap/pm/state";
import { MdDeleteOutline } from "react-icons/md";
import { parseVideoUrl, type VideoProvider } from "@/lib/journal/media";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    video: {
      insertVideo: (attrs: {
        src: string;
        provider?: VideoProvider;
        embedUrl?: string;
        caption?: string;
        uploadId?: string | null;
      }) => ReturnType;
    };
  }
}

const IFRAME_ALLOW = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";

// A playable video: a YouTube / Vimeo / Loom / Google Drive link, or an uploaded clip.
export const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      provider: { default: "file" as VideoProvider },
      embedUrl: { default: null },
      caption: { default: "" },
      uploadId: { default: null, rendered: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-type="video"]',
        getAttrs: (el) => {
          const node = el as HTMLElement;
          return {
            src: node.getAttribute("data-src"),
            provider: node.getAttribute("data-provider") ?? "file",
            embedUrl: node.querySelector("iframe")?.getAttribute("src") ?? node.querySelector("video")?.getAttribute("src"),
            caption: node.querySelector("figcaption")?.textContent ?? "",
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { src, provider, embedUrl, caption } = node.attrs;
    const player =
      provider === "file"
        ? ["video", { src: embedUrl || src, controls: "true", playsinline: "true", preload: "metadata" }]
        : ["iframe", { src: embedUrl, allow: IFRAME_ALLOW, allowfullscreen: "true", loading: "lazy", frameborder: "0" }];
    const children: unknown[] = [["div", { class: "jvideo-frame" }, player]];
    if (caption) children.push(["figcaption", {}, caption]);
    return [
      "figure",
      mergeAttributes(HTMLAttributes, { "data-type": "video", "data-src": src, "data-provider": provider, class: "jvideo" }),
      ...children,
    ] as never;
  },

  addCommands() {
    return {
      insertVideo:
        (attrs) =>
        ({ commands }) => {
          let { provider, embedUrl } = attrs;
          if (!provider || !embedUrl) {
            const info = parseVideoUrl(attrs.src);
            if (!info && !attrs.uploadId) return false;
            provider = info?.provider ?? "file";
            embedUrl = info?.embedUrl ?? attrs.src;
          }
          return commands.insertContent({ type: this.name, attrs: { ...attrs, provider, embedUrl } });
        },
    };
  },

  // Pasting a YouTube/Vimeo/Loom/Drive link on its own turns it into a player.
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        props: {
          handlePaste: (_view, event) => {
            const text = event.clipboardData?.getData("text/plain")?.trim();
            if (!text || /\s/.test(text)) return false;
            const info = parseVideoUrl(text);
            if (!info) return false;
            editor.commands.insertVideo({ src: text, provider: info.provider, embedUrl: info.embedUrl });
            return true;
          },
        },
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoView);
  },
});

function VideoView({ node, updateAttributes, deleteNode, selected, editor, getPos }: ReactNodeViewProps) {
  const { src, provider, embedUrl, caption, uploadId } = node.attrs as {
    src: string;
    provider: VideoProvider;
    embedUrl: string;
    caption: string;
    uploadId: string | null;
  };
  const editable = editor.isEditable;

  return (
    <NodeViewWrapper as="figure" data-type="video" className={`jvideo ${selected ? "is-selected" : ""}`}>
      <div className="jvideo-frame" data-drag-handle>
        {provider === "file" ? (
          <video src={embedUrl || src} controls playsInline preload="metadata" className={uploadId ? "opacity-50" : ""} />
        ) : (
          <iframe src={embedUrl} allow={IFRAME_ALLOW} allowFullScreen title={caption || "Video"} />
        )}
        {/* While editing, a clear layer on top lets you click to select the video instead of playing it. */}
        {editable && !selected && <div className="jvideo-shield" />}
        {uploadId && <div className="jupload-badge">Uploading…</div>}
        {editable && selected && !uploadId && (
          <div className="jfigure-tools" contentEditable={false}>
            <button type="button" title="Remove video" onMouseDown={(e) => e.preventDefault()} onClick={deleteNode}>
              <MdDeleteOutline />
            </button>
          </div>
        )}
      </div>
      {editable ? (
        <input
          className="jcaption-input"
          value={caption}
          placeholder="Add a caption"
          onChange={(e) => updateAttributes({ caption: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const pos = typeof getPos === "function" ? getPos() : undefined;
              if (typeof pos !== "number") return;
              const after = pos + node.nodeSize;
              editor.chain().insertContentAt(after, { type: "paragraph" }).setTextSelection(after + 1).focus().run();
            }
          }}
        />
      ) : (
        caption && <figcaption>{caption}</figcaption>
      )}
    </NodeViewWrapper>
  );
}
