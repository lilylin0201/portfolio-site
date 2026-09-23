import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isAuthed } from "@/lib/journal/auth";
import { ALLOWED_MEDIA_TYPES, MAX_UPLOAD_BYTES } from "@/lib/journal/media";

// Hands the browser a short-lived pass to upload a photo/video straight to Vercel Blob.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!(await isAuthed())) throw new Error("Please log in again.");
        if (!pathname.startsWith("journal/")) throw new Error("Bad upload path.");
        return {
          allowedContentTypes: ALLOWED_MEDIA_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
