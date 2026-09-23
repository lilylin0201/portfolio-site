import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { unauthorized } from "@/lib/journal/auth";
import { ALLOWED_MEDIA_TYPES, MAX_UPLOAD_BYTES } from "@/lib/journal/media";
import { LOCAL_MEDIA } from "@/lib/journal/store";

// Only used on your laptop before Vercel Blob is connected.
export async function POST(request: Request) {
  const denied = await unauthorized();
  if (denied) return denied;
  if (process.env.VERCEL) {
    return Response.json({ error: "Connect Vercel Blob to upload on the live site." }, { status: 400 });
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file." }, { status: 400 });
  if (!ALLOWED_MEDIA_TYPES.includes(file.type)) {
    return Response.json({ error: `Can't upload ${file.type || "that kind of file"}.` }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "That file is too big." }, { status: 400 });

  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "-").slice(0, 40) || "file";
  const name = `${base}-${randomBytes(4).toString("hex")}.${ext}`;
  await fs.mkdir(LOCAL_MEDIA, { recursive: true });
  await fs.writeFile(path.join(LOCAL_MEDIA, name), Buffer.from(await file.arrayBuffer()));
  return Response.json({ url: `/api/journal/media/${name}` });
}
