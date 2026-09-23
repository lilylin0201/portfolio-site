import { endSession } from "@/lib/journal/auth";

export async function POST(request: Request) {
  await endSession();
  return Response.redirect(new URL("/journal", request.url), 303);
}
