// Shared by the browser and the server.

export const ALLOWED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
];

// Your free Blob store holds 1 GB, so keep single files modest.
// For longer videos, upload to YouTube/Vimeo (unlisted is fine) and paste the link.
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export type VideoProvider = "youtube" | "vimeo" | "loom" | "drive" | "file";

export interface VideoInfo {
  provider: VideoProvider;
  embedUrl: string;
}

// Turns a normal share link into something that can play inside the page.
export function parseVideoUrl(raw: string): VideoInfo | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtu.be" || host.endsWith("youtube.com") || host === "youtube-nocookie.com") {
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
    else if (url.searchParams.get("v")) id = url.searchParams.get("v");
    else {
      const m = url.pathname.match(/\/(?:embed|shorts|live|v)\/([\w-]{6,})/);
      if (m) id = m[1];
    }
    if (!id || !/^[\w-]{6,}$/.test(id)) return null;
    const start = url.searchParams.get("t") || url.searchParams.get("start");
    const seconds = start ? parseInt(start, 10) : 0;
    return {
      provider: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}${seconds ? `?start=${seconds}` : ""}`,
    };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = url.pathname.match(/(?:\/video)?\/(\d+)(?:\/(\w+))?/);
    if (!m) return null;
    const hash = m[2] || url.searchParams.get("h");
    return { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${m[1]}${hash ? `?h=${hash}` : ""}` };
  }

  if (host === "loom.com") {
    const m = url.pathname.match(/\/(?:share|embed)\/([\w]+)/);
    if (!m) return null;
    return { provider: "loom", embedUrl: `https://www.loom.com/embed/${m[1]}` };
  }

  if (host === "drive.google.com") {
    const m = url.pathname.match(/\/file\/d\/([\w-]+)/) ?? null;
    const id = m?.[1] ?? url.searchParams.get("id");
    if (!id) return null;
    return { provider: "drive", embedUrl: `https://drive.google.com/file/d/${id}/preview` };
  }

  if (/\.(mp4|webm|mov)$/i.test(url.pathname)) {
    return { provider: "file", embedUrl: url.toString() };
  }
  return null;
}
