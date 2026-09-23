import { unauthorized } from "@/lib/journal/auth";
import { deleteWeek, getWeek, updateWeek } from "@/lib/journal/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const denied = await unauthorized();
  if (denied) return denied;
  const week = await getWeek((await params).id);
  if (!week) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(week);
}

export async function PUT(request: Request, { params }: Ctx) {
  const denied = await unauthorized();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "Nothing to save." }, { status: 400 });
  try {
    const { title, doc, html } = body;
    const week = await updateWeek((await params).id, { title, doc, html });
    return Response.json({ id: week.id, updatedAt: week.updatedAt });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await unauthorized();
  if (denied) return denied;
  try {
    await deleteWeek((await params).id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
