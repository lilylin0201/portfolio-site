import { handleUpload, handleUploadPresigned, type HandleUploadBody, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { issueSignedToken } from "@vercel/blob";
import { isAuthed } from "@/lib/journal/auth";
import { ALLOWED_MEDIA_TYPES, MAX_UPLOAD_BYTES } from "@/lib/journal/media";

// Gives the browser short-lived permission to upload one photo/video straight to Vercel Blob.
export async function POST(request: Request) {
  const body = await request.json();
  try {
    // Newer Blob stores (BLOB_STORE_ID, no token): presigned uploads.
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      const result = await handleUploadPresigned({
        body: body as HandleUploadPresignedBody,
        request,
        getSignedToken: async (pathname) => {
          if (!(await isAuthed())) throw new Error("Please log in again.");
          if (!pathname.startsWith("journal/")) throw new Error("Bad upload path.");
          const token = await issueSignedToken({
            pathname,
            operations: ["put"],
            allowedContentTypes: ALLOWED_MEDIA_TYPES,
            maximumSizeInBytes: MAX_UPLOAD_BYTES,
          });
          return {
            token,
            urlOptions: { allowedContentTypes: ALLOWED_MEDIA_TYPES, maximumSizeInBytes: MAX_UPLOAD_BYTES },
          };
        },
      });
      return Response.json(result);
    }

    // Blob stores with a read-write token.
    const result = await handleUpload({
      body: body as HandleUploadBody,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!(await isAuthed())) throw new Error("Please log in again.");
        if (!pathname.startsWith("journal/")) throw new Error("Bad upload path.");
        return { allowedContentTypes: ALLOWED_MEDIA_TYPES, maximumSizeInBytes: MAX_UPLOAD_BYTES, addRandomSuffix: true };
      },
    });
    return Response.json(result);
  } catch (e) {
    console.error("Upload error", e);
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
