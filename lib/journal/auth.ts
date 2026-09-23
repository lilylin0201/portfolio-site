import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "journal_session";
const SESSION_DAYS = 60;

function password(): string | undefined {
  return process.env.JOURNAL_PASSWORD || undefined;
}

// On your own laptop with no password set, the editor is open so you can try it.
// On Vercel, a password is always required.
export function authRequired(): boolean {
  return Boolean(password()) || process.env.NODE_ENV === "production";
}

function sessionToken(pw: string): string {
  return createHmac("sha256", pw).update("lily-journal-session-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPassword(attempt: string): boolean {
  const pw = password();
  if (!pw) return false;
  return safeEqual(attempt, pw);
}

export async function isAuthed(): Promise<boolean> {
  if (!authRequired()) return true;
  const pw = password();
  if (!pw) return false;
  const jar = await cookies();
  const value = jar.get(SESSION_COOKIE)?.value;
  return Boolean(value && safeEqual(value, sessionToken(pw)));
}

export async function startSession(): Promise<void> {
  const pw = password();
  if (!pw) return;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionToken(pw), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function unauthorized(): Promise<Response | null> {
  if (await isAuthed()) return null;
  return Response.json({ error: "Please log in again." }, { status: 401 });
}
