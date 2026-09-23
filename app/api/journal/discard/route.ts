import { unauthorized } from "@/lib/journal/auth";
import { discardUploads } from "@/lib/journal/store";

// Called when you cancel an edit, to delete photos you uploaded but didn't keep.
export async function POST(request: Request) {
  const denied = await unauthorized();
  if (denied) return denied;
  const { weekId, urls } = await request.json().catch(() => ({}));
  await discardUploads(String(weekId ?? ""), urls);
  return Response.json({ ok: true });
}
