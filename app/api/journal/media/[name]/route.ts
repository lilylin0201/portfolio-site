import { promises as fs } from "fs";
import path from "path";
import { LOCAL_MEDIA } from "@/lib/journal/store";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  heic: "image/heic",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

// Serves photos saved on your laptop (local mode only).
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[\w.-]+$/.test(name)) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(path.join(LOCAL_MEDIA, name));
    const ext = name.split(".").pop()!.toLowerCase();
    return new Response(data, {
      headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
