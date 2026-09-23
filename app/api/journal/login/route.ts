import { checkPassword, startSession } from "@/lib/journal/auth";

export async function POST(request: Request) {
  const { password } = await request.json().catch(() => ({ password: "" }));
  if (!process.env.JOURNAL_PASSWORD) {
    return Response.json({ error: "No JOURNAL_PASSWORD is set up yet." }, { status: 400 });
  }
  if (typeof password !== "string" || !checkPassword(password)) {
    // A short pause makes guessing passwords slow.
    await new Promise((r) => setTimeout(r, 800));
    return Response.json({ error: "Wrong password." }, { status: 401 });
  }
  await startSession();
  return Response.json({ ok: true });
}
