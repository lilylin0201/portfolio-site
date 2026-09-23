import { unauthorized } from "@/lib/journal/auth";
import { createWeek, listWeeks } from "@/lib/journal/store";

export async function GET() {
  const denied = await unauthorized();
  if (denied) return denied;
  return Response.json(await listWeeks());
}

export async function POST(request: Request) {
  const denied = await unauthorized();
  if (denied) return denied;
  const { startDate, title, doc, html } = await request.json().catch(() => ({}));
  try {
    const week = await createWeek(startDate, { title, doc, html });
    return Response.json({ id: week.id });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
